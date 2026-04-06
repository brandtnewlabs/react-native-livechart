import type { CandlePoint } from "../types";

/**
 * Find the candle whose time bucket contains `time`.
 * Each candle spans [candle.time, candle.time + candleWidthSecs).
 * Includes the live candle if it overlaps. Returns null if no match.
 */
export function pickCandleAtTime(
  candles: CandlePoint[],
  liveCandle: CandlePoint | null,
  time: number,
  candleWidthSecs: number,
): CandlePoint | null {
  "worklet";
  if (
    liveCandle &&
    time >= liveCandle.time &&
    time < liveCandle.time + candleWidthSecs
  ) {
    return liveCandle;
  }

  if (candles.length === 0) return null;

  // Binary search: find the last candle with time <= scrub time
  let lo = 0;
  let hi = candles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time <= time) lo = mid + 1;
    else hi = mid - 1;
  }
  // hi is now the index of the last candle with time <= time
  if (hi < 0) return null;

  const c = candles[hi];
  if (time >= c.time && time < c.time + candleWidthSecs) {
    return c;
  }

  return null;
}
