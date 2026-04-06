import type { LivelinePoint } from "../types";

/**
 * Binary search to find interpolated value at a given time.
 * Returns null if time is outside data range.
 */
export function interpolateAtTime(
  points: LivelinePoint[],
  time: number,
): number | null {
  "worklet";
  if (points.length === 0) return null;
  if (time <= points[0].time) return points[0].value;
  if (time >= points[points.length - 1].time)
    return points[points.length - 1].value;

  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].time <= time) lo = mid;
    else hi = mid;
  }

  const p1 = points[lo];
  const p2 = points[hi];
  const dt = p2.time - p1.time;
  /* istanbul ignore next -- unreachable with sorted keys: duplicate times collapse to the last index with time <= t, so p1/p2 always have distinct times unless clamps fire first */
  if (dt === 0) return p1.value;
  const t = (time - p1.time) / dt;
  return p1.value + (p2.value - p1.value) * t;
}
