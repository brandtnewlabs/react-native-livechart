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

/**
 * Width of each RDP range on the stable, absolute screen-pixel grid.
 *
 * Dense line input contains at most two representatives per pixel bucket. A
 * 30 px range therefore stays within the 64-point work bound even when the
 * decimator and simplifier grids have different phases. Fixed-width ranges
 * also keep their membership stable as the viewport advances.
 */
const RDP_RANGE_WIDTH_PX = 30;

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

function simplifyRdpGroup(
  points: number[],
  keep: number[],
  stack: number[],
  toleranceSq: number,
  rangeStart: number,
  rangeEnd: number,
): void {
  "worklet";
  if (rangeStart === rangeEnd) {
    keep[rangeStart] = 1;
    return;
  }

  // Oversized fixed-X groups are split into overlapping subranges. The group
  // contents are themselves stable, so this point-count guard cannot move
  // until that absolute group reaches a viewport edge.
  for (let chunkStart = rangeStart; chunkStart < rangeEnd; ) {
    const chunkEnd = Math.min(
      chunkStart + MAX_RDP_RANGE_POINTS - 1,
      rangeEnd,
    );
    keep[chunkStart] = 1;
    keep[chunkEnd] = 1;
    stack.push(chunkStart, chunkEnd);

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

    chunkStart = chunkEnd;
  }
}

/**
 * Simplify flat screen-space points (`[x0, y0, x1, y1, ...]`) with a bounded
 * Ramer-Douglas-Peucker pass.
 *
 * `tolerance` is the maximum removable deviation in pixels. The first and last
 * point, larger peaks/valleys, and the original point order are retained. Pass
 * distinct reusable `out` and `scratch` buffers to avoid per-frame allocation.
 * `absoluteXOffset` maps the viewport-relative X coordinates back onto a fixed
 * screen-pixel grid; live chart callers should pass `winStart * xScale` so
 * historical range membership does not change as the window advances.
 */
export function simplifyLinePoints(
  points: number[],
  tolerance: number,
  out: number[],
  scratch: LineSimplifyScratch,
  absoluteXOffset = 0,
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
  const stableXOffset = Number.isFinite(absoluteXOffset) ? absoluteXOffset : 0;

  // Partition on a fixed absolute-X grid rather than by the first visible
  // point's array index. Dropping a point from the left edge then affects only
  // that edge range; fully visible historical ranges keep identical endpoints
  // and RDP choices while translating across the viewport.
  let groupStart = 0;
  let groupKey = Math.floor(
    (points[0] + stableXOffset) / RDP_RANGE_WIDTH_PX,
  );
  for (let i = 1; i < count; i++) {
    const nextKey = Math.floor(
      (points[i * 2] + stableXOffset) / RDP_RANGE_WIDTH_PX,
    );
    if (nextKey !== groupKey) {
      simplifyRdpGroup(
        points,
        keep,
        stack,
        toleranceSq,
        groupStart,
        i - 1,
      );
      groupStart = i;
      groupKey = nextKey;
    }
  }
  simplifyRdpGroup(
    points,
    keep,
    stack,
    toleranceSq,
    groupStart,
    count - 1,
  );

  for (let i = 0; i < count; i++) {
    if (keep[i] === 1) out.push(points[i * 2], points[i * 2 + 1]);
  }
  return out;
}
