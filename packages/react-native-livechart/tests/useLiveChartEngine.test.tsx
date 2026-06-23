import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import {
  applyLiveChartEngineFrame,
  type EngineFrameRefs,
  useLiveChartEngine,
} from "../src/core/useLiveChartEngine";

describe("applyLiveChartEngineFrame", () => {
  it("runs tick and writes shared values", () => {
    const sv = {
      data: { value: [{ time: 1700000000, value: 10 }] },
      value: { value: 10 },
      displayValue: { value: 0 },
      displayMin: { value: 0 },
      displayMax: { value: 1 },
      displayWindow: { value: 30 },
      timestamp: { value: 1700000000 },
      canvasWidth: { value: 200 },
      canvasHeight: { value: 100 },
      timeWindow: { value: 30 },
      smoothing: { value: 0.5 },
      exaggerateSV: { value: false },
      referenceValue: { value: undefined as number | undefined },
      // Pin "now" to the point's time so it falls inside the live window
      // (otherwise the real-clock default scrolls it out and extrema go NaN).
      nowOverrideSV: { value: 1700000000 },
      windowBufferSV: { value: 0 },
      pausedSV: { value: false },
      modeSV: { value: "line" as const },
      extremaMinValue: { value: NaN },
      extremaMaxValue: { value: NaN },
      extremaMinTime: { value: NaN },
      extremaMaxTime: { value: NaN },
    };
    applyLiveChartEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as EngineFrameRefs,
    );
    expect(sv.displayValue.value).not.toBe(0);
    // The data point's value + time become the live extrema.
    expect(sv.extremaMinValue.value).toBe(10);
    expect(sv.extremaMaxValue.value).toBe(10);
    expect(sv.extremaMinTime.value).toBe(1700000000);
  });
});

describe("useLiveChartEngine", () => {
  it("returns shared engine state", () => {
    const { result } = renderHook(() => {
      const data = useSharedValue([{ time: 1700000000, value: 1 }]);
      const value = useSharedValue(1);
      return useLiveChartEngine({
        data,
        value,
        timeWindow: 30,
        smoothing: 0.08,
        exaggerate: true,
        referenceValue: 0.5,
      });
    });

    expect(result.current.displayValue.value).toBeDefined();
    expect(result.current.canvasWidth.value).toBe(0);
  });

  it("treats optional exaggerate and reference as undefined", () => {
    const { result } = renderHook(() => {
      const data = useSharedValue([{ time: 1700000000, value: 1 }]);
      const value = useSharedValue(1);
      return useLiveChartEngine({
        data,
        value,
        timeWindow: 30,
        smoothing: 0.08,
      });
    });
    expect(result.current.displayMin.value).toBeDefined();
  });

  it("does not throw rendering a static engine", () => {
    // Smoke test: the static path adds a one-shot settle reaction; ensure the
    // hook mounts cleanly (autostart wiring is asserted in the frame-callback
    // mock test, the settle math in the smoothing=1 snap test below).
    const { result } = renderHook(() => {
      const data = useSharedValue([
        { time: 1700000000, value: 10 },
        { time: 1700000030, value: 30 },
      ]);
      const value = useSharedValue(30);
      return useLiveChartEngine({
        data,
        value,
        timeWindow: 30,
        smoothing: 0.08,
        static: true,
        nowOverride: 1700000030,
      });
    });
    expect(result.current.displayMin.value).toBeDefined();
  });

  it("exposes a null pinch-zoom override that follows the timeWindow prop", () => {
    // `viewWindow` is the pinch-zoom override; it starts null (follow the prop) and
    // a mount-time effect keeps it cleared so a `timeWindow` prop change (range /
    // timeframe selector) isn't shadowed by a stale override. (The full reset-on-
    // prop-change path is hard to drive under the SharedValue mock — a `set()` on a
    // value read by a derived value forces a re-render that recreates it — so this
    // asserts the wiring and default; the behavior is exercised in-app.)
    const { result, rerender } = renderHook(
      ({ tw }: { tw: number }) => {
        const data = useSharedValue([{ time: 1700000000, value: 1 }]);
        const value = useSharedValue(1);
        return useLiveChartEngine({ data, value, timeWindow: tw, smoothing: 0.08 });
      },
      { initialProps: { tw: 30 } },
    );
    expect(result.current.viewWindow.get()).toBeNull();
    rerender({ tw: 60 });
    expect(result.current.viewWindow.get()).toBeNull();
  });

  it("snaps the display state in one tick at smoothing=1 (the static settle)", () => {
    // The static settle reaction runs `applyLiveChartEngineFrame` once with
    // smoothing forced to 1, which must reach the final state immediately.
    const sv = {
      data: {
        value: [
          { time: 1700000000, value: 10 },
          { time: 1700000030, value: 30 },
        ],
      },
      value: { value: 30 },
      displayValue: { value: 0 },
      displayMin: { value: 0 },
      displayMax: { value: 1 },
      displayWindow: { value: 30 },
      timestamp: { value: 1700000030 },
      canvasWidth: { value: 300 },
      canvasHeight: { value: 120 },
      timeWindow: { value: 30 },
      smoothing: { value: 1 },
      exaggerateSV: { value: false },
      referenceValue: { value: undefined as number | undefined },
      nowOverrideSV: { value: 1700000030 },
      windowBufferSV: { value: 0 },
      pausedSV: { value: false },
      modeSV: { value: "line" as const },
      extremaMinValue: { value: NaN },
      extremaMaxValue: { value: NaN },
      extremaMinTime: { value: NaN },
      extremaMaxTime: { value: NaN },
    };
    applyLiveChartEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as EngineFrameRefs,
    );
    // Snap-to-target: the live value lands exactly on its target in one call,
    // and the Y-range brackets the data.
    expect(sv.displayValue.value).toBe(30);
    expect(sv.displayMin.value).toBeLessThanOrEqual(10);
    expect(sv.displayMax.value).toBeGreaterThanOrEqual(30);
    // Extrema snapshot the raw data low/high (10 @ first point, 30 @ last).
    expect(sv.extremaMinValue.value).toBe(10);
    expect(sv.extremaMaxValue.value).toBe(30);
    expect(sv.extremaMaxTime.value).toBe(1700000030);
  });
});
