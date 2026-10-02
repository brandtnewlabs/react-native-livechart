import {
  historyRange,
  makeHistoryRangeCache,
} from "../src/core/historyRangeCache";
import {
  tickLiveChartEngineFrame,
  type EngineTickInput,
  type EngineTickMutable,
} from "../src/core/liveChartEngineTick";
import type { CandlePoint, LiveChartPoint } from "../src/types";

it("reuses a scan when animation moves the window without crossing a point", () => {
  let reads = 0;
  const points = Array.from({ length: 1000 }, (_, i) => ({
    time: i,
    get value() {
      reads++;
      return i;
    },
  }));
  const revision = {};
  const cache = makeHistoryRangeCache();
  historyRange(points, false, 100.1, 900.1, revision, cache);
  expect(reads).toBe(800);
  expect([cache.min, cache.max]).toEqual([101, 900]);
  historyRange(points, false, 100.9, 900.9, revision, cache);
  expect(reads).toBe(800);
  historyRange(points, false, 101, 901, revision, cache);
  expect(reads).toBe(1601); // inclusive right boundary changed
  expect(cache.max).toBe(901);
  historyRange(points, false, 102, 901, revision, cache);
  expect(cache.min).toBe(102);
});

it("invalidates same-length replacement, interior edits, timestamp edits and rolling data", () => {
  let points = [
    { time: 1, value: 4 },
    { time: 2, value: 9 },
    { time: 3, value: 4 },
  ];
  const cache = makeHistoryRangeCache();
  const scan = () => historyRange(points, false, 1, 3, {}, cache);
  expect(scan().max).toBe(9);
  points[1].value = -30; // same array, length and endpoints, new notification revision
  expect(scan().min).toBe(-30);
  points = points.map((p) => ({ ...p, value: 50 }));
  expect(scan().min).toBe(50);
  points[2].time = 4;
  scan();
  expect(cache.end).toBe(2);
  points.shift();
  points.push({ time: 5, value: -100 });
  expect(scan().min).toBe(50);
  expect(cache.end).toBe(1);
});

it("without a trusted revision never caches by identity or length", () => {
  const data = [
    { time: 1, value: 4 },
    { time: 2, value: 9 },
  ];
  const cache = makeHistoryRangeCache();
  historyRange(data, false, 0, Infinity, undefined, cache);
  data[1].value = -10;
  historyRange(data, false, 0, Infinity, undefined, cache);
  expect(cache.min).toBe(-10);
});

it("preserves duplicate-time boundaries, first tied extrema, and empty windows", () => {
  const data = [
    { time: 1, value: 4 },
    { time: 1, value: 9 },
    { time: 2, value: 9 },
  ];
  const cache = makeHistoryRangeCache();
  const revision = {};
  historyRange(data, false, 1, 1, revision, cache);
  expect([cache.min, cache.max, cache.maxTime]).toEqual([4, 9, 1]);
  historyRange(data, false, 1, 2, revision, cache);
  expect(cache.maxTime).toBe(1);
  historyRange(data, false, 3, 4, revision, cache);
  expect([cache.min, cache.max]).toEqual([Infinity, -Infinity]);
  historyRange([], false, 0, 4, {}, cache);
  expect([cache.min, cache.max]).toEqual([Infinity, -Infinity]);
});

it("keeps candle high/low separate from close and invalidates candle edits", () => {
  const data = [{ time: 1, open: 5, close: 6, low: 2, high: 12 }];
  const cache = makeHistoryRangeCache();
  historyRange(data, true, 0, 2, {}, cache);
  expect([cache.min, cache.max]).toEqual([2, 12]);
  data[0].low = -20;
  historyRange(data, true, 0, 2, {}, cache);
  expect(cache.min).toBe(-20);
});

function state(): EngineTickMutable {
  return {
    displayValue: 10,
    displayMin: 0,
    displayMax: 20,
    displayWindow: 30,
    timestamp: 100,
    liveEdge: 100,
    edgeValue: 10,
    extremaMinValue: NaN,
    extremaMaxValue: NaN,
    extremaMinTime: NaN,
    extremaMaxTime: NaN,
  };
}
function input(): EngineTickInput {
  return {
    dt: 16.67,
    canvasWidth: 400,
    canvasHeight: 300,
    timeWindow: 30,
    smoothing: 0.08,
    exaggerate: false,
    referenceValue: undefined,
    targetValue: 10,
    points: [],
    nowSeconds: 100,
  };
}

it.each(["line", "candle"] as const)(
  "matches uncached ticks through data and viewport changes (%s)",
  (mode) => {
    const cached = state();
    const uncached = state();
    const cache = makeHistoryRangeCache();
    const points: LiveChartPoint[] = Array.from({ length: 120 }, (_, i) => ({
      time: i,
      value: 10 + Math.sin(i) * 5,
    }));
    const candles: CandlePoint[] = points.map((p) => ({
      time: p.time,
      open: p.value,
      close: p.value,
      low: p.value - 2,
      high: p.value + 3,
    }));
    const args = { ...input(), mode, points, candles, historyRevision: {} };
    for (let frame = 0; frame < 600; frame++) {
      if (frame % 19 === 0) {
        points[90].value = frame % 31;
        candles[90].high = frame % 37;
        args.historyRevision = {};
      }
      const changing: EngineTickInput = {
        ...args,
        nowSeconds: 100 + frame / 60,
        viewEnd: frame % 100 < 50 ? 95 + frame / 600 : null,
        viewWindow: 20 + Math.sin(frame / 10) * 10,
        targetValue: 10 + Math.cos(frame / 10) * 8,
        liveCandle: {
          time: 100,
          open: 10,
          close: 12,
          low: -frame / 20,
          high: frame / 10,
        },
        referenceValues: [frame % 25, -frame % 9],
        thresholdRangePoints: [
          { time: 60, value: -10 },
          { time: 120, value: 40 },
        ],
        yRangeScale: 1 + (frame % 11) / 10,
        nonNegative: frame % 17 === 0,
        maxValue: frame % 13 === 0 ? 15 : undefined,
        candleGaps: [{ from: 98, to: 110, kind: "no-trades" }],
        candleGapBridgeNoTrades: true,
      };
      tickLiveChartEngineFrame(cached, changing, cache);
      tickLiveChartEngineFrame(uncached, {
        ...changing,
        historyRevision: undefined,
      });
      expect(cached).toEqual(uncached);
    }
  },
);

it("folds a changing live candle and references without reading history again", () => {
  let reads = 0;
  const candles = [
    {
      time: 90,
      open: 5,
      close: 5,
      get low() {
        reads++;
        return 2;
      },
      high: 12,
    },
  ];
  const args = {
    ...input(),
    mode: "candle" as const,
    candles,
    historyRevision: {},
    snap: true,
    liveCandle: { time: 100, open: 10, close: 12, low: 8, high: 15 },
  };
  const current = state();
  const cache = makeHistoryRangeCache();
  tickLiveChartEngineFrame(current, args, cache);
  args.liveCandle.high = 80;
  tickLiveChartEngineFrame(current, { ...args, referenceValue: -60 }, cache);
  expect(reads).toBe(1);
  expect(current.extremaMaxValue).toBe(80);
  expect(current.extremaMaxTime).toBe(100);
  expect(current.displayMin).toBeLessThan(-60);
  expect(current.displayMax).toBeGreaterThan(80);
});
