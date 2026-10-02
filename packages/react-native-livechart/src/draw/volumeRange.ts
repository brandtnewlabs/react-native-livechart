import type { CandlePoint } from "../types";

/** First bucket touching the left edge (inclusive). */
export function volumeStartIndex(
  candles: CandlePoint[],
  start: number,
  width: number,
): number {
  "worklet";
  let lo = 0,
    hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time + width < start) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First bucket beyond the right edge (exclusive). */
export function volumeEndIndex(candles: CandlePoint[], end: number): number {
  "worklet";
  let lo = 0,
    hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time <= end) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function visibleMaxVolume(
  candles: CandlePoint[],
  start: number,
  end: number,
): number {
  "worklet";
  let max = 0;
  for (let i = start; i < end; i++) {
    const volume = candles[i].volume ?? 0;
    if (volume > max) max = volume;
  }
  return max;
}

export interface VolumeRange {
  start: number;
  end: number;
  max: number;
}
