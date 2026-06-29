import { tickLiveChartEngineFrame } from "../src/core/liveChartEngineTick";

function baseState() {
  return {
    displayValue: 0,
    displayMin: 0,
    displayMax: 1,
    displayWindow: 30,
    timestamp: 1000,
    liveEdge: 0,
    edgeValue: 0,
    extremaMinValue: NaN,
    extremaMaxValue: NaN,
    extremaMinTime: NaN,
    extremaMaxTime: NaN,
  };
}

describe("tickLiveChartEngineFrame", () => {
  it("updates timestamp and returns early when canvas has zero size", () => {
    const s = baseState();
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 0,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.08,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.08,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.08,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.08,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.2,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.2,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.2,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.3,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.3,
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
      ...baseState(),
      displayValue: 50,
      displayMin: 40,
      displayMax: 60,
    };
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
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
      ...baseState(),
      displayValue: 50,
      displayMin: 40,
      displayMax: 55,
    };
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.2,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.2,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.2,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.08,
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
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 1,
      points: [{ time: 1_700_000_000, value: 1 }],
    });
    expect(s.timestamp).toBeGreaterThan(1e8);
  });

  it("does not move bounds when reference is inside data span", () => {
    const s = baseState();
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.2,
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
      ...baseState(),
      displayValue: 10,
      displayMin: 0,
      displayMax: 20,
    };
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.2,
      exaggerate: false,
      referenceValue: -100,
      targetValue: 10,
      points: [{ time: 990, value: 5 }],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBeLessThanOrEqual(-100);
  });

  it("includes referenceValues array in range", () => {
    const s = baseState();
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.2,
      exaggerate: false,
      referenceValue: undefined,
      referenceValues: [500, -100],
      targetValue: 10,
      points: [{ time: 1000, value: 10 }],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeGreaterThan(100);
    expect(s.displayMin).toBeLessThan(0);
  });

  it("clamps the lower bound to 0 when nonNegative", () => {
    const s = baseState();
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      nonNegative: true,
      targetValue: 0,
      points: [
        { time: 1000, value: 0 },
        { time: 1001, value: 0 },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBe(0);
  });

  it("caps the upper bound at maxValue", () => {
    const s = baseState();
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      maxValue: 100,
      targetValue: 50,
      points: [{ time: 1000, value: 200 }],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeLessThanOrEqual(100);
  });

  it("applies nowOverride and windowBuffer to the timestamp", () => {
    const s = baseState();
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.08,
      exaggerate: false,
      referenceValue: undefined,
      nowOverride: 5000,
      windowBuffer: 0.1,
      targetValue: 1,
      points: [{ time: 5000, value: 1 }],
      nowSeconds: 1000,
    });
    // timestamp = nowOverride(5000) + windowBuffer(0.1) * timeWindow(30) = 5003
    expect(s.timestamp).toBe(5003);
  });

  it("freezes timestamp when paused=true", () => {
    const s = { ...baseState(), timestamp: 999 };
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.08,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 1,
      points: [],
      nowSeconds: 5000,
      paused: true,
    });
    expect(s.timestamp).toBe(999);
  });

  it("still lerps displayWindow when paused=true", () => {
    const s = { ...baseState(), displayWindow: 30 };
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 60,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 1,
      points: [],
      nowSeconds: 1001,
      paused: true,
    });
    expect(s.displayWindow).toBeGreaterThan(30);
    expect(s.displayWindow).toBeLessThan(60);
  });

  // ── Pinch-zoom (viewWindow) ──────────────────────────────────────────────
  describe("pinch-zoom", () => {
    function zinput(
      extra: Partial<Parameters<typeof tickLiveChartEngineFrame>[1]>,
    ) {
      return {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 0.5,
        exaggerate: false,
        referenceValue: undefined,
        targetValue: 1,
        points: [],
        nowSeconds: 1000,
        ...extra,
      };
    }

    it("eases displayWindow toward viewWindow when set (zoom in)", () => {
      const s = { ...baseState(), displayWindow: 30 };
      tickLiveChartEngineFrame(s, zinput({ viewWindow: 10 }));
      // lerps from 30 toward 10 ⇒ between the two, below the configured 30.
      expect(s.displayWindow).toBeLessThan(30);
      expect(s.displayWindow).toBeGreaterThan(10);
    });

    it("eases displayWindow toward viewWindow when set (zoom out)", () => {
      const s = { ...baseState(), displayWindow: 30 };
      tickLiveChartEngineFrame(s, zinput({ viewWindow: 90 }));
      expect(s.displayWindow).toBeGreaterThan(30);
      expect(s.displayWindow).toBeLessThan(90);
    });

    it("follows the configured timeWindow when viewWindow is null/undefined", () => {
      const sNull = { ...baseState(), displayWindow: 10 };
      tickLiveChartEngineFrame(sNull, zinput({ viewWindow: null }));
      expect(sNull.displayWindow).toBeGreaterThan(10); // toward 30

      const sUndef = { ...baseState(), displayWindow: 10 };
      tickLiveChartEngineFrame(sUndef, zinput({}));
      expect(sUndef.displayWindow).toBe(sNull.displayWindow);
    });

    it("zoom and pan compose: freezes the right edge AND narrows the window", () => {
      const s = { ...baseState(), displayWindow: 30 };
      tickLiveChartEngineFrame(s, zinput({ viewEnd: 950, viewWindow: 10 }));
      expect(s.timestamp).toBe(950); // right edge frozen by the pan
      expect(s.displayWindow).toBeLessThan(30); // window narrowed by the zoom
    });
  });

  // ── Time-scroll (viewEnd / liveEdge) ─────────────────────────────────────
  describe("time-scroll", () => {
    function input(extra: Partial<Parameters<typeof tickLiveChartEngineFrame>[1]>) {
      return {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 0.08,
        exaggerate: false,
        referenceValue: undefined,
        targetValue: 1,
        points: [],
        nowSeconds: 1000,
        ...extra,
      };
    }

    it("exposes the live edge (now + windowBuffer*timeWindow) each frame", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, input({ windowBuffer: 0.1 }));
      // liveEdge = 1000 + 0.1 * 30 = 1003; following ⇒ timestamp tracks it.
      expect(s.liveEdge).toBe(1003);
      expect(s.timestamp).toBe(1003);
    });

    it("freezes the right edge at viewEnd when scrolled back in time", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, input({ viewEnd: 950 }));
      expect(s.timestamp).toBe(950); // frozen at the requested absolute time
      expect(s.liveEdge).toBe(1000); // live edge keeps tracking "now"
    });

    it("follows the live edge once viewEnd catches up to it", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, input({ viewEnd: 1000 })); // == liveEdge
      expect(s.timestamp).toBe(1000);
      const s2 = baseState();
      tickLiveChartEngineFrame(s2, input({ viewEnd: 1100 })); // past liveEdge
      expect(s2.timestamp).toBe(1000);
    });

    it("treats viewEnd null as following", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, input({ viewEnd: null }));
      expect(s.timestamp).toBe(1000);
    });

    it("lets viewEnd override paused (pan wins over freeze)", () => {
      const s = { ...baseState(), timestamp: 999 };
      tickLiveChartEngineFrame(s, input({ viewEnd: 950, paused: true }));
      expect(s.timestamp).toBe(950);
    });

    // #164: the "return to live" glide. With viewEnd cleared, the right edge
    // interpolates from returnFrom to the live edge by returnT (0→1).
    it("starts the return glide at the frozen edge (returnT=0)", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, input({ returnFrom: 950, returnT: 0 }));
      expect(s.timestamp).toBe(950); // lerp(950, 1000, 0)
    });

    it("eases the right edge toward live mid-glide (returnT=0.5)", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, input({ returnFrom: 950, returnT: 0.5 }));
      expect(s.timestamp).toBe(975); // lerp(950, 1000, 0.5)
    });

    it("lands exactly on the live edge when the glide completes (returnT=1)", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, input({ returnFrom: 950, returnT: 1 }));
      expect(s.timestamp).toBe(1000); // pinned to live, no end-snap
    });

    it("a frozen viewEnd still wins over an in-flight glide", () => {
      // While actually scrolled back, viewEnd takes precedence over returnT.
      const s = baseState();
      tickLiveChartEngineFrame(
        s,
        input({ viewEnd: 950, returnFrom: 900, returnT: 0.5 }),
      );
      expect(s.timestamp).toBe(950);
    });

    // #164: a frozen edge stranded before the first data point follows live
    // instead of rendering an empty plot (the differing-span repro).
    it("follows live when the frozen edge precedes the first line point", () => {
      const s = baseState();
      tickLiveChartEngineFrame(
        s,
        input({ viewEnd: 950, points: [{ time: 980, value: 1 }] }),
      );
      expect(s.timestamp).toBe(1000); // 950 < firstTime 980 ⇒ follow live
    });

    it("freezes when the edge sits at or after the first line point", () => {
      const s = baseState();
      tickLiveChartEngineFrame(
        s,
        input({ viewEnd: 950, points: [{ time: 940, value: 1 }] }),
      );
      expect(s.timestamp).toBe(950); // 950 >= firstTime 940 ⇒ frozen
    });

    it("follows live when the frozen edge precedes the first candle", () => {
      const s = baseState();
      tickLiveChartEngineFrame(
        s,
        input({
          viewEnd: 950,
          mode: "candle",
          candles: [{ time: 980, open: 1, high: 2, low: 0.5, close: 1.5 }],
          liveCandle: null,
        }),
      );
      expect(s.timestamp).toBe(1000); // 950 < firstCandle 980 ⇒ follow live
    });

    // edgeValue — the price at the window's right edge (for a followViewEdge badge).
    it("edgeValue tracks the live value while following", () => {
      const s = baseState();
      tickLiveChartEngineFrame(
        s,
        input({
          targetValue: 50,
          points: [{ time: 1000, value: 50 }],
          smoothing: 0.5,
        }),
      );
      expect(s.edgeValue).toBe(s.displayValue);
    });

    it("edgeValue tracks the last visible point when scrolled back (line)", () => {
      const s = { ...baseState(), edgeValue: 0, displayValue: 999 };
      tickLiveChartEngineFrame(
        s,
        input({
          viewEnd: 950,
          smoothing: 1,
          points: [
            { time: 940, value: 42 }, // last visible (<= viewEnd 950)
            { time: 1010, value: 777 }, // future — excluded from the edge
          ],
        }),
      );
      expect(s.edgeValue).toBeGreaterThan(0);
      expect(s.edgeValue).toBeLessThanOrEqual(42); // toward 42, not 999 / 777
    });

    it("edgeValue tracks the last visible candle close when scrolled back", () => {
      const s = { ...baseState(), edgeValue: 0, displayValue: 999 };
      tickLiveChartEngineFrame(
        s,
        input({
          viewEnd: 950,
          smoothing: 1,
          mode: "candle",
          candles: [
            { time: 940, open: 40, high: 45, low: 38, close: 42 },
            { time: 1010, open: 700, high: 800, low: 600, close: 777 },
          ],
          liveCandle: null,
        }),
      );
      expect(s.edgeValue).toBeGreaterThan(0);
      expect(s.edgeValue).toBeLessThanOrEqual(42);
    });
  });

  // ── Extrema tracking (for "extrema"-positioned axis labels) ──────────────
  describe("extrema tracking", () => {
    it("records the value + time of the lowest and highest point (line mode)", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 0.2,
        exaggerate: false,
        referenceValue: undefined,
        targetValue: 30,
        points: [
          { time: 980, value: 30 },
          { time: 985, value: 10 }, // the low
          { time: 990, value: 55 }, // the high
          { time: 995, value: 40 },
        ],
        nowSeconds: 1000,
      });
      expect(s.extremaMinValue).toBe(10);
      expect(s.extremaMinTime).toBe(985);
      expect(s.extremaMaxValue).toBe(55);
      expect(s.extremaMaxTime).toBe(990);
    });

    it("ignores the live value / reference when picking extrema", () => {
      const s = { ...baseState(), displayValue: 999 };
      tickLiveChartEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 0.2,
        exaggerate: false,
        referenceValue: -999,
        targetValue: 50,
        points: [{ time: 990, value: 42 }],
        nowSeconds: 1000,
      });
      // The display value (999) and reference (-999) widen the Y range but are
      // NOT data points, so the extrema stay on the single real point.
      expect(s.extremaMinValue).toBe(42);
      expect(s.extremaMaxValue).toBe(42);
      expect(s.extremaMinTime).toBe(990);
      expect(s.extremaMaxTime).toBe(990);
    });

    it("reports NaN extrema when the window holds no points (line mode)", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 0.2,
        exaggerate: false,
        referenceValue: undefined,
        targetValue: 1,
        points: [],
        nowSeconds: 1000,
      });
      expect(s.extremaMinValue).toBeNaN();
      expect(s.extremaMaxValue).toBeNaN();
      expect(s.extremaMinTime).toBeNaN();
      expect(s.extremaMaxTime).toBeNaN();
    });

    it("tracks extrema from candle low/high + the live candle (candle mode)", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 1,
        exaggerate: false,
        referenceValue: undefined,
        targetValue: 105,
        points: [],
        nowSeconds: 1000,
        mode: "candle",
        candles: [{ time: 980, open: 100, high: 120, low: 80, close: 110 }],
        liveCandle: { time: 995, open: 110, high: 130, low: 70, close: 125 },
      });
      // Lowest low (70) is on the live candle; highest high (130) too.
      expect(s.extremaMinValue).toBe(70);
      expect(s.extremaMinTime).toBe(995);
      expect(s.extremaMaxValue).toBe(130);
      expect(s.extremaMaxTime).toBe(995);
    });
  });

  // ── Candle mode ────────────────────────────────────────────────────────
  describe("candle mode Y range", () => {
    it("computes displayMin/Max from candle low/high", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 1,
        exaggerate: false,
        referenceValue: undefined,
        targetValue: 105,
        points: [],
        nowSeconds: 1000,
        mode: "candle",
        candles: [{ time: 980, open: 100, high: 120, low: 80, close: 110 }],
        liveCandle: null,
      });
      expect(s.displayMin).toBeLessThan(80);
      expect(s.displayMax).toBeGreaterThan(120);
    });

    it("includes liveCandle in Y range", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 1,
        exaggerate: false,
        referenceValue: undefined,
        targetValue: 105,
        points: [],
        nowSeconds: 1000,
        mode: "candle",
        candles: [{ time: 980, open: 100, high: 110, low: 90, close: 105 }],
        liveCandle: { time: 1000, open: 105, high: 130, low: 85, close: 120 },
      });
      expect(s.displayMin).toBeLessThan(85);
      expect(s.displayMax).toBeGreaterThan(130);
    });

    it("targets liveCandle.close for displayValue", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 1,
        exaggerate: false,
        referenceValue: undefined,
        targetValue: 50,
        points: [],
        nowSeconds: 1000,
        mode: "candle",
        candles: [],
        liveCandle: { time: 990, open: 100, high: 120, low: 80, close: 115 },
      });
      expect(s.displayValue).toBeGreaterThan(0);
    });

    it("uses line mode Y range when mode is 'line'", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 1,
        exaggerate: false,
        referenceValue: undefined,
        targetValue: 50,
        points: [{ time: 1000, value: 50 }],
        nowSeconds: 1000,
        mode: "line",
        candles: [{ time: 980, open: 100, high: 200, low: 10, close: 105 }],
      });
      expect(s.displayMax).toBeLessThan(200);
    });

    it("excludes candles before the visible window", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 1,
        exaggerate: false,
        referenceValue: undefined,
        targetValue: 105,
        points: [],
        nowSeconds: 1000,
        mode: "candle",
        candles: [
          { time: 900, open: 1, high: 500, low: 0, close: 2 },
          { time: 990, open: 100, high: 110, low: 90, close: 105 },
        ],
        liveCandle: null,
      });
      expect(s.displayMax).toBeLessThan(500);
    });

    it("excludes future candles beyond timestamp", () => {
      const s = baseState();
      tickLiveChartEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 1,
        exaggerate: false,
        referenceValue: undefined,
        targetValue: 105,
        points: [],
        nowSeconds: 1000,
        mode: "candle",
        candles: [
          { time: 990, open: 100, high: 110, low: 90, close: 105 },
          { time: 1010, open: 105, high: 999, low: 1, close: 500 },
        ],
        liveCandle: null,
      });
      expect(s.displayMax).toBeLessThan(999);
    });
  });
});

describe("tickLiveChartEngineFrame adaptiveSpeedBoost", () => {
  function run(adaptiveSpeedBoost?: number) {
    const s = {
      displayValue: 0,
      displayMin: 0,
      displayMax: 10,
      displayWindow: 30,
      timestamp: 1000,
      liveEdge: 0,
      edgeValue: 0,
      extremaMinValue: NaN,
      extremaMaxValue: NaN,
      extremaMinTime: NaN,
      extremaMaxTime: NaN,
    };
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.08,
      adaptiveSpeedBoost,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 5,
      points: [{ time: 1000, value: 5 }],
      nowSeconds: 1000,
    });
    return s.displayValue;
  }

  it("converges faster with a larger boost", () => {
    const none = run(0);
    const big = run(1);
    expect(big).toBeGreaterThan(none);
  });

  it("defaults to the motion-metrics boost when omitted", () => {
    // Omitted (0.12 default) sits between no boost (0) and a large boost (1).
    const omitted = run(undefined);
    expect(omitted).toBeGreaterThan(run(0));
    expect(omitted).toBeLessThan(run(1));
  });
});

describe("tickLiveChartEngineFrame — snap (one-shot settle)", () => {
  it("snaps window, range, and value straight to target in one frame", () => {
    // Window far from the target (60→30) and range far from the data (0..1
    // around a 100-value point): with snap the frame lands exactly, no easing.
    const s = {
      ...baseState(),
      displayValue: 0,
      displayMin: 0,
      displayMax: 1,
      displayWindow: 60,
    };
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.08,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 100,
      points: [{ time: 1000, value: 100 }],
      nowSeconds: 1000,
      snap: true,
    });
    expect(s.displayValue).toBe(100);
    expect(s.displayWindow).toBe(30);
    // Range jumps to bracket the data point (≈95..105) instead of easing from 0..1.
    expect(s.displayMin).toBeGreaterThan(1);
    expect(s.displayMin).toBeLessThanOrEqual(100);
    expect(s.displayMax).toBeGreaterThanOrEqual(100);
  });

  it("snaps a shrinking range/window that would otherwise lerp (the zoom-in case)", () => {
    // Without snap, displayMax shrinking from 1000 and displayWindow from 60
    // only ease a fraction per frame; with snap they reach target immediately.
    const input = {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.08,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 100,
      points: [{ time: 1000, value: 100 }],
      nowSeconds: 1000,
    };
    const eased = {
      ...baseState(),
      displayValue: 100,
      displayMin: 0,
      displayMax: 1000,
      displayWindow: 60,
    };
    tickLiveChartEngineFrame(eased, input);
    expect(eased.displayWindow).toBeGreaterThan(30); // still easing toward 30
    expect(eased.displayMax).toBeGreaterThan(200); // still far from ≈105

    const snapped = {
      ...baseState(),
      displayValue: 100,
      displayMin: 0,
      displayMax: 1000,
      displayWindow: 60,
    };
    tickLiveChartEngineFrame(snapped, { ...input, snap: true });
    expect(snapped.displayWindow).toBe(30);
    expect(snapped.displayMax).toBeLessThan(200); // snapped down to bracket the data
  });

  it("snaps edgeValue to the right-edge value when scrolled back", () => {
    // Scrolled back (viewEnd in the past): edgeValue tracks the last visible
    // point's value. With snap it jumps there instead of easing from 0.
    const s = { ...baseState(), edgeValue: 0, displayValue: 50 };
    tickLiveChartEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.08,
      exaggerate: false,
      referenceValue: undefined,
      targetValue: 50,
      points: [
        { time: 960, value: 20 },
        { time: 980, value: 40 },
      ],
      nowSeconds: 1000,
      viewEnd: 985, // < liveEdge(1000) and ≥ firstDataTime(960) → scrolled back
      snap: true,
    });
    expect(s.timestamp).toBe(985);
    expect(s.edgeValue).toBe(40);
  });
});
