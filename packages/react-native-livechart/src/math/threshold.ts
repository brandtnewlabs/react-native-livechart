/**
 * Pure, worklet-safe geometry for the threshold split ({@link ThresholdConfig}).
 * No SharedValues and no hooks — these are unit-tested directly; `useThreshold`
 * wires the live SharedValues into them.
 */

import { interpolateAtTime } from "./interpolate";
import type { LiveChartPoint } from "../types";

/**
 * Sample resolution for the time-varying split shader: the threshold series is
 * projected to this many evenly-spaced pixel-Y values across the plot, which the
 * shader linearly interpolates between. ~one sample per 6px on a phone plot —
 * fine enough that the line's crossing point is coloured accurately. The shader
 * walks these in an unrolled loop (`THRESHOLD_SAMPLE_COUNT - 1` iterations), so
 * keep it modest to stay within SkSL's unroll limits.
 */
export const THRESHOLD_SAMPLE_COUNT = 64;

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

/* ------------------------------------------------------------------------- *
 * Time-varying threshold (a `LiveChartPoint[]` series, not a constant value)
 * ------------------------------------------------------------------------- */

/**
 * Sample the threshold series to `count` evenly-spaced pixel-Y values across the
 * plot's x-range, for the split shader's `samples[]` uniform (it linearly
 * interpolates between them and compares each fragment's Y). Clamps to the
 * series' first/last value outside its range (flat extension). When the canvas or
 * range is degenerate it fills with a far-below Y, so the shader paints the
 * above-color everywhere — matching the constant split's pre-layout fallback
 * (`thresholdSplitPositions` → solid above).
 */
export function sampleThresholdY(
  points: LiveChartPoint[],
  now: number,
  windowSecs: number,
  displayMin: number,
  displayMax: number,
  canvasHeight: number,
  paddingTop: number,
  paddingBottom: number,
  count: number,
  out?: number[],
): number[] {
  "worklet";
  const arr: number[] = out ?? [];
  if (out) out.length = 0;
  const chartH = canvasHeight - paddingTop - paddingBottom;
  const valRange = displayMax - displayMin;
  const degenerate =
    points.length === 0 || valRange <= 0 || chartH <= 0 || windowSecs <= 0;
  // A Y safely below every fragment → shader compares "above" everywhere.
  const farBelow = canvasHeight > 0 ? canvasHeight + chartH : 1e6;
  const winStart = now - windowSecs;
  for (let i = 0; i < count; i++) {
    if (degenerate) {
      arr.push(farBelow);
      continue;
    }
    const frac = count > 1 ? i / (count - 1) : 0;
    const v = interpolateAtTime(points, winStart + frac * windowSecs)!;
    arr.push(paddingTop + ((displayMax - v) / valRange) * chartH);
  }
  return arr;
}

/**
 * Evaluate the threshold at pixel-x `x` from the shader's evenly-spaced
 * `samples[]` (the same array the split shader reads), linearly interpolated and
 * clamped outside `[plotLeft, plotRight]`. The profit/loss band's bottom edge is
 * built from this so the band geometry matches the shader **exactly** — a sharp
 * step in the threshold becomes the same ~1-sample ramp in both, so no green/red
 * sliver bleeds through at a step riser. Also pins the band to the line's x-range
 * (clean vertical sides, no stray wedge).
 */
export function sampleThresholdYAt(
  samples: number[],
  plotLeft: number,
  plotRight: number,
  x: number,
): number {
  "worklet";
  const count = samples.length;
  if (count === 0) return 0;
  if (count === 1) return samples[0];
  const span = plotRight - plotLeft;
  if (span <= 0) return samples[0];
  const u = ((x - plotLeft) / span) * (count - 1);
  if (u <= 0) return samples[0];
  if (u >= count - 1) return samples[count - 1];
  const i = Math.floor(u);
  return samples[i] + (samples[i + 1] - samples[i]) * (u - i);
}

/** True when any vertex of a threshold screen polyline sits within the plot. */
export function thresholdSeriesVisible(
  screenPts: number[],
  canvasHeight: number,
  paddingTop: number,
  paddingBottom: number,
): boolean {
  "worklet";
  if (canvasHeight <= 0) return false;
  const bottom = canvasHeight - paddingBottom;
  for (let i = 1; i < screenPts.length; i += 2) {
    const y = screenPts[i];
    if (Number.isFinite(y) && y >= paddingTop && y <= bottom) return true;
  }
  return false;
}
