import type { ChartPadding } from "../draw/line";

/**
 * Composite sine squiggly — two overlapping frequencies with a breathing
 * amplitude envelope. Matches the original web LiveChart loading animation.
 *
 * amplitude = 14 * (0.4 + 0.6 * sin(0.8 * t))   // 5.6 → 22.4px breathing range
 * y = centerY + amplitude * (sin(0.035*x + 1.2*t) + 0.45*sin(0.08*x + 2.1*t))
 */
export function squigglyYAt(x: number, centerY: number, t: number): number {
  "worklet";
  const amplitude = 14 * (0.4 + 0.6 * Math.sin(0.8 * t));
  return (
    centerY +
    amplitude *
      (Math.sin(0.035 * x + 1.2 * t) + 0.45 * Math.sin(0.08 * x + 2.1 * t))
  );
}

/**
 * Build a flat [x0,y0,x1,y1,...] point array for a standalone squiggly line
 * spanning the full chart area (used in loading / empty state).
 * Points are spaced ~4px apart for smooth curves.
 */
export function buildSquigglyPts(
  canvasWidth: number,
  canvasHeight: number,
  padding: ChartPadding,
  t: number,
): number[] {
  "worklet";
  const leftEdge = padding.left;
  const rightEdge = canvasWidth - padding.right;
  const chartW = rightEdge - leftEdge;
  if (chartW <= 0 || canvasHeight <= 0) return [];

  const centerY = (canvasHeight - padding.bottom + padding.top) / 2;
  const step = 4;
  const count = Math.ceil(chartW / step) + 1;
  const pts: number[] = new Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = leftEdge + Math.min(i * step, chartW);
    pts[i * 2] = x;
    pts[i * 2 + 1] = squigglyYAt(x, centerY, t);
  }
  return pts;
}

/**
 * Given a real flat-pts array (from buildLinePoints), replace each Y with the
 * squiggly Y at the same X. Used during the morph reveal.
 */
export function squigglifyPts(
  flatPts: number[],
  t: number,
  centerY: number,
): number[] {
  "worklet";
  const n = flatPts.length;
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i += 2) {
    out[i] = flatPts[i];
    out[i + 1] = squigglyYAt(flatPts[i], centerY, t);
  }
  return out;
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
 */
export function blendPtsY(
  from: number[],
  to: number[],
  morphT: number,
  padding: ChartPadding,
  canvasWidth: number,
): number[] {
  "worklet";
  const n = from.length;
  if (n === 0) return to;
  const chartCentreX = (padding.left + canvasWidth - padding.right) / 2;
  const halfChartW = (canvasWidth - padding.left - padding.right) / 2;
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i += 2) {
    out[i] = to[i]; // X always from real pts
    const distFromCentre =
      halfChartW > 0 ? Math.abs(from[i] - chartCentreX) / halfChartW : 0;
    const weight = smoothstep((morphT - distFromCentre * 0.5) / 0.5);
    out[i + 1] = from[i + 1] + (to[i + 1] - from[i + 1]) * weight;
  }
  return out;
}
