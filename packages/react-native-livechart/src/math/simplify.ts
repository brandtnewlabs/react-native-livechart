/** Reusable buffers for {@link simplifyLinePoints}. */
export interface LineSimplifyScratch {
  keep: number[];
  stack: number[];
}

/** Allocate simplification scratch once, outside the per-frame worklet. */
export function makeLineSimplifyScratch(): LineSimplifyScratch {
  return { keep: [], stack: [] };
}

/**
 * Maximum number of points simplified as one Ramer-Douglas-Peucker range.
 *
 * The visible line is already bounded to roughly two points per horizontal
 * pixel. Splitting that bounded input into overlapping ranges also bounds the
 * simplifier's worst-case work: a pathological zig-zag cannot turn a frame into
 * an O(n²) scan. Range endpoints are retained, so chunking can only keep a few
 * extra points; it cannot erase additional structure.
 */
const MAX_RDP_RANGE_POINTS = 64;

function pointSegmentDistanceSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  "worklet";
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return ex * ex + ey * ey;
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const ex = px - (ax + t * dx);
  const ey = py - (ay + t * dy);
  return ex * ex + ey * ey;
}

/**
 * Simplify flat screen-space points (`[x0, y0, x1, y1, ...]`) with a bounded
 * Ramer-Douglas-Peucker pass.
 *
 * `tolerance` is the maximum removable deviation in pixels. The first and last
 * point, larger peaks/valleys, and the original point order are retained. Pass
 * distinct reusable `out` and `scratch` buffers to avoid per-frame allocation.
 */
export function simplifyLinePoints(
  points: number[],
  tolerance: number,
  out: number[],
  scratch: LineSimplifyScratch,
): number[] {
  "worklet";
  if (out === points) return points;

  out.length = 0;
  const count = points.length >> 1;
  if (!(tolerance > 0) || !Number.isFinite(tolerance) || count <= 2) {
    for (let i = 0; i < count * 2; i++) out.push(points[i]);
    return out;
  }

  const keep = scratch.keep;
  keep.length = count;
  for (let i = 0; i < count; i++) keep[i] = 0;

  const stack = scratch.stack;
  stack.length = 0;
  const toleranceSq = tolerance * tolerance;

  // Adjacent ranges share one retained endpoint. That makes each range's RDP
  // error bound independent while keeping the final polyline continuous.
  for (let rangeStart = 0; rangeStart < count - 1; ) {
    const rangeEnd = Math.min(
      rangeStart + MAX_RDP_RANGE_POINTS - 1,
      count - 1,
    );
    keep[rangeStart] = 1;
    keep[rangeEnd] = 1;
    stack.push(rangeStart, rangeEnd);

    while (stack.length >= 2) {
      const end = stack.pop()!;
      const start = stack.pop()!;
      if (end <= start + 1) continue;

      const ax = points[start * 2];
      const ay = points[start * 2 + 1];
      const bx = points[end * 2];
      const by = points[end * 2 + 1];
      let furthest = -1;
      let maxDistanceSq = toleranceSq;

      for (let i = start + 1; i < end; i++) {
        const distanceSq = pointSegmentDistanceSq(
          points[i * 2],
          points[i * 2 + 1],
          ax,
          ay,
          bx,
          by,
        );
        if (distanceSq > maxDistanceSq) {
          maxDistanceSq = distanceSq;
          furthest = i;
        }
      }

      if (furthest >= 0) {
        keep[furthest] = 1;
        stack.push(start, furthest, furthest, end);
      }
    }

    rangeStart = rangeEnd;
  }

  for (let i = 0; i < count; i++) {
    if (keep[i] === 1) out.push(points[i * 2], points[i * 2 + 1]);
  }
  return out;
}
