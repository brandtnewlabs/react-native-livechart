import { renderHook } from "@testing-library/react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { resolveViewport } from "../src/core/resolveConfig";
import {
  applyLiveChartEngineFrame,
  clearGestureOwnedRange,
  makeEngineFrameScratch,
  type EngineFrameRefs,
  useLiveChartEngine,
} from "../src/core/useLiveChartEngine";
import type { ChartScale } from "../src/types";

type Range = Pick<ChartScale, "min" | "max">;

function shared<T>(value: T) {
  return {
    value,
    get() {
      return this.value;
    },
    set(next: T) {
      this.value = next;
    },
  } as SharedValue<T>;
}

function frameRefs(overrides: Record<string, unknown> = {}) {
  return {
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
    smoothing: { value: 1 },
    exaggerateSV: { value: false },
    referenceValue: { value: undefined as number | undefined },
    nowOverrideSV: { value: 1700000000 },
    windowBufferSV: { value: 0 },
    pausedSV: { value: false },
    modeSV: { value: "line" as const },
    extremaMinValue: { value: NaN },
    extremaMaxValue: { value: NaN },
    extremaMinTime: { value: NaN },
    extremaMaxTime: { value: NaN },
    viewEndSV: { value: null as number | null },
    viewRangeSV: { value: { min: -10, max: 10 } as Range | null },
    viewRangeFollowsLiveSV: { value: true },
    nonNegativeSV: { value: true },
    fitMinSV: { value: 0 },
    fitMaxSV: { value: 1 },
    ...overrides,
  };
}

describe("applyLiveChartEngineFrame with a gesture-owned range", () => {
  it("writes the clamped range back and publishes the fitted bounds", () => {
    const sv = frameRefs();
    applyLiveChartEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as EngineFrameRefs,
      makeEngineFrameScratch(),
    );
    expect(sv.viewRangeSV.value).toEqual({ min: 0, max: 20 });
    expect([sv.displayMin.value, sv.displayMax.value]).toEqual([0, 20]);
    expect(Number.isFinite(sv.fitMinSV.value)).toBe(true);
    expect(sv.fitMinSV.value).toBeLessThan(sv.fitMaxSV.value);
    expect(sv.fitMaxSV.value).not.toBe(20);
  });

  it("leaves the shared range alone when nothing was clamped", () => {
    const range = { min: 5, max: 15 };
    const sv = frameRefs({ viewRangeSV: { value: range } });
    applyLiveChartEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as EngineFrameRefs,
      makeEngineFrameScratch(),
    );
    expect(sv.viewRangeSV.value).toBe(range);
    expect([sv.displayMin.value, sv.displayMax.value]).toEqual([5, 15]);
  });

  it("retains gesture ownership after the clamp's synchronous range notification", () => {
    const sv = frameRefs();
    let range = sv.viewRangeSV.value;
    Object.defineProperty(sv.viewRangeSV, "value", {
      get: () => range,
      set: (next: Range | null) => {
        range = next;
        sv.viewRangeFollowsLiveSV.value = false;
      },
    });
    applyLiveChartEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as EngineFrameRefs,
      makeEngineFrameScratch(),
    );
    expect(range).toEqual({ min: 0, max: 20 });
    expect(sv.viewRangeFollowsLiveSV.value).toBe(true);
  });

  it("never rewrites an app-written range", () => {
    const range = { min: -10, max: 10 };
    const sv = frameRefs({
      viewRangeSV: { value: range },
      viewRangeFollowsLiveSV: { value: false },
      // Parked before live: an app-written range applies only while scrolled back.
      viewEndSV: { value: 1699999990 },
    });
    applyLiveChartEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as EngineFrameRefs,
      makeEngineFrameScratch(),
    );
    expect(sv.viewRangeSV.value).toBe(range);
    expect([sv.displayMin.value, sv.displayMax.value]).toEqual([-10, 10]);
  });
});

describe("clearGestureOwnedRange", () => {
  it("drops a gesture-owned range and its ownership flag", () => {
    const viewRange = shared<Range | null>({ min: 1, max: 2 });
    const owned = shared(true);
    clearGestureOwnedRange(viewRange, owned);
    expect(viewRange.get()).toBeNull();
    expect(owned.get()).toBe(false);
  });

  it("leaves an app-written range alone", () => {
    const viewRange = shared<Range | null>({ min: 1, max: 2 });
    const owned = shared(false);
    clearGestureOwnedRange(viewRange, owned);
    expect(viewRange.get()).toEqual({ min: 1, max: 2 });
  });
});

describe("useLiveChartEngine gesture range", () => {
  function useEngine({ k = "1H", mode = "line" as "line" | "candle" } = {}) {
    const data = useSharedValue([{ time: 1700000000, value: 1 }]);
    const value = useSharedValue(1);
    return useLiveChartEngine({ data, value, timeWindow: 30, smoothing: 0.08, snapKey: k, mode });
  }

  it("keeps private range state when no viewport is supplied", async () => {
    const { result } = await renderHook(() => useEngine());
    expect(result.current.viewRange.get()).toBeNull();
    expect(result.current.viewRangeGestureOwned.get()).toBe(false);
    expect(result.current.fitMin.get()).toBeLessThan(result.current.fitMax.get());
  });

  it("adopts the app's viewport.range shared value", async () => {
    const { result } = await renderHook(() => {
      const data = useSharedValue([{ time: 1700000000, value: 1 }]);
      const value = useSharedValue(1);
      const end = useSharedValue<number | null>(null);
      const window = useSharedValue<number | null>(null);
      const range = useSharedValue<Range | null>({ min: 1, max: 2 });
      const engine = useLiveChartEngine({
        data,
        value,
        timeWindow: 30,
        smoothing: 0.08,
        viewport: resolveViewport({ end, window, range }),
      });
      return { engine, range };
    });
    expect(result.current.engine.viewRange).toBe(result.current.range);
  });

  it("re-frames on a snapKey or mode change without disturbing the private range state", async () => {
    // JS-side shared-value writes don't round-trip under Jest, so this covers
    // the effect wiring; `clearGestureOwnedRange` itself is unit-tested above.
    const { result, rerender } = await renderHook(
      (props: { k?: string; mode?: "line" | "candle" }) => useEngine(props),
      { initialProps: { k: "1H", mode: "line" } },
    );
    await rerender({ k: "1H", mode: "line" });
    await rerender({ k: "1D", mode: "line" });
    await rerender({ k: "1D", mode: "candle" });
    expect(result.current.viewRange.get()).toBeNull();
    expect(result.current.viewRangeGestureOwned.get()).toBe(false);
  });
});
