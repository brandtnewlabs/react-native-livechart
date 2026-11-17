import { act, render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue } from "react-native-reanimated";
import { LiveChart } from "../src/components/LiveChart";
import * as engines from "../src/core/useLiveChartEngine";
import * as lineGeometry from "../src/draw/line";
import * as paths from "../src/hooks/useChartPaths";
import * as crosshairs from "../src/hooks/useCrosshair";
import * as dots from "../src/hooks/useLiveDot";

// Evaluate derived worklets when read so scrub gestures can update their inputs.
// This drives the real hook logic without pretending to run a native UI thread.
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => React.useRef({
      value: initial,
      get() { return this.value; },
      set(next: T) { this.value = next; },
      addListener() {},
      removeListener() {},
    }).current,
    useDerivedValue: <T,>(read: () => T) => {
      const latest = React.useRef(read);
      latest.current = read;
      return React.useMemo(() => ({
        get value() { return latest.current(); },
        get() { return latest.current(); },
      }), []);
    },
    useAnimatedReaction: jest.fn(),
    useFrameCallback: () => ({ setActive() {} }),
  };
});

const useActualEngine = engines.useLiveChartEngine;

afterEach(() => jest.restoreAllMocks());

async function renderBufferedChart(windowBufferSeconds = 15) {
  // Engine frames/reveal animations are separate concerns. Seed a settled
  // [970, 1000] viewport with data ending at 985 and a different live price.
  const engineSpy = jest.spyOn(engines, "useLiveChartEngine").mockImplementation((config) => {
    const engine = useActualEngine(config);
    engine.canvasWidth.set(200);
    engine.canvasHeight.set(100);
    engine.timestamp.set(1000);
    engine.displayWindow.set(30);
    engine.displayMin.set(0);
    engine.displayMax.set(10);
    engine.displayValue.set(9);
    return { ...engine, data: config.dataChangeSource ?? config.data };
  });
  const pathSpy = jest.spyOn(paths, "useChartPaths");
  const pointSpy = jest.spyOn(lineGeometry, "buildLinePoints");
  const dotSpy = jest.spyOn(dots, "useLiveDot");
  const crosshairSpy = jest.spyOn(crosshairs, "useCrosshair");
  function Chart() {
    const data = useSharedValue([{ time: 980, value: 1 }, { time: 985, value: 2 }]);
    const value = useSharedValue(9);
    return <LiveChart data={data} value={value} windowBuffer={0}
      windowBufferSeconds={windowBufferSeconds} timeScroll={false} scrub
      yAxis={false} badge={false} line={{ curve: "linear" }} />;
  }
  await render(<Chart />);
  const engineConfig = engineSpy.mock.calls.at(-1)![0];
  expect(engineConfig.windowBuffer).toBe(0);
  expect(engineConfig.windowBufferSeconds).toBe(windowBufferSeconds);
  return {
    pathSpy, pointSpy,
    path: pathSpy.mock.results.at(-1)!.value,
    dot: dotSpy.mock.results.at(-1)!.value,
    crosshair: crosshairSpy.mock.results.at(-1)!.value,
    engine: dotSpy.mock.calls.at(-1)![0],
    padding: dotSpy.mock.calls.at(-1)![1],
  };
}

it("ends the line and live dot at the recorded point with only a seconds buffer", async () => {
  const { path, pointSpy, dot, padding } = await renderBufferedChart();
  path.linePath.get();
  const points = pointSpy.mock.results.at(-1)!.value;
  const latestX = (padding.left + 200 - padding.right) / 2;
  const latestY = padding.top + 0.8 * (100 - padding.top - padding.bottom);
  expect(points).toHaveLength(4);
  expect(points[points.length - 2]).toBeCloseTo(latestX);
  expect(points[points.length - 1]).toBeCloseTo(latestY);
  expect(dot.dotX.get()).toBeCloseTo(latestX);
  expect(dot.dotY.get()).toBeCloseTo(latestY);
  expect(dot.indicatorValue.get()).toBe(2);
});

it("clamps a scrub in the seconds buffer to recorded data and hides it in a future-only viewport", async () => {
  const { crosshair, engine, padding } = await renderBufferedChart();
  const event = { x: 200 - padding.right, y: 30 };
  await act(() => {
    crosshair.gesture.handlers.onStart?.(event as never);
  });
  expect(crosshair.scrubActive.get()).toBe(true);
  expect(crosshair.scrubX.get()).toBeCloseTo((padding.left + event.x) / 2);
  engine.timestamp.set(1020);
  expect(crosshair.scrubX.get()).toBe(-1);
  expect(crosshair.scrubActive.get()).toBe(false);
  // The same held gesture becomes available when the viewport returns.
  engine.timestamp.set(1000);
  expect(crosshair.scrubActive.get()).toBe(true);
});

it("retains the synthetic live edge when both buffer settings are zero", async () => {
  const { path, pointSpy, dot, crosshair, padding } = await renderBufferedChart(0);
  path.linePath.get();
  const points = pointSpy.mock.results.at(-1)!.value;
  const right = 200 - padding.right;
  expect(points[points.length - 2]).toBeCloseTo(right);
  expect(dot.dotX.get()).toBe(right);
  expect(dot.indicatorValue.get()).toBe(9);
  await act(() => {
    crosshair.gesture.handlers.onStart?.({ x: right, y: 30 } as never);
  });
  expect(crosshair.scrubX.get()).toBe(right);
});
