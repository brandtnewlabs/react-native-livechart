import { act, render, renderHook } from "@testing-library/react-native";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";
import { LiveChart } from "../src/components/LiveChart";
import { LiveChartSeries } from "../src/components/LiveChartSeries";
import * as singleHooks from "../src/core/useLiveChartEngine";
import * as multiHooks from "../src/core/useLiveChartSeriesEngine";
import { useChartOverlayContext } from "../src/hooks/useChartOverlayContext";
import type { RangeAnimationConfig } from "../src";

// Keep the engines/overlay bridge real; control storage and frame scheduling so
// a stale prop capture or dropped config at either boundary is observable.
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => {
      const ref = React.useRef({
        value: initial,
        get() { return this.value; },
        set(next: T) { this.value = next; },
        addListener() {}, removeListener() {},
      });
      return ref.current;
    },
    useDerivedValue: <T,>(fn: () => T) => {
      const latest = React.useRef(fn);
      latest.current = fn;
      return React.useMemo(() => ({ get value() { return latest.current(); }, get() { return latest.current(); } }), []);
    },
    useFrameCallback: jest.fn(() => ({ setActive: jest.fn() })),
    useAnimatedReaction: jest.fn(),
  };
});

interface Props {
  referenceValues: number[];
  rangeAnimation?: RangeAnimationConfig;
}

function frame() {
  const calls = jest.mocked(useFrameCallback).mock.calls;
  calls[calls.length - 1][0]({ timestamp: 1000000, timeSinceFirstFrame: 0, timeSincePreviousFrame: 1000 / 60 });
}

beforeEach(() => jest.mocked(useFrameCallback).mockClear());
afterEach(() => jest.restoreAllMocks());

describe.each(["single", "multi"] as const)("%s range config wiring", (kind) => {
  it("passes the public prop to the engine", async () => {
    const single = jest.spyOn(singleHooks, "useLiveChartEngine");
    const multi = jest.spyOn(multiHooks, "useLiveChartSeriesEngine");
    const rangeAnimation = { animateExpansion: true, expansionSmoothing: 0.25, contractionSmoothing: 0.5 };
    function Harness() {
      const data = useSharedValue([{ time: 1000, value: 40 }]);
      const value = useSharedValue(40);
      const series = useSharedValue([{ id: "a", data: data.value, value: 40 }]);
      return kind === "single"
        ? <LiveChart data={data} value={value} rangeAnimation={rangeAnimation} />
        : <LiveChartSeries series={series} rangeAnimation={rangeAnimation} />;
    }
    await render(<Harness />);
    expect(kind === "single" ? single : multi).toHaveBeenCalledWith(expect.objectContaining({ rangeAnimation }));
  });

  it("updates frame speeds on hold/release and publishes the same scale to overlays", async () => {
    const { result, rerender } = await renderHook((props: Props) => {
      const data = useSharedValue([{ time: 940, value: 20 }, { time: 1000, value: 40 }]);
      const value = useSharedValue(40);
      const series = useSharedValue([{ id: "a", data: data.value, value: 40 }]);
      const single = singleHooks.useLiveChartEngine({ data, value, timeWindow: 60, nowOverride: 1000, smoothing: 0.08, ...props });
      const multi = multiHooks.useLiveChartSeriesEngine({ series, timeWindow: 60, nowOverride: 1000, smoothing: 0.08, ...props });
      const engine = kind === "single" ? single : multi;
      const overlay = useChartOverlayContext(engine, { top: 0, bottom: 0, left: 0, right: 0 });
      return { engine, overlay };
    }, { initialProps: { referenceValues: [] } });
    result.current.engine.canvasWidth.set(375);
    result.current.engine.canvasHeight.set(280);
    result.current.engine.displayMin.set(17.6);
    result.current.engine.displayMax.set(42.4);
    if ("displayValue" in result.current.engine) result.current.engine.displayValue.set(40);
    // Both hooks are mounted to keep hook order stable; choose the matching callback.
    const run = () => {
      const calls = jest.mocked(useFrameCallback).mock.calls;
      calls[calls.length - (kind === "single" ? 2 : 1)][0]({ timestamp: 1000000, timeSinceFirstFrame: 0, timeSincePreviousFrame: 1000 / 60 });
    };
    await rerender({ referenceValues: [80], rangeAnimation: { animateExpansion: true, expansionSmoothing: 0.25 } });
    await act(run);
    expect(result.current.engine.displayMax.get()).toBeCloseTo(53.6);
    expect(result.current.overlay.scale.get().max).toBeCloseTo(53.6);
    await rerender({ referenceValues: [], rangeAnimation: { animateExpansion: false, contractionSmoothing: 0.5 } });
    await act(run);
    expect(result.current.engine.displayMax.get()).toBeCloseTo(48);
    expect(result.current.overlay.scale.get().max).toBeCloseTo(48);
    await rerender({ referenceValues: [80] });
    await act(run);
    expect(result.current.engine.displayMax.get()).toBeCloseTo(87.2);
  });
});

it("keeps a static chart instant with slow range overrides", async () => {
  const { result } = await renderHook(() => {
    const data = useSharedValue([{ time: 940, value: 20 }, { time: 1000, value: 40 }]);
    const value = useSharedValue(40);
    return singleHooks.useLiveChartEngine({
      data, value, timeWindow: 60, nowOverride: 1000, smoothing: 0.08, static: true,
      referenceValues: [80], rangeAnimation: { animateExpansion: true, expansionSmoothing: 0, contractionSmoothing: 0 },
    });
  });
  result.current.canvasWidth.set(375);
  result.current.canvasHeight.set(280);
  await act(frame);
  expect(result.current.displayMax.get()).toBeCloseTo(87.2);
});
