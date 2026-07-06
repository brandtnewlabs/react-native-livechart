import { tickLiveChartSeriesEngineFrame } from "../src/core/liveChartSeriesEngineTick";

describe("tickLiveChartSeriesEngineFrame", () => {
  function baseMulti(): {
    displayMin: number;
    displayMax: number;
    displayWindow: number;
    timestamp: number;
    liveEdge: number;
    displayValues: number[];
    opacities: number[];
    extremaMinValue: number;
    extremaMaxValue: number;
    extremaMinTime: number;
    extremaMaxTime: number;
  } {
    return {
      displayMin: 0,
      displayMax: 100,
      displayWindow: 30,
      timestamp: 1000,
      liveEdge: 0,
      displayValues: [],
      opacities: [],
      extremaMinValue: NaN,
      extremaMaxValue: NaN,
      extremaMinTime: NaN,
      extremaMaxTime: NaN,
    };
  }

  it("lerps per-series tips and updates combined Y-range", () => {
    const s = baseMulti();
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [
            { time: 980, value: 10 },
            { time: 1000, value: 12 },
          ],
          value: 20,
          color: "#00f",
        },
        {
          id: "b",
          data: [
            { time: 980, value: 50 },
            { time: 1000, value: 55 },
          ],
          value: 60,
          color: "#f00",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayValues.length).toBe(2);
    expect(s.displayValues[0]).toBeGreaterThan(10);
    expect(s.displayMax).toBeGreaterThanOrEqual(55);
  });

  it("includes referenceValues array, clamps with nonNegative + maxValue", () => {
    const s = baseMulti();
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      referenceValues: [-50, 500],
      nonNegative: true,
      maxValue: 120,
      series: [
        {
          id: "a",
          data: [{ time: 1000, value: 10 }],
          value: 10,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBe(0);
    expect(s.displayMax).toBeLessThanOrEqual(120);
  });

  it("applies nowOverride and windowBuffer to the timestamp", () => {
    const s = baseMulti();
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 60,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      nowOverride: 2000,
      windowBuffer: 0.05,
      series: [{ id: "a", data: [{ time: 2000, value: 1 }], value: 1 }],
      nowSeconds: 1000,
    });
    // 2000 + 0.05 * 60 = 2003
    expect(s.timestamp).toBe(2003);
  });

  it("excludes hidden series from Y-range", () => {
    const s = baseMulti();
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 5 }],
          value: 5,
          visible: false,
          color: "#00f",
        },
        {
          id: "b",
          data: [{ time: 980, value: 80 }],
          value: 80,
          color: "#f00",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBeLessThanOrEqual(80);
    expect(s.displayMax).toBeGreaterThanOrEqual(80);
  });

  it("returns early when canvas size is zero", () => {
    const s = baseMulti();
    s.displayValues = [1, 2];
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 0,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        { id: "a", data: [], value: 1, color: "#00f" },
        { id: "b", data: [], value: 2, color: "#f00" },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayValues).toEqual([1, 2]);
  });

  it("truncates displayValues when series count shrinks", () => {
    const s = baseMulti();
    s.displayValues = [1, 2, 3];
    s.opacities = [1, 1, 1];
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.99,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 10 }],
          value: 10,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayValues.length).toBe(1);
    expect(s.opacities.length).toBe(1);
  });

  it("expands Y-range with referenceValue outside data span", () => {
    const s = baseMulti();
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.99,
      exaggerate: false,
      referenceValue: 200,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 10 }],
          value: 10,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeGreaterThanOrEqual(200);
    expect(s.displayMin).toBeLessThanOrEqual(10);
  });

  it("lerps displayMin down when tMin stays above previous displayMin", () => {
    const s = baseMulti();
    s.displayMin = 0;
    s.displayMax = 500;
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.2,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 80 }],
          value: 80,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBeGreaterThan(0);
    expect(s.displayMin).toBeLessThan(80);
  });

  it("lerps displayMax up when tMax stays below previous displayMax", () => {
    const s = baseMulti();
    s.displayMin = 0;
    s.displayMax = 500;
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.2,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 20 }],
          value: 20,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeLessThan(500);
    expect(s.displayMax).toBeGreaterThan(20);
  });

  it("snaps displayMin down immediately when tMin drops below range", () => {
    const s = baseMulti();
    s.displayMin = 100;
    s.displayMax = 200;
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 5 }],
          value: 5,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBeLessThanOrEqual(5);
  });

  it("does not advance timestamp when paused", () => {
    const s = baseMulti();
    s.timestamp = 500;
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [{ time: 480, value: 10 }],
          value: 10,
          color: "#00f",
        },
      ],
      nowSeconds: 999,
      paused: true,
    });
    expect(s.timestamp).toBe(500);
  });

  it("uses zero gap ratio when display range is flat", () => {
    const s = baseMulti();
    s.displayMin = 50;
    s.displayMax = 50;
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 50 }],
          value: 100,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayValues[0]).toBeGreaterThan(50);
  });

  it("pulls reference line below data into tMin", () => {
    const s = baseMulti();
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.99,
      exaggerate: false,
      referenceValue: 3,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 40 }],
          value: 40,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBeLessThanOrEqual(3);
  });

  it("pulls reference line above data into tMax", () => {
    const s = baseMulti();
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.99,
      exaggerate: false,
      referenceValue: 900,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 40 }],
          value: 40,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeGreaterThanOrEqual(900);
  });

  it("uses exaggerate margin factors when raw range is wide", () => {
    const s = baseMulti();
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.99,
      exaggerate: true,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [
            { time: 980, value: 10 },
            { time: 990, value: 500 },
          ],
          value: 500,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeGreaterThan(500);
    expect(s.displayMin).toBeLessThan(10);
  });

  it("expands narrow raw range to minRange (symmetric pad)", () => {
    const s = baseMulti();
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.99,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 42.0 }],
          value: 42.0,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMax - s.displayMin).toBeGreaterThan(0.01);
  });

  it("skips Y-range margin block when every series is hidden", () => {
    const s = baseMulti();
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.99,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 10 }],
          value: 10,
          visible: false,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMin).toBe(0);
    expect(s.displayMax).toBe(100);
  });

  it("uses Date.now when nowSeconds is omitted", () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(3_000_000);
    const s = baseMulti();
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.99,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [{ time: 2_999_970, value: 10 }],
          value: 10,
          color: "#00f",
        },
      ],
      paused: false,
    });
    expect(s.timestamp).toBeCloseTo(3000, 0);
    nowSpy.mockRestore();
  });

  it("uses exaggerate minRange fallback when raw data range is zero", () => {
    const s = baseMulti();
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.99,
      exaggerate: true,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 5 }],
          value: 5,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMax - s.displayMin).toBeGreaterThan(0);
  });

  it("snaps displayMax up immediately when tMax exceeds range", () => {
    const s = baseMulti();
    s.displayMin = 0;
    s.displayMax = 10;
    tickLiveChartSeriesEngineFrame(s, {
      dt: 16.67,
      canvasWidth: 200,
      canvasHeight: 100,
      timeWindow: 30,
      smoothing: 0.5,
      exaggerate: false,
      referenceValue: undefined,
      series: [
        {
          id: "a",
          data: [{ time: 980, value: 500 }],
          value: 500,
          color: "#00f",
        },
      ],
      nowSeconds: 1000,
    });
    expect(s.displayMax).toBeGreaterThanOrEqual(500);
  });

  describe("extrema tracking", () => {
    it("records the global low/high point + time across visible series", () => {
      const s = baseMulti();
      tickLiveChartSeriesEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 0.5,
        exaggerate: false,
        referenceValue: undefined,
        series: [
          {
            id: "a",
            data: [
              { time: 980, value: 10 }, // global low
              { time: 1000, value: 30 },
            ],
            value: 30,
            color: "#00f",
          },
          {
            id: "b",
            data: [
              { time: 985, value: 90 }, // global high
              { time: 1000, value: 70 },
            ],
            value: 70,
            color: "#f00",
          },
        ],
        nowSeconds: 1000,
      });
      expect(s.extremaMinValue).toBe(10);
      expect(s.extremaMinTime).toBe(980);
      expect(s.extremaMaxValue).toBe(90);
      expect(s.extremaMaxTime).toBe(985);
    });

    it("skips hidden series and reports NaN when no visible series has data", () => {
      const s = baseMulti();
      tickLiveChartSeriesEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 0.5,
        exaggerate: false,
        referenceValue: undefined,
        series: [
          {
            id: "a",
            data: [{ time: 980, value: 5 }],
            value: 5,
            color: "#00f",
            visible: false,
          },
        ],
        nowSeconds: 1000,
      });
      expect(s.extremaMinValue).toBeNaN();
      expect(s.extremaMaxValue).toBeNaN();
      expect(s.extremaMinTime).toBeNaN();
      expect(s.extremaMaxTime).toBeNaN();
    });
  });

  describe("pinch-zoom", () => {
    it("eases displayWindow toward viewWindow when set", () => {
      const s = { ...baseMulti(), displayWindow: 30 };
      tickLiveChartSeriesEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 0.5,
        exaggerate: false,
        referenceValue: undefined,
        series: [],
        nowSeconds: 1000,
        viewWindow: 10,
      });
      expect(s.displayWindow).toBeLessThan(30);
      expect(s.displayWindow).toBeGreaterThan(10);
    });

    it("follows the configured window when viewWindow is null", () => {
      const s = { ...baseMulti(), displayWindow: 10 };
      tickLiveChartSeriesEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 0.5,
        exaggerate: false,
        referenceValue: undefined,
        series: [],
        nowSeconds: 1000,
        viewWindow: null,
      });
      expect(s.displayWindow).toBeGreaterThan(10); // toward 30
    });
  });

  describe("time-scroll", () => {
    function input(
      extra: Partial<Parameters<typeof tickLiveChartSeriesEngineFrame>[1]>,
    ) {
      return {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 0.08,
        exaggerate: false,
        referenceValue: undefined,
        series: [],
        nowSeconds: 1000,
        ...extra,
      };
    }

    it("exposes the live edge and follows it by default", () => {
      const s = baseMulti();
      tickLiveChartSeriesEngineFrame(s, input({ windowBuffer: 0.1 }));
      expect(s.liveEdge).toBe(1003);
      expect(s.timestamp).toBe(1003);
    });

    it("freezes the right edge at viewEnd when scrolled back", () => {
      const s = baseMulti();
      tickLiveChartSeriesEngineFrame(s, input({ viewEnd: 950 }));
      expect(s.timestamp).toBe(950);
      expect(s.liveEdge).toBe(1000);
    });

    it("follows the live edge once viewEnd catches up", () => {
      const s = baseMulti();
      tickLiveChartSeriesEngineFrame(s, input({ viewEnd: 1200 }));
      expect(s.timestamp).toBe(1000);
    });

    it("lets viewEnd override paused", () => {
      const s = { ...baseMulti(), timestamp: 999 };
      tickLiveChartSeriesEngineFrame(s, input({ viewEnd: 950, paused: true }));
      expect(s.timestamp).toBe(950);
    });

    // #164: the "return to live" glide. With viewEnd cleared, the right edge
    // interpolates from returnFrom to the live edge by returnT (0→1).
    it("eases the right edge from returnFrom toward live by returnT", () => {
      const start = baseMulti();
      tickLiveChartSeriesEngineFrame(start, input({ returnFrom: 950, returnT: 0 }));
      expect(start.timestamp).toBe(950);

      const mid = baseMulti();
      tickLiveChartSeriesEngineFrame(mid, input({ returnFrom: 950, returnT: 0.5 }));
      expect(mid.timestamp).toBe(975);

      const done = baseMulti();
      tickLiveChartSeriesEngineFrame(done, input({ returnFrom: 950, returnT: 1 }));
      expect(done.timestamp).toBe(1000);
    });

    // #164: a frozen edge before any visible series' first point follows live.
    it("follows live when the frozen edge precedes the first visible point", () => {
      const s = baseMulti();
      tickLiveChartSeriesEngineFrame(
        s,
        input({
          viewEnd: 950,
          series: [
            {
              id: "a",
              color: "#00f",
              value: 5,
              data: [{ time: 980, value: 5 }],
            },
          ],
        }),
      );
      expect(s.timestamp).toBe(1000); // 950 < firstTime 980 ⇒ follow live
    });

    it("freezes when the edge sits at or after the first visible point", () => {
      const s = baseMulti();
      tickLiveChartSeriesEngineFrame(
        s,
        input({
          viewEnd: 950,
          series: [
            {
              id: "a",
              color: "#00f",
              value: 5,
              data: [{ time: 940, value: 5 }],
            },
          ],
        }),
      );
      expect(s.timestamp).toBe(950); // 950 >= firstTime 940 ⇒ frozen
    });

    // Regression: while scrolled back, each series' tip/dot must track its value
    // AT the visible right edge, not the live value — otherwise the dot floats at
    // the current price while the line ends in the past.
    it("tracks each series' value at the right edge while scrolled back", () => {
      const seriesWithData = [
        {
          id: "a",
          color: "#00f",
          value: 99, // live value (latest)
          data: [
            { time: 970, value: 10 },
            { time: 990, value: 50 },
          ],
        },
      ];
      // viewEnd 985 < liveEdge 1000 ⇒ frozen at 985; last point ≤ 985 is value 10.
      const scrolled = baseMulti();
      tickLiveChartSeriesEngineFrame(
        scrolled,
        input({ series: seriesWithData, viewEnd: 985, smoothing: 0.5 }),
      );
      // Display value eases from the live 99 toward the edge value 10, not 99.
      expect(scrolled.displayValues[0]).toBeLessThan(99);

      // Following live (viewEnd null) ⇒ tracks the live value 99 (stays put).
      const live = baseMulti();
      tickLiveChartSeriesEngineFrame(
        live,
        input({ series: seriesWithData, viewEnd: null, smoothing: 0.5 }),
      );
      expect(live.displayValues[0]).toBe(99);
    });

    // Y-range while scrolled back: points after the frozen right edge must not
    // stretch displayMin/Max — the axis adapts to the visible history instead.
    it("excludes points after the frozen edge from the Y range", () => {
      const s = baseMulti();
      tickLiveChartSeriesEngineFrame(
        s,
        input({
          viewEnd: 950,
          snap: true,
          series: [
            {
              id: "a",
              color: "#00f",
              value: 1000,
              data: [
                { time: 940, value: 10 },
                { time: 945, value: 12 }, // in-window extrema: 10..12
                { time: 990, value: 1000 }, // after the frozen edge — excluded
              ],
            },
          ],
        }),
      );
      expect(s.displayMax).toBeLessThan(100); // ≈12 + margin, not ≈1000
      expect(s.extremaMaxValue).toBe(12);
      expect(s.extremaMinValue).toBe(10);
    });
  });

  describe("snap (one-shot settle)", () => {
    const seriesAB = [
      {
        id: "a",
        data: [
          { time: 980, value: 10 },
          { time: 1000, value: 12 },
        ],
        value: 20,
        color: "#00f",
      },
      {
        id: "b",
        data: [
          { time: 980, value: 50 },
          { time: 1000, value: 55 },
        ],
        value: 60,
        color: "#f00",
      },
    ];

    it("snaps window, range, and per-series tips to target in one frame", () => {
      // Pre-seed the tips away from their targets (the tick otherwise seeds an
      // empty array straight to each series' value, leaving nothing to ease).
      const s = {
        ...baseMulti(),
        displayValues: [0, 0],
        opacities: [1, 1],
        displayMin: 0,
        displayMax: 1000,
        displayWindow: 60,
      };
      tickLiveChartSeriesEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 0.08,
        exaggerate: false,
        referenceValue: undefined,
        series: seriesAB,
        nowSeconds: 1000,
        snap: true,
      });
      // Tips jump straight to each series' live value (20, 60), not eased from it.
      expect(s.displayValues[0]).toBe(20);
      expect(s.displayValues[1]).toBe(60);
      // Window snaps to the configured 30; range snaps to bracket the tips.
      expect(s.displayWindow).toBe(30);
      expect(s.displayMax).toBeLessThan(200); // shrunk from 1000 in one frame
      expect(s.displayMin).toBeLessThanOrEqual(20);
    });

    it("eases (does not snap) without the flag", () => {
      const s = {
        ...baseMulti(),
        displayValues: [0, 0],
        opacities: [1, 1],
        displayMin: 0,
        displayMax: 1000,
        displayWindow: 60,
      };
      tickLiveChartSeriesEngineFrame(s, {
        dt: 16.67,
        canvasWidth: 200,
        canvasHeight: 100,
        timeWindow: 30,
        smoothing: 0.08,
        exaggerate: false,
        referenceValue: undefined,
        series: seriesAB,
        nowSeconds: 1000,
      });
      expect(s.displayValues[0]).toBeGreaterThan(0); // still easing up from 0
      expect(s.displayValues[0]).toBeLessThan(20); // ...but not yet at the target
      expect(s.displayWindow).toBeGreaterThan(30);
      expect(s.displayMax).toBeGreaterThan(200);
    });
  });
});
