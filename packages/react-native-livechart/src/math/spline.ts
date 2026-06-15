import type { LiveChartPoint } from "../types";

/**
 * Reusable scratch buffers for {@link drawSpline}. Pass a persistent instance
 * (created once per chart via `useMemo`) to avoid allocating three arrays sized
 * to the point count on every frame — the per-frame garbage scales with the
 * number of points (large `timeWindow`s push 1000+ points), so pooling these
 * meaningfully cuts UI-thread GC pressure on live charts.
 */
export interface SplineScratch {
  delta: number[];
  h: number[];
  m: number[];
}

/** Allocate an empty {@link SplineScratch} (arrays grow on demand). */
export function makeSplineScratch(): SplineScratch {
  return { delta: [], h: [], m: [] };
}

/**
 * Fritsch-Carlson monotone cubic interpolation.
 * Guarantees no overshoots — the curve never exceeds local min/max.
 * Same approach documented in liveline for smooth live line charts (adapted code; MIT).
 *
 * pts is a flat number array with stride 2: [x0, y0, x1, y1, ...].
 * Caller must moveTo the first point before calling.
 *
 * Pass `scratch` (see {@link makeSplineScratch}) to reuse the tangent/interval
 * buffers across frames instead of allocating them each call. Only indices
 * `0..n-1` are read after being written, so stale tail entries are harmless.
 *
 * @see https://github.com/benjitaylor/liveline
 */
/**
 * Minimal structural sink for {@link drawSpline}: just the verb-emitting methods
 * it calls. Both `SkPath` and `SkPathBuilder` satisfy it, so the spline can be
 * built into either a mutable `SkPath` or a `Skia.PathBuilder`.
 */
export type SplinePathSink = {
  lineTo: (x: number, y: number) => unknown;
  cubicTo: (
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    x: number,
    y: number,
  ) => unknown;
};

export function drawSpline(
  path: SplinePathSink,
  pts: number[],
  scratch?: SplineScratch,
  /** Straight polyline (`lineTo` per point) instead of the monotone cubic — an
   *  angular, hard-edged line. The caller has already `moveTo`'d point 0. */
  linear = false,
) {
  "worklet";
  const n = pts.length >> 1;
  if (n < 2) return;
  if (linear) {
    for (let i = 1; i < n; i++) path.lineTo(pts[i * 2], pts[i * 2 + 1]);
    return;
  }
  if (n === 2) {
    path.lineTo(pts[2], pts[3]);
    return;
  }

  // 1. Secant slopes and x-intervals
  const delta: number[] = scratch ? scratch.delta : new Array(n - 1);
  const h: number[] = scratch ? scratch.h : new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const i2 = i * 2;
    const j2 = i2 + 2;
    h[i] = pts[j2] - pts[i2];
    delta[i] = h[i] === 0 ? 0 : (pts[j2 + 1] - pts[i2 + 1]) / h[i];
  }

  // 2. Initial tangent estimates
  const m: number[] = scratch ? scratch.m : new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (delta[i - 1] + delta[i]) / 2;
    }
  }

  // 3. Fritsch-Carlson constraint: alpha^2 + beta^2 <= 9
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / delta[i];
      const beta = m[i + 1] / delta[i];
      const s2 = alpha * alpha + beta * beta;
      if (s2 > 9) {
        const s = 3 / Math.sqrt(s2);
        m[i] = s * alpha * delta[i];
        m[i + 1] = s * beta * delta[i];
      }
    }
  }

  // 4. Draw bezier curves
  for (let i = 0; i < n - 1; i++) {
    const i2 = i * 2;
    const j2 = i2 + 2;
    const hi = h[i];
    path.cubicTo(
      pts[i2] + hi / 3,
      pts[i2 + 1] + (m[i] * hi) / 3,
      pts[j2] - hi / 3,
      pts[j2 + 1] - (m[i + 1] * hi) / 3,
      pts[j2],
      pts[j2 + 1],
    );
  }
}

/**
 * Value of the Fritsch–Carlson monotone cubic — the same curve {@link drawSpline}
 * renders — at `time`. Use this to anchor overlays (e.g. markers) exactly on the
 * rendered line instead of on the straight chord between data points. Returns
 * `null` for empty data; clamps to the endpoints outside the data range.
 *
 * The data→pixel mapping is affine, so evaluating the monotone cubic in data
 * space and then projecting matches the pixel-space spline. Tangents use the
 * immediate neighbors and the overshoot clamp is applied for this segment only
 * (it does not cascade across segments as in `drawSpline`, which differs only on
 * very steep runs where the clamp fires).
 */
export function splineValueAtTime(
  points: LiveChartPoint[],
  time: number,
): number | null {
  "worklet";
  const n = points.length;
  if (n === 0) return null;
  if (n === 1 || time <= points[0].time) return points[0].value;
  if (time >= points[n - 1].time) return points[n - 1].value;

  // Segment [i, i+1] with points[i].time <= time < points[i+1].time.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].time <= time) lo = mid;
    else hi = mid;
  }
  const i = lo;
  const ti = points[i].time;
  const vi = points[i].value;
  const tj = points[i + 1].time;
  const vj = points[i + 1].value;
  const hSeg = tj - ti;
  /* istanbul ignore next -- guarded by the clamps above; defensive for duplicate times */
  if (hSeg <= 0) return vi;

  const deltaI = (vj - vi) / hSeg;
  if (n === 2) return vi + deltaI * (time - ti); // drawSpline draws a straight line for n === 2

  // Tangents at the segment ends (monotone-safe averages of adjacent secants).
  let mi: number;
  if (i === 0) {
    mi = deltaI;
  } else {
    const dPrev = (vi - points[i - 1].value) / (ti - points[i - 1].time);
    mi = dPrev * deltaI <= 0 ? 0 : (dPrev + deltaI) / 2;
  }
  let mj: number;
  if (i + 1 === n - 1) {
    mj = deltaI;
  } else {
    const dNext = (points[i + 2].value - vj) / (points[i + 2].time - tj);
    mj = deltaI * dNext <= 0 ? 0 : (deltaI + dNext) / 2;
  }

  // Fritsch–Carlson overshoot clamp (alpha² + beta² <= 9).
  if (deltaI === 0) {
    mi = 0;
    mj = 0;
  } else {
    const alpha = mi / deltaI;
    const beta = mj / deltaI;
    const s2c = alpha * alpha + beta * beta;
    if (s2c > 9) {
      const sc = 3 / Math.sqrt(s2c);
      mi = sc * alpha * deltaI;
      mj = sc * beta * deltaI;
    }
  }

  // Cubic Hermite on [i, i+1]. x is linear in the Bézier parameter (the control
  // points are equally spaced in x), so the parameter equals (time - ti) / hSeg.
  const s = (time - ti) / hSeg;
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  return h00 * vi + h10 * hSeg * mi + h01 * vj + h11 * hSeg * mj;
}
