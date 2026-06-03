/**
 * Pure synthetic data helpers for the demo app and `useSimulatedChartData`.
 * No React or Reanimated — safe from tests and `chartSimCore`.
 */
import type {
  CandlePoint,
  LiveChartPoint,
  SeriesConfig,
} from "react-native-livechart";

// ─── Random walk ───────────────────────────────────────────────────────────────

/** Box-Muller transform — returns a standard normal variate. */
function gaussianFromRandom01(random01: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = random01();
  while (v === 0) v = random01();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function gaussianRandom(): number {
  return gaussianFromRandom01(Math.random);
}

export interface HistoryOptions {
  count?: number;
  interval?: number; // seconds between points
  startValue?: number;
  volatility?: number; // step size as fraction of value
  startTime?: number; // unix seconds, defaults to now - count*interval
  /** Uniform [0,1) RNG for tests / deterministic seeding. Default `Math.random`. */
  random01?: () => number;
}

/**
 * Generate a backfill of LiveChartPoint[] using a Gaussian random walk.
 */
export function generateHistory(opts: HistoryOptions = {}): LiveChartPoint[] {
  const count = opts.count ?? 150;
  const interval = opts.interval ?? 0.2;
  const volatility = opts.volatility ?? 0.003;
  let value = opts.startValue ?? 100;
  const startTime = opts.startTime ?? Date.now() / 1000 - count * interval;
  const random01 = opts.random01 ?? Math.random;

  const points: LiveChartPoint[] = [];
  for (let i = 0; i < count; i++) {
    const time = startTime + i * interval;
    points.push({ time, value });
    value += value * volatility * gaussianFromRandom01(random01);
    if (value < 0.01) value = 0.01;
  }
  return points;
}

// ─── Volatility presets ────────────────────────────────────────────────────────

export type VolatilityMode = "calm" | "normal" | "volatile" | "chaotic";

export function volatilityFor(mode: VolatilityMode): number {
  switch (mode) {
    case "calm":
      return 0.0008;
    case "normal":
      return 0.003;
    case "volatile":
      return 0.012;
    case "chaotic":
      return 0.035;
  }
}

// ─── Candle aggregation ────────────────────────────────────────────────────────

export interface CandleResult {
  candles: CandlePoint[];
  liveCandle: CandlePoint;
}

/**
 * Bucket tick data into OHLC candles.
 * Returns completed candles + the in-progress live candle.
 */
export function aggregateCandles(
  ticks: LiveChartPoint[],
  candleWidth: number,
): CandleResult {
  if (ticks.length === 0) {
    const now = Date.now() / 1000;
    return {
      candles: [],
      liveCandle: { time: now, open: 0, high: 0, low: 0, close: 0 },
    };
  }

  const buckets = new Map<number, CandlePoint>();

  for (const tick of ticks) {
    const bucketTime = Math.floor(tick.time / candleWidth) * candleWidth;
    const existing = buckets.get(bucketTime);
    if (existing) {
      if (tick.value > existing.high) existing.high = tick.value;
      if (tick.value < existing.low) existing.low = tick.value;
      existing.close = tick.value;
    } else {
      buckets.set(bucketTime, {
        time: bucketTime,
        open: tick.value,
        high: tick.value,
        low: tick.value,
        close: tick.value,
      });
    }
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => a.time - b.time);

  if (sorted.length <= 1) {
    return {
      candles: [],
      liveCandle: sorted[0] ?? {
        time: Date.now() / 1000,
        open: 0,
        high: 0,
        low: 0,
        close: 0,
      },
    };
  }

  return {
    candles: sorted.slice(0, -1),
    liveCandle: sorted[sorted.length - 1],
  };
}

// ─── Multi-series ──────────────────────────────────────────────────────────────

export interface MultiSeriesOptions {
  ids: string[];
  colors: string[];
  labels?: string[];
  count?: number;
  interval?: number;
  /** If true, values are constrained to sum to 100 (prediction market style) */
  sumToHundred?: boolean;
}

/**
 * Generate correlated random walks for multiple series.
 */
export function generateMultiSeries(opts: MultiSeriesOptions): SeriesConfig[] {
  const {
    ids,
    colors,
    labels,
    count = 150,
    interval = 0.2,
    sumToHundred = false,
  } = opts;
  const n = ids.length;
  const startTime = Date.now() / 1000 - count * interval;

  // Initialize starting values
  let values = sumToHundred
    ? Array(n).fill(100 / n)
    : Array.from({ length: n }, () => 30 + Math.random() * 40);

  const allData: LiveChartPoint[][] = ids.map(() => []);

  for (let t = 0; t < count; t++) {
    const time = startTime + t * interval;

    // Random walk each value
    const rawValues = values.map((v) => v + v * 0.004 * gaussianRandom());

    if (sumToHundred) {
      // Normalize to sum to 100, clamp to [0.5, 99]
      const sum = rawValues.reduce((a, b) => a + Math.max(0.5, b), 0);
      values = rawValues.map((v) => {
        const clamped = Math.max(0.5, v);
        return (clamped / sum) * 100;
      });
    } else {
      values = rawValues.map((v) => Math.max(0.01, v));
    }

    for (let i = 0; i < n; i++) {
      allData[i].push({ time, value: values[i] });
    }
  }

  return ids.map((id, i) => ({
    id,
    data: allData[i],
    value: values[i],
    color: colors[i],
    label: labels?.[i],
  }));
}

/**
 * Compute the next value for each series from the current per-series `value`
 * scalars — without touching the (potentially large) `data` arrays.
 *
 * This is the JS-thread half of the live step: it reads only `s.value` (a
 * scalar) so the feed can generate the per-tick delta cheaply, then append the
 * point inside a Reanimated `.modify` worklet on the UI thread (avoiding a full
 * series-array clone per tick).
 */
export function stepMultiSeriesValues(
  values: number[],
  sumToHundred = false,
): number[] {
  const rawValues = values.map((v) => v + v * 0.004 * gaussianRandom());

  if (sumToHundred) {
    const sum = rawValues.reduce((a, b) => a + Math.max(0.5, b), 0);
    return rawValues.map((v) => (Math.max(0.5, v) / sum) * 100);
  }
  return rawValues.map((v) => Math.max(0.01, v));
}
