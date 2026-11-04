import {
  clampGestureRange,
  tickLiveChartEngineFrame,
  type EngineTickInput,
  type EngineTickMutable,
} from "../src/core/liveChartEngineTick";

function state(): EngineTickMutable {
  return {
    displayValue: 10, displayMin: 0, displayMax: 20, displayWindow: 30,
    timestamp: 1000, liveEdge: 1000, edgeValue: 10,
    extremaMinValue: NaN, extremaMaxValue: NaN,
    extremaMinTime: NaN, extremaMaxTime: NaN,
  };
}

function input(overrides: Partial<EngineTickInput> = {}): EngineTickInput {
  return {
    dt: 16.67, canvasWidth: 200, canvasHeight: 100,
    timeWindow: 30, smoothing: 1, exaggerate: false,
    referenceValue: undefined, targetValue: 10,
    points: [{ time: 980, value: 10 }, { time: 1000, value: 12 }],
    nowSeconds: 1000, ...overrides,
  };
}

describe("clampGestureRange", () => {
  it("returns the same object when nothing changes", () => {
    const range = { min: 10, max: 20 };
    expect(clampGestureRange(range, false, undefined, undefined)).toBe(range);
    expect(clampGestureRange(range, true, 100, 5)).toBe(range);
    expect(clampGestureRange(range, false, undefined, 0)).toBe(range);
    expect(clampGestureRange(range, false, undefined, Infinity)).toBe(range);
  });

  it("widens a span below minRange about its midpoint", () => {
    expect(clampGestureRange({ min: 10, max: 12 }, false, undefined, 10)).toEqual({
      min: 6,
      max: 16,
    });
  });

  it("slides the window to respect nonNegative and maxValue", () => {
    expect(clampGestureRange({ min: -10, max: 10 }, true, undefined, undefined)).toEqual({
      min: 0,
      max: 20,
    });
    expect(clampGestureRange({ min: 90, max: 110 }, false, 100, undefined)).toEqual({
      min: 80,
      max: 100,
    });
    // A span wider than the allowed band keeps both hard bounds.
    expect(clampGestureRange({ min: -50, max: 150 }, true, 100, undefined)).toEqual({
      min: 0,
      max: 100,
    });
  });

  it("falls back to the input when the clamp cannot produce ordered bounds", () => {
    const range = { min: 0, max: 0 };
    expect(clampGestureRange(range, true, 0, undefined)).toBe(range);
  });
});

describe("gesture-owned price range in the tick", () => {
  it("applies a gesture-written range while following live", () => {
    const s = state();
    tickLiveChartEngineFrame(
      s,
      input({ viewEnd: null, viewRange: { min: 100, max: 200 }, viewRangeFollowsLive: true }),
    );
    expect(s.timestamp).toBe(1000);
    expect([s.displayMin, s.displayMax]).toEqual([100, 200]);
    expect(s.adjustedViewRangeMin).toBeNaN();
    expect(s.adjustedViewRangeMax).toBeNaN();
  });

  it("still ignores an app-written range while following live", () => {
    const s = state();
    tickLiveChartEngineFrame(s, input({ viewEnd: null, viewRange: { min: 100, max: 200 } }));
    expect(s.displayMin).toBeLessThan(10);
    expect(s.displayMax).toBeGreaterThan(12);
    expect(s.displayMax).toBeLessThan(100);
  });

  it("clamps a gesture-written range to the hard bounds and reports the adjustment", () => {
    const s = state();
    tickLiveChartEngineFrame(
      s,
      input({
        viewEnd: null,
        viewRange: { min: -10, max: 10 },
        viewRangeFollowsLive: true,
        nonNegative: true,
      }),
    );
    expect([s.displayMin, s.displayMax]).toEqual([0, 20]);
    expect([s.adjustedViewRangeMin, s.adjustedViewRangeMax]).toEqual([0, 20]);
  });

  it("applies an app-written range verbatim and reports no adjustment", () => {
    const s = state();
    tickLiveChartEngineFrame(
      s,
      input({ viewEnd: 1000, viewRange: { min: -10, max: 10 }, nonNegative: true }),
    );
    expect([s.displayMin, s.displayMax]).toEqual([-10, 10]);
    expect(s.adjustedViewRangeMin).toBeNaN();
  });

  it("publishes the fitted bounds the pan clamps against, even under an explicit range", () => {
    const fitted = state();
    tickLiveChartEngineFrame(fitted, input());
    expect(fitted.fitMin).toBe(fitted.displayMin);
    expect(fitted.fitMax).toBe(fitted.displayMax);

    const ranged = state();
    tickLiveChartEngineFrame(
      ranged,
      input({ viewEnd: null, viewRange: { min: 100, max: 200 }, viewRangeFollowsLive: true }),
    );
    expect(ranged.fitMin).toBe(fitted.fitMin);
    expect(ranged.fitMax).toBe(fitted.fitMax);
  });
});
