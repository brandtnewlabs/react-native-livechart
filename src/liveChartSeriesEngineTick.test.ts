import { tickLiveChartSeriesEngineFrame } from "./liveChartSeriesEngineTick";

describe("tickLiveChartSeriesEngineFrame", () => {
  function baseMulti(): {
    displayMin: number;
    displayMax: number;
    displayWindow: number;
    timestamp: number;
    displayValues: number[];
    opacities: number[];
  } {
    return {
      displayMin: 0,
      displayMax: 100,
      displayWindow: 30,
      timestamp: 1000,
      displayValues: [],
      opacities: [],
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
});
