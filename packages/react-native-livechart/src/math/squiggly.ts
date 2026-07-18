import type { ChartPadding } from "../draw/line";

/**
 * Composite sine squiggly — two overlapping frequencies with a breathing
 * amplitude envelope. Matches the original web LiveChart loading animation.
 *
 * amplitude = base * (0.4 + 0.6 * sin(0.8 * t·speed))   // 0.4×→1.0× base
 * y = centerY + amplitude * (sin(0.035*x + 1.2*t·speed) + 0.45*sin(0.08*x + 2.1*t·speed))
 *
 * `base` (default `14`) scales the wave height; `speed` (default `1`) scales the
 * time phase so the ripple/breathing runs faster or slower (`0` freezes it).
 */
export function squigglyYAt(
  x: number,
  centerY: number,
  t: number,
  base = 14,
  speed = 1,
): number {
  "worklet";
  const ts = t * speed;
  const amplitude = base * (0.4 + 0.6 * Math.sin(0.8 * ts));
  return (
    centerY +
    amplitude *
      (Math.sin(0.035 * x + 1.2 * ts) + 0.45 * Math.sin(0.08 * x + 2.1 * ts))
  );
}

/**
 * Build a flat [x0,y0,x1,y1,...] point array for a standalone squiggly line
 * spanning the full chart area (used in loading / empty state).
 * Points are spaced ~4px apart for smooth curves.
 * Pass `out` to reuse a caller-owned frame scratch.
 */
export function buildSquigglyPts(
  canvasWidth: number,
  canvasHeight: number,
  padding: ChartPadding,
  t: number,
  base = 14,
  speed = 1,
  out?: number[],
): number[] {
  "worklet";
  const pts = out ?? [];
  const leftEdge = padding.left;
  const rightEdge = canvasWidth - padding.right;
  const chartW = rightEdge - leftEdge;
  if (chartW <= 0 || canvasHeight <= 0) {
    pts.length = 0;
    return pts;
  }

  const centerY = (canvasHeight - padding.bottom + padding.top) / 2;
  const step = 4;
  const count = Math.ceil(chartW / step) + 1;
  pts.length = count * 2;
  for (let i = 0; i < count; i++) {
    const x = leftEdge + Math.min(i * step, chartW);
    pts[i * 2] = x;
    pts[i * 2 + 1] = squigglyYAt(x, centerY, t, base, speed);
  }
  return pts;
}

/**
 * Given a real flat-pts array (from buildLinePoints), replace each Y with the
 * squiggly Y at the same X. Used during the morph reveal.
 * Pass `out` to reuse a caller-owned frame scratch.
 */
export function squigglifyPts(
  flatPts: number[],
  t: number,
  centerY: number,
  base = 14,
  speed = 1,
  out?: number[],
): number[] {
  "worklet";
  const n = flatPts.length;
  const target = out ?? [];
  target.length = n;
  for (let i = 0; i < n; i += 2) {
    target[i] = flatPts[i];
    target[i + 1] = squigglyYAt(flatPts[i], centerY, t, base, speed);
  }
  return target;
}

/**
 * Smoothstep — maps t ∈ [0,1] to a smooth 0→1 curve (no clamping required
 * when t is already in range, but clamps gracefully outside).
 */
export function smoothstep(t: number): number {
  "worklet";
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * Blend two flat-pts arrays center-out, driven by morphT ∈ [0,1].
 * Points near the horizontal centre of the chart reveal first; edges last.
 *
 * For each point, a per-point weight is computed:
 *   distFromCentre = |x - chartCentreX| / (chartW / 2)   // 0=centre, 1=edge
 *   weight = smoothstep((morphT - distFromCentre * 0.5) / 0.5)
 *   blendedY = fromY + (toY - fromY) * weight
 * Pass `out` to reuse a caller-owned frame scratch.
 */
export function blendPtsY(
  from: number[],
  to: number[],
  morphT: number,
  padding: ChartPadding,
  canvasWidth: number,
  out?: number[],
): number[] {
  "worklet";
  const n = from.length;
  if (n === 0 && !out) return to;
  const chartCentreX = (padding.left + canvasWidth - padding.right) / 2;
  const halfChartW = (canvasWidth - padding.left - padding.right) / 2;
  const target = out ?? [];
  const outputLength = n === 0 ? to.length : n;
  target.length = outputLength;
  if (n === 0) {
    for (let i = 0; i < to.length; i++) target[i] = to[i];
    return target;
  }
  for (let i = 0; i < n; i += 2) {
    target[i] = to[i]; // X always from real pts
    const distFromCentre =
      halfChartW > 0 ? Math.abs(from[i] - chartCentreX) / halfChartW : 0;
    const weight = smoothstep((morphT - distFromCentre * 0.5) / 0.5);
    target[i + 1] = from[i + 1] + (to[i + 1] - from[i + 1]) * weight;
  }
  return target;
}
