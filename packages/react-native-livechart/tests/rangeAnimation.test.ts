import {
  tickLiveChartEngineFrame,
  type EngineTickInput,
  type EngineTickMutable,
} from "../src/core/liveChartEngineTick";
import {
  tickLiveChartSeriesEngineFrame,
  type MultiEngineTickMutable,
} from "../src/core/liveChartSeriesEngineTick";
import type { RangeAnimationConfig } from "../src";

// Real frames catch outward snapping, wrong-direction speeds, global-smoothing
// leaks, and lost snap/drag overrides that mocked chart renders cannot observe.
type FrameOptions = Partial<Pick<EngineTickInput,
  "dt" | "smoothing" | "referenceValues" | "snap" | "yRangeScale" |
  "timeWindow" | "targetValue" | "nonNegative" | "maxValue"
>> & { rangeAnimation?: RangeAnimationConfig };

function chart(kind: "single" | "multi") {
  const points = [
    { time: 940, value: 20 },
    { time: 970, value: 30 },
    { time: 1000, value: 40 },
  ];
  const state: EngineTickMutable & MultiEngineTickMutable = {
    displayMin: 17.6, displayMax: 42.4, displayWindow: 60,
    timestamp: 1000, liveEdge: 1000, displayValue: 40, edgeValue: 40,
    displayValues: [40], opacities: [1],
    extremaMinValue: 20, extremaMaxValue: 40,
    extremaMinTime: 940, extremaMaxTime: 1000,
  };
  function tick(options: FrameOptions = {}) {
    const input = {
      dt: 1000 / 60, canvasWidth: 375, canvasHeight: 280, timeWindow: 60,
      smoothing: 0.08, exaggerate: false, referenceValue: undefined,
      nowSeconds: 1000, ...options,
    };
    if (kind === "single") {
      tickLiveChartEngineFrame(state, { targetValue: 40, points, ...input });
    } else {
      tickLiveChartSeriesEngineFrame(state, {
        series: [{ id: "outcome", data: points, value: options.targetValue ?? 40 }],
        ...input,
      });
    }
  }
  return { state, points, tick };
}

describe.each(["single", "multi"] as const)("%s range animation", (kind) => {
  it.each([undefined, {}, { animateExpansion: false }])(
    "preserves immediate expansion with config %j", (rangeAnimation) => {
      const { state, tick } = chart(kind);
      tick({ referenceValues: [80], rangeAnimation });
      expect(state.displayMin).toBeCloseTo(12.8);
      expect(state.displayMax).toBeCloseTo(87.2);
    },
  );

  it.each([
    { reference: 80, min: 12.8, max: 87.2 },
    { reference: -20, min: -27.2, max: 47.2 },
  ])("eases expansion toward $reference using inherited smoothing", ({ reference, min, max }) => {
    const { state, tick } = chart(kind);
    tick({ referenceValues: [reference], rangeAnimation: { animateExpansion: true } });
    expect(state.displayMin).toBeCloseTo(17.6 + (min - 17.6) * 0.08);
    expect(state.displayMax).toBeCloseTo(42.4 + (max - 42.4) * 0.08);
  });

  it("uses each direction's speed without changing value/window tracking or recorded data", () => {
    const { state, points, tick } = chart(kind);
    state.displayMin = 0;
    const original = JSON.stringify(points);
    tick({
      referenceValues: [80], timeWindow: 120, targetValue: 50,
      rangeAnimation: { animateExpansion: true, expansionSmoothing: 0.25, contractionSmoothing: 0.5 },
    });
    expect(state.displayMin).toBeCloseTo(6.4);
    expect(state.displayMax).toBeCloseTo(53.6);
    expect(state.displayWindow).toBeCloseTo(64.8);
    const baseline = chart(kind);
    baseline.state.displayMin = 0;
    baseline.tick({ referenceValues: [80], timeWindow: 120, targetValue: 50 });
    expect(kind === "single" ? state.displayValue : state.displayValues[0]).toBe(
      kind === "single" ? baseline.state.displayValue : baseline.state.displayValues[0],
    );
    expect(JSON.stringify(points)).toBe(original);
  });

  it("returns within 300 ms without a JS timer, including a cancelled/repeated hold", () => {
    const { state, tick } = chart(kind);
    const rangeAnimation = {
      animateExpansion: true, expansionSmoothing: 0.08,
      contractionSmoothing: 1 - 0.001 ** (1 / 18),
    };
    for (let i = 0; i < 120; i++) tick({ referenceValues: [80], rangeAnimation });
    expect(state.displayMax).toBeCloseTo(87.2, 2);
    const expanded = state.displayMax;
    tick({ rangeAnimation: { ...rangeAnimation, animateExpansion: false } });
    expect(state.displayMax).toBeLessThan(expanded);
    expect(state.displayMax).toBeGreaterThan(42.4);
    tick({ referenceValues: [80], rangeAnimation });
    expect(state.displayMax).toBeGreaterThan(42.4);
    for (let i = 0; i < 18; i++) tick({ rangeAnimation });
    expect(state.displayMax - 42.4).toBeLessThan(0.045);
    expect(state.displayMin).toBeCloseTo(17.6, 2);
  });

  it("inherits contraction smoothing when the override is omitted", () => {
    const { state, tick } = chart(kind);
    state.displayMax = 87.2;
    tick({ rangeAnimation: { animateExpansion: true } });
    expect(state.displayMax).toBeCloseTo(83.616);
  });

  it.each([
    { snap: true }, { smoothing: 1 }, { yRangeScale: 2 },
  ])("preserves instant framing for %j", (override) => {
    const { state, tick } = chart(kind);
    tick({
      referenceValues: [80], ...override,
      rangeAnimation: { animateExpansion: true, expansionSmoothing: 0, contractionSmoothing: 0 },
    });
    expect(state.displayMin).toBeCloseTo(override.yRangeScale === 2 ? -24.4 : 12.8);
    expect(state.displayMax).toBeCloseTo(override.yRangeScale === 2 ? 124.4 : 87.2);
  });

  it("uses elapsed time consistently at 30 and 60 fps", () => {
    const sixty = chart(kind);
    const thirty = chart(kind);
    const options = { referenceValues: [80], rangeAnimation: { animateExpansion: true, expansionSmoothing: 0.25 } };
    for (let i = 0; i < 2; i++) sixty.tick(options);
    thirty.tick({ ...options, dt: 1000 / 30 });
    expect(thirty.state.displayMax).toBeCloseTo(sixty.state.displayMax);
    expect(thirty.state.displayMin).toBeCloseTo(sixty.state.displayMin);
  });

  it("retains floor and ceiling constraints", () => {
    const { state, tick } = chart(kind);
    tick({
      referenceValues: [-20, 80], nonNegative: true, maxValue: 60,
      rangeAnimation: { animateExpansion: true, expansionSmoothing: 0.5 },
    });
    expect(state.displayMin).toBeCloseTo(8.8);
    expect(state.displayMax).toBeCloseTo(51.2);
  });

  it.each([NaN, Infinity, -Infinity])("inherits smoothing for a non-finite speed %s", (speed) => {
    const { state, tick } = chart(kind);
    state.displayMin = 0;
    tick({
      referenceValues: [80],
      rangeAnimation: { animateExpansion: true, expansionSmoothing: speed, contractionSmoothing: speed },
    });
    expect(state.displayMin).toBeCloseTo(1.024);
    expect(state.displayMax).toBeCloseTo(45.984);
  });

  it.each([{ speed: -1, max: 42.4 }, { speed: 2, max: 87.2 }])(
    "clamps finite speed $speed", ({ speed, max }) => {
      const { state, tick } = chart(kind);
      tick({ referenceValues: [80], rangeAnimation: { animateExpansion: true, expansionSmoothing: speed } });
      expect(state.displayMax).toBeCloseTo(max);
    },
  );
});
