import type { CandleGap, CandleGapKind, CandlePoint } from "../types";

/** Built-in, overridable copy for gap bands and scrub tooltips. */
export function candleGapDefaultLabel(kind: CandleGapKind): string {
  "worklet";
  if (kind === "no-trades") return "No trades";
  if (kind === "unavailable") return "Trading unavailable";
  return "Data unavailable";
}

/** Find the explicit half-open gap containing `time`. Input must be start-sorted. */
export function pickCandleGapAtTime(
  gaps: CandleGap[],
  time: number,
): CandleGap | null {
  "worklet";
  let lo = 0;
  let hi = gaps.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (gaps[mid].from <= time) lo = mid + 1;
    else hi = mid - 1;
  }
  if (hi < 0) return null;
  const gap = gaps[hi];
  return time >= gap.from && time < gap.to ? gap : null;
}

/** Latest real candle strictly before `time`, preferring a newer live candle. */
export function previousCandleAtTime(
  candles: CandlePoint[],
  liveCandle: CandlePoint | null,
  time: number,
): CandlePoint | null {
  "worklet";
  let lo = 0;
  let hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  let result = lo > 0 ? candles[lo - 1] : null;
  if (
    liveCandle &&
    liveCandle.time < time &&
    (!result || liveCandle.time > result.time)
  ) {
    result = liveCandle;
  }
  return result;
}

/** Previous observed close for a bridged gap; `null` when no anchor exists. */
export function previousCandleCloseAtTime(
  candles: CandlePoint[],
  liveCandle: CandlePoint | null,
  time: number,
): number | null {
  "worklet";
  return previousCandleAtTime(candles, liveCandle, time)?.close ?? null;
}

/** Whether a real candle starts in the bucket beginning at `bucketTime`. */
export function candleAtBucketTime(
  candles: CandlePoint[],
  liveCandle: CandlePoint | null,
  bucketTime: number,
  candleWidthSecs: number,
): CandlePoint | null {
  "worklet";
  let lo = 0;
  let hi = candles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = candles[mid].time;
    if (t < bucketTime) lo = mid + 1;
    else if (t > bucketTime) hi = mid - 1;
    else return candles[mid];
  }
  if (
    liveCandle &&
    Math.abs(liveCandle.time - bucketTime) < candleWidthSecs * 1e-6
  ) {
    return liveCandle;
  }
  return null;
}

/**
 * Bucket start under `time`, aligned to the nearest preceding real candle.
 * Returns `null` for a partial edge bucket, a bucket with real OHLC, or a gap
 * without a previous-close anchor.
 */
export function candleGapBucketStartAtTime(
  gap: CandleGap,
  time: number,
  candles: CandlePoint[],
  liveCandle: CandlePoint | null,
  candleWidthSecs: number,
): number | null {
  "worklet";
  if (
    candleWidthSecs <= 0 ||
    time < gap.from ||
    time >= gap.to ||
    gap.kind !== "no-trades"
  ) {
    return null;
  }
  const previous = previousCandleAtTime(candles, liveCandle, time);
  if (!previous) return null;
  const steps = Math.floor((time - previous.time) / candleWidthSecs);
  const bucket = previous.time + steps * candleWidthSecs;
  if (bucket < gap.from || bucket + candleWidthSecs > gap.to) return null;
  if (candleAtBucketTime(candles, liveCandle, bucket, candleWidthSecs)) {
    return null;
  }
  return bucket;
}
