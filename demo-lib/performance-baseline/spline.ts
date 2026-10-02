// Frozen baseline from 2a512fc for reproducible comparisons.

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
  /** First point index to draw (inclusive). The caller must moveTo this point. */
  startPoint = 0,
  /** Last point index to draw (exclusive). Defaults to the full array. */
  endPoint = pts.length >> 1,
) {
  "worklet";
  const start = Math.max(0, startPoint);
  const end = Math.min(pts.length >> 1, endPoint);
  const n = end - start;
  if (n < 2) return;
  if (linear) {
    for (let i = 1; i < n; i++) {
      const point = (start + i) * 2;
      path.lineTo(pts[point], pts[point + 1]);
    }
    return;
  }
  if (n === 2) {
    const point = (start + 1) * 2;
    path.lineTo(pts[point], pts[point + 1]);
    return;
  }

  // 1. Secant slopes and x-intervals
  const delta: number[] = scratch ? scratch.delta : new Array(n - 1);
  const h: number[] = scratch ? scratch.h : new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const i2 = (start + i) * 2;
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
    const i2 = (start + i) * 2;
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
