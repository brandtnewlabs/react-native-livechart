/**
 * Pure, worklet-safe geometry for the threshold split ({@link ThresholdConfig}).
 * No SharedValues and no hooks — these are unit-tested directly; `useThreshold`
 * wires the live SharedValues into them.
 */

/**
 * Pixel Y of a threshold value within the plot. Mirrors the line path's value→Y
 * mapping in `buildLinePoints` (`top + (max - v) / range * chartH`). Returns NaN
 * when the canvas hasn't laid out yet or the value range is degenerate, so the
 * line/fill/marker callers can cull instead of drawing at a bogus position.
 */
export function thresholdLineY(
  value: number,
  displayMin: number,
  displayMax: number,
  canvasHeight: number,
  paddingTop: number,
  paddingBottom: number,
): number {
  "worklet";
  const range = displayMax - displayMin;
  const chartH = canvasHeight - paddingTop - paddingBottom;
  if (canvasHeight <= 0 || range <= 0 || chartH <= 0) return NaN;
  return paddingTop + ((displayMax - value) / range) * chartH;
}

/** True when the threshold's Y sits within the plot area (i.e. on-screen). */
export function thresholdVisible(
  lineY: number,
  canvasHeight: number,
  paddingTop: number,
  paddingBottom: number,
): boolean {
  "worklet";
  if (!Number.isFinite(lineY) || canvasHeight <= 0) return false;
  return lineY >= paddingTop && lineY <= canvasHeight - paddingBottom;
}

/**
 * Stop positions for the vertical hard-split gradient, paired with the 4-stop
 * color array `[above, above, below, below]`: `[0, t, t, 1]`, where `t` is the
 * threshold's fraction down the full canvas (the gradient vector spans
 * `0 → canvasHeight`), clamped to `[0, 1]`.
 *
 * - `t ≤ 0` (threshold above everything) → `[0, 0, 0, 1]` → solid below-color.
 * - `t ≥ 1` (threshold below everything) → `[0, 1, 1, 1]` → solid above-color.
 */
export function thresholdSplitPositions(
  lineY: number,
  canvasHeight: number,
): number[] {
  "worklet";
  if (canvasHeight <= 0 || !Number.isFinite(lineY)) return [0, 1, 1, 1];
  let t = lineY / canvasHeight;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return [0, t, t, 1];
}
