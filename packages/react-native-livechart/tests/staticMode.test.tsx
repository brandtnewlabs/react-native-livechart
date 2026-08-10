import { render, renderHook } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

// Capture every `useFrameCallback(cb, autostart)` call's autostart flag so we can
// assert that static charts register their loops inert (autostart === false).
const frameCallbackCalls: Array<boolean | undefined> = [];
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return {
    ...actual,
    useFrameCallback: jest.fn(
      (cb: (info: unknown) => void, autostart?: boolean) => {
        frameCallbackCalls.push(autostart);
        return actual.useFrameCallback(cb, autostart);
      },
    ),
  };
});

// Imported after the mock so they pick up the wrapped `useFrameCallback`.
import { LiveChart } from "../src/components/LiveChart";
import { useLiveChartEngine } from "../src/core/useLiveChartEngine";
import type { LiveChartPoint } from "../src/types";
import { getAllByHostType } from "./rntl14";

beforeEach(() => {
  frameCallbackCalls.length = 0;
});

describe("static mode — no per-frame loops", () => {
  it("engine autostarts the frame callback when not static", async () => {
    await renderHook(() => {
      const data = useSharedValue([{ time: 1700000000, value: 1 }]);
      const value = useSharedValue(1);
      return useLiveChartEngine({ data, value, timeWindow: 30, smoothing: 0.08 });
    });
    // One frame callback (the engine), autostarted (the `!config.static` arg).
    expect(frameCallbackCalls).toEqual([true]);
  });

  it("engine registers the frame callback inert when static", async () => {
    await renderHook(() => {
      const data = useSharedValue([{ time: 1700000000, value: 1 }]);
      const value = useSharedValue(1);
      return useLiveChartEngine({
        data,
        value,
        timeWindow: 30,
        smoothing: 0.08,
        static: true,
      });
    });
    expect(frameCallbackCalls).toEqual([false]);
  });

  it("disables every frame-callback loop when LiveChart is static", async () => {
    function Harness() {
      const data = useSharedValue<LiveChartPoint[]>([
        { time: 1700000000, value: 10 },
        { time: 1700000030, value: 30 },
      ]);
      const value = useSharedValue(30);
      return (
        <LiveChart
          static
          data={data}
          value={value}
          timeWindow={30}
          nowOverride={1700000030}
        />
      );
    }
    const screen = await render(<Harness />);
    const views = getAllByHostType(screen, View);
    // Lay out the canvas so the chart fully wires up.
    // (No assertions needed on layout — just exercising the render path.)
    await screen.rerender(<Harness />);
    expect(views.length).toBeGreaterThan(0);
    // Both the engine and useDegen register a frame callback; in static mode
    // every one must be inert (autostart false) — that is the core invariant.
    expect(frameCallbackCalls.length).toBeGreaterThanOrEqual(2);
    expect(frameCallbackCalls.every((autostart) => autostart === false)).toBe(
      true,
    );
  });

  it("keeps every loop inert when a static chart enables scrub + scrubAction", async () => {
    // #177: scrub / scrubAction are on-demand touch gestures (event-driven, no
    // per-frame loop), so enabling them on a static chart must NOT reactivate any
    // frame callback — a still sparkline stays scrubbable at zero idle cost.
    function Harness() {
      const data = useSharedValue<LiveChartPoint[]>([
        { time: 1700000000, value: 10 },
        { time: 1700000030, value: 30 },
      ]);
      const value = useSharedValue(30);
      return (
        <LiveChart
          static
          scrub
          scrubAction
          data={data}
          value={value}
          timeWindow={30}
          nowOverride={1700000030}
        />
      );
    }
    const screen = await render(<Harness />);
    await screen.rerender(<Harness />);
    expect(frameCallbackCalls.length).toBeGreaterThanOrEqual(2);
    expect(frameCallbackCalls.every((autostart) => autostart === false)).toBe(
      true,
    );
  });

  it("autostarts LiveChart frame-callback loops when not static", async () => {
    function Harness() {
      const data = useSharedValue<LiveChartPoint[]>([
        { time: 1700000000, value: 10 },
      ]);
      const value = useSharedValue(10);
      return <LiveChart data={data} value={value} />;
    }
    await render(<Harness />);
    // The live engine autostarts (true). useDegen's callback defaults to
    // autostart when not static; at minimum the engine's loop must be live.
    // The candle-width bridge registers inert (false) in line mode — its loop
    // only starts for candle charts (see useCandleWidthLerp).
    expect(frameCallbackCalls).toContain(true);
  });
});
