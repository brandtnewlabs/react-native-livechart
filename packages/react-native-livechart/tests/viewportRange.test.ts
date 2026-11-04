import {
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
    nowSeconds: 1000, allowFutureViewEnd: true, ...overrides,
  };
}

it.each([900, 1100])("uses exact bounds in empty past/future space at %s", (viewEnd) => {
  const s = state();
  tickLiveChartEngineFrame(s, input({ viewEnd, viewRange: { min: 100, max: 200 }, smoothing: 0.08 }));
  expect(s.timestamp).toBe(viewEnd);
  expect([s.displayMin, s.displayMax]).toEqual([100, 200]);
  expect(s.extremaMinValue).toBeNaN();
  expect(s.extremaMaxValue).toBeNaN();
});

it("uses explicit bounds over automatic fit, clamps, and manual scaling", () => {
  const s = state();
  tickLiveChartEngineFrame(s, input({
    viewEnd: 1000, viewRange: { min: -10, max: 100 },
    nonNegative: true, maxValue: 30, minRange: 200, yRangeScale: 2,
  }));
  expect([s.displayMin, s.displayMax]).toEqual([-10, 100]);
});

it("returns to live automatic fitting when end is cleared", () => {
  const s = state();
  tickLiveChartEngineFrame(s, input({ viewEnd: 1100, viewRange: { min: 100, max: 200 } }));
  tickLiveChartEngineFrame(s, input({ viewEnd: null, viewRange: { min: 100, max: 200 } }));
  expect(s.timestamp).toBe(1000);
  expect(s.displayMin).toBeLessThan(10);
  expect(s.displayMax).toBeGreaterThan(12);
  expect(s.displayMax).toBeLessThan(100);
});

it.each([null, undefined])("returns to automatic fitting when range is %s", (viewRange) => {
  const s = state();
  tickLiveChartEngineFrame(s, input({ viewEnd: 1000, viewRange: { min: 100, max: 200 } }));
  tickLiveChartEngineFrame(s, input({ viewEnd: 1000, viewRange }));
  expect(s.timestamp).toBe(1000);
  expect(s.displayMin).toBeLessThan(10);
  expect(s.displayMax).toBeGreaterThan(12);
  expect(s.displayMax).toBeLessThan(100);
});

it.each([
  { min: NaN, max: 200 }, { min: 100, max: Infinity },
  { min: 200, max: 100 }, { min: 100, max: 100 },
  { min: -Number.MAX_VALUE, max: Number.MAX_VALUE },
])("falls back to automatic fitting for invalid bounds %p", (viewRange) => {
  const s = state();
  tickLiveChartEngineFrame(s, input({ viewEnd: 1000, viewRange }));
  expect(s.displayMin).toBeLessThan(10);
  expect(s.displayMax).toBeGreaterThan(12);
  expect(s.displayMax).toBeLessThan(100);
});

it("retains the history guard before the first sample without valid bounds", () => {
  const s = state();
  tickLiveChartEngineFrame(s, input({ viewEnd: 900, viewRange: { min: 10, max: 10 } }));
  expect(s.timestamp).toBe(1000);
});
