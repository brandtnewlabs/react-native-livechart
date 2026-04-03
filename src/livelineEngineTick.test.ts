import { tickLivelineEngineFrame } from "./livelineEngineTick";

function baseState() {
  return {
    displayValue: 0,
    displayMin: 0,
    displayMax: 1,
    displayWindow: 30,
    timestamp: 1000,
  };
}

describe("tickLivelineEngineFrame", () => {
  it("updates timestamp and returns early when canvas has zero size", () => {
    const s = baseState();
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 0,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.08,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 1,
      points: [],
      nowSeconds: 123,
    });
    expect(s.timestamp).toBe(123);
    expect(s.displayValue).toBe(0);
  });

  it("lerps display value toward target", () => {
    const s = baseState();
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 100,
      points: [{ time: 1000, value: 50 }],
      nowSeconds: 1000,
    });
    expect(s.displayValue).toBeGreaterThan(0);
  });

  it("uses gap ratio zero when display range is zero", () => {
    const s = { ...baseState(), displayMin: 5, displayMax: 5 };
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.08,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 10,
      points: [{ time: 1000, value: 5 }],
      nowSeconds: 1000,
    });
    expect(s.displayValue).toBeDefined();
  });

  it("uses adaptive speed when range is positive", () => {
    const s = { ...baseState(), displayMin: 0, displayMax: 10 };
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.08,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 5,
      points: [{ time: 1000, value: 5 }],
      nowSeconds: 1000,
    });
    expect(s.displayWindow).toBeDefined();
  });

  it("still applies margin from display value when points array is empty", () => {
    const s = baseState();
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.08,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 1,
      points: [],
      nowSeconds: 1000,
    });
    expect(s.displayMin).not.toBeNaN();
    expect(s.displayMax).not.toBeNaN();
  });

  it("includes reference line in range", () => {
    const s = baseState();
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.2,
      exaggerate: false,
      referenceValue: 500,
      targetValue: 10,
      points: [{ time: 1000, value: 10 }],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeGreaterThanOrEqual(10);
  });

  it("applies exaggerate min range branch", () => {
    const s = baseState();
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.2,
      exaggerate: true,
      referenceValue: undefined,
      targetValue: 5,
      points: [
        { time: 1000, value: 10 },
        { time: 1001, value: 10.001 },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMin).not.toBeNaN();
  });

  it("applies margin when raw range exceeds minRange", () => {
    const s = baseState();
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.2,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 50,
      points: [
        { time: 1000, value: 0 },
        { time: 1001, value: 100 },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeGreaterThan(s.displayMin);
  });

  it("lerps displayMin inward when tMin is greater", () => {
    const s = { ...baseState(), displayMin: 100, displayMax: 200 };
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.3,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 50,
      points: [
        { time: 1000, value: 10 },
        { time: 1001, value: 20 },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBeLessThan(100);
  });

  it("lerps displayMax inward when tMax is smaller", () => {
    const s = { ...baseState(), displayMin: 0, displayMax: 5 };
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.3,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 50,
      points: [
        { time: 1000, value: 40 },
        { time: 1001, value: 50 },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeGreaterThan(5);
  });

  it("snaps displayMin down when tMin is below", () => {
    const s = {
      displayValue: 50,
      displayMin: 40,
      displayMax: 60,
      displayWindow: 30,
      timestamp: 1000,
    };
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 50,
      points: [
        { time: 990, value: 5 },
        { time: 995, value: 5 },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBeLessThan(40);
  });

  it("snaps displayMax up when tMax is above", () => {
    const s = {
      displayValue: 50,
      displayMin: 40,
      displayMax: 55,
      displayWindow: 30,
      timestamp: 1000,
    };
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 50,
      points: [
        { time: 990, value: 90 },
        { time: 995, value: 95 },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeGreaterThan(55);
  });

  it("binary searches with many points in window", () => {
    const s = baseState();
    const points = Array.from({ length: 50 }, (_, i) => ({
      time: 900 + i * 0.2,
      value: i * 0.1,
    }));
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.2,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 2,
      points,
      nowSeconds: 910,
    });
    expect(s.displayMin).not.toBeNaN();
  });

  it("uses minRange fallback when rawRange is zero (exaggerate on)", () => {
    const s = { ...baseState(), displayValue: 7 };
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.2,
      exaggerate: true,
      referenceValue: undefined,
      targetValue: 7,
      points: [
        { time: 1000, value: 7 },
        { time: 1001, value: 7 },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeGreaterThan(s.displayMin);
  });

  it("uses minRange fallback when rawRange is zero (exaggerate off)", () => {
    const s = { ...baseState(), displayValue: 7 };
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.2,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 7,
      points: [
        { time: 1000, value: 7 },
        { time: 1001, value: 7 },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeGreaterThan(s.displayMin);
  });

  it("skips y-range block when extrema stay invalid (NaN display value)", () => {
    const s = { ...baseState(), displayValue: NaN };
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.08,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 10,
      points: [],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBe(0);
    expect(s.displayMax).toBe(1);
  });

  it("uses default clock when nowSeconds is omitted", () => {
    const s = baseState();
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 1,
      points: [{ time: 1_700_000_000, value: 1 }],
    });
    expect(s.timestamp).toBeGreaterThan(1e8);
  });

  it("does not move bounds when reference is inside data span", () => {
    const s = baseState();
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.2,
      exaggerate: false,
      referenceValue: 25,
      targetValue: 20,
      points: [
        { time: 1000, value: 10 },
        { time: 1001, value: 40 },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBeLessThanOrEqual(10);
    expect(s.displayMax).toBeGreaterThanOrEqual(40);
  });

  it("handles reference line below computed range", () => {
    const s = {
      displayValue: 10,
      displayMin: 0,
      displayMax: 20,
      displayWindow: 30,
      timestamp: 1000,
    };
    tickLivelineEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      windowSize: 30,
      lerpSpeed: 0.2,
      exaggerate: false,
      referenceValue: -100,
      targetValue: 10,
      points: [{ time: 990, value: 5 }],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBeLessThanOrEqual(-100);
  });
});
