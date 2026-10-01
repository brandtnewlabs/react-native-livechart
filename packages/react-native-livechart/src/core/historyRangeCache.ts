import type { CandlePoint, LiveChartPoint } from "../types";

/** A fresh wrapper per SharedValue notification, including same-array modify(). */
export interface HistoryRevision<T> {
  data: T[];
}

/** Per-engine, one-entry cache. Only committed history belongs here. */
export interface HistoryRangeCache {
  revision: object | undefined;
  data: LiveChartPoint[] | CandlePoint[] | undefined;
  candle: boolean;
  start: number;
  end: number;
  min: number;
  max: number;
  minTime: number;
  maxTime: number;
}

export function makeHistoryRangeCache(): HistoryRangeCache {
  "worklet";
  return {
    revision: undefined,
    data: undefined,
    candle: false,
    start: -1,
    end: -1,
    min: Infinity,
    max: -Infinity,
    minTime: 0,
    maxTime: 0,
  };
}

/** Inclusive time bounds; the returned end index is exclusive. */
function timeBound(
  data: { time: number }[],
  time: number,
  upper: boolean,
): number {
  "worklet";
  let lo = 0;
  let hi = data.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (upper ? data[mid].time <= time : data[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Reuse only when a trusted revision AND both visible index bounds match.
 * Without a revision, always scan: identity/length cannot detect in-place edits.
 * The caller owns the cache; live candles, references and animation stay outside.
 */
export function historyRange(
  data: LiveChartPoint[] | CandlePoint[],
  candle: boolean,
  from: number,
  to: number,
  revision: object | undefined,
  cache: HistoryRangeCache,
): HistoryRangeCache {
  "worklet";
  const start = timeBound(data, from, false);
  const end = to === Infinity ? data.length : timeBound(data, to, true);
  if (
    revision !== undefined &&
    cache.revision === revision &&
    cache.data === data &&
    cache.candle === candle &&
    cache.start === start &&
    cache.end === end
  )
    return cache;

  cache.revision = revision;
  cache.data = data;
  cache.candle = candle;
  cache.start = start;
  cache.end = end;
  let min = Infinity;
  let max = -Infinity;
  let minTime = 0;
  let maxTime = 0;
  for (let i = start; i < end; i++) {
    const point = data[i];
    const low = candle
      ? (point as CandlePoint).low
      : (point as LiveChartPoint).value;
    const high = candle ? (point as CandlePoint).high : low;
    // Strict comparisons preserve the first occurrence when extrema tie.
    if (low < min) {
      min = low;
      minTime = point.time;
    }
    if (high > max) {
      max = high;
      maxTime = point.time;
    }
  }
  cache.min = min;
  cache.max = max;
  cache.minTime = minTime;
  cache.maxTime = maxTime;
  return cache;
}
