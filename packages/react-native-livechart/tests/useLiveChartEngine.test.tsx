import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import {
  applyLiveChartEngineFrame,
  makeEngineFrameScratch,
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
    const scratch = makeEngineFrameScratch();
    const stateIdentity = scratch.state;
    const inputIdentity = scratch.input;
    applyLiveChartEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as EngineFrameRefs,
      scratch,
    );
    applyLiveChartEngineFrame(
      { timeSincePreviousFrame: 17 },
      sv as unknown as EngineFrameRefs,
      scratch,
    );
    expect(scratch.state).toBe(stateIdentity);
    expect(scratch.input).toBe(inputIdentity);
    expect(scratch.input.dt).toBe(17);
    expect(scratch.input.points).toBe(sv.data.value);
    expect(sv.displayValue.value).not.toBe(0);
    // The data point's value + time become the live extrema.
    expect(sv.extremaMinValue.value).toBe(10);
    expect(sv.extremaMaxValue.value).toBe(10);
    expect(sv.extremaMinTime.value).toBe(1700000000);
  });

  it("consumes the snap flag — snaps the value in one frame then clears it", () => {
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
      smoothing: { value: 0.08 }, // small: only a snap reaches the target in one frame
      exaggerateSV: { value: false },
      referenceValue: { value: undefined as number | undefined },
      nowOverrideSV: { value: 1700000000 },
      windowBufferSV: { value: 0 },
      pausedSV: { value: false },
      snapSV: { value: true },
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
    expect(sv.displayValue.value).toBe(10); // snapped, not eased
    expect(sv.snapSV.value).toBe(false); // one-shot: cleared after consuming
  });

  it("keeps the snap flag pending when the canvas has not laid out yet", () => {
    const sv = {
      data: { value: [{ time: 1700000000, value: 10 }] },
      value: { value: 10 },
      displayValue: { value: 0 },
      displayMin: { value: 0 },
      displayMax: { value: 1 },
      displayWindow: { value: 30 },
      timestamp: { value: 1700000000 },
      canvasWidth: { value: 0 }, // unmeasured → tick early-returns before snapping
      canvasHeight: { value: 100 },
      timeWindow: { value: 30 },
      smoothing: { value: 0.08 },
      exaggerateSV: { value: false },
      referenceValue: { value: undefined as number | undefined },
      nowOverrideSV: { value: 1700000000 },
      windowBufferSV: { value: 0 },
      pausedSV: { value: false },
      snapSV: { value: true },
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
    expect(sv.displayValue.value).toBe(0); // nothing applied (early return)
    expect(sv.snapSV.value).toBe(true); // still pending for the first real frame
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

  it("requests a one-shot snap when snapKey changes (and not on a stable key)", () => {
    // snapSV is internal, so this asserts the effect wiring doesn't throw across
    // the no-change / change paths; the snap math itself is covered by the
    // applyLiveChartEngineFrame + tick tests above. (Mirrors the viewWindow-reset
    // wiring test — the SharedValue mock can't round-trip the frame loop.)
    const { result, rerender } = renderHook(
      ({ k }: { k: string }) => {
        const data = useSharedValue([{ time: 1700000000, value: 1 }]);
        const value = useSharedValue(1);
        return useLiveChartEngine({
          data,
          value,
          timeWindow: 30,
          smoothing: 0.08,
          snapKey: k,
        });
      },
      { initialProps: { k: "1H" } },
    );
    rerender({ k: "1H" }); // unchanged key → no snap requested
    rerender({ k: "1D" }); // changed key → snap requested for the next frame
    expect(result.current.displayMin.value).toBeDefined();
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
