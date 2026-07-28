import type { LiveChartPoint, Momentum } from "../types";

/**
 * Auto-detect momentum from recent data points.
 * Uses the full lookback window for threshold calculation
 * but only the last 5 points for active velocity.
 */
export function detectMomentum(
  points: LiveChartPoint[],
  lookback = 20,
  threshold = 0.12,
  endTime?: number,
): Momentum {
  "worklet";
  // `badge.followViewEdge` needs momentum at the historical window edge rather
  // than at the live dataset tail. Points are chronological, so find the first
  // sample after the inclusive cutoff without allocating a sliced array on the
  // UI thread. With no cutoff, preserve the normal live-tail behavior.
  let end = points.length;
  if (endTime !== undefined) {
    let lo = 0;
    let hi = points.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid].time <= endTime) lo = mid + 1;
      else hi = mid;
    }
    end = lo;
  }

  if (end < 5) return "flat";

  const start = Math.max(0, end - lookback);

  let min = Infinity;
  let max = -Infinity;
  for (let i = start; i < end; i++) {
    const v = points[i].value;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  if (range === 0) return "flat";

  const tailStart = Math.max(start, end - 5);
  const first = points[tailStart].value;
  const last = points[end - 1].value;
  const delta = last - first;

  const absThreshold = range * threshold;

  if (delta > absThreshold) return "up";
  if (delta < -absThreshold) return "down";
  return "flat";
}
