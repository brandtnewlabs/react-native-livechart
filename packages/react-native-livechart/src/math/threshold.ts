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
 * Spacing of the threshold sample grid, in seconds. `count - 2` (not `count - 1`)
 * so the `count` samples cover the window plus up to one spacing of overhang on
 * each side — the grid is anchored to absolute time (see
 * {@link thresholdSampleStart}) and must keep covering the plot as it glides.
 */
export function thresholdSampleStep(windowSecs: number, count: number): number {
  "worklet";
  return windowSecs / Math.max(count - 2, 1);
}

/**
 * First sample time of the grid: the greatest multiple of the spacing at or
 * before the window start. Anchoring sample TIMES to an absolute grid (instead
 * of evenly across the current window) keeps each sample's *value* stable while
 * the window scrolls — the grid's *pixel* positions glide left each frame, so a
 * step riser translates fluidly instead of popping from one fixed sample bin to
 * the next (~plotWidth/63 px at a time) while the data line glides beside it.
 */
export function thresholdSampleStart(
  now: number,
  windowSecs: number,
  count: number,
): number {
  "worklet";
  const dt = thresholdSampleStep(windowSecs, count);
  return Math.floor((now - windowSecs) / dt) * dt;
}

/**
 * Pixel-X endpoints `[x0, x1]` of the sample grid for the current frame — the
 * span the shader / band / marker interpolate {@link sampleThresholdY}'s output
 * across. Overhangs `[plotLeft, plotRight]` by up to one spacing per side and
 * glides with the window. Falls back to the plot edges when the window or plot
 * is degenerate (matching `sampleThresholdY`'s degenerate fill).
 */
export function thresholdSampleSpanX(
  now: number,
  windowSecs: number,
  plotLeft: number,
  plotRight: number,
  count: number,
): [number, number] {
  "worklet";
  const span = plotRight - plotLeft;
  if (!(windowSecs > 0) || span <= 0 || count < 2) return [plotLeft, plotRight];
  const dt = thresholdSampleStep(windowSecs, count);
  const t0 = thresholdSampleStart(now, windowSecs, count);
  const winStart = now - windowSecs;
  const xScale = span / windowSecs;
  const x0 = plotLeft + (t0 - winStart) * xScale;
  return [x0, x0 + (count - 1) * dt * xScale];
}

/**
 * Sample the threshold series to `count` pixel-Y values on the time-anchored
 * grid ({@link thresholdSampleStart}/{@link thresholdSampleSpanX}), for the
 * split shader's `samples[]` uniform (it linearly interpolates between them and
 * compares each fragment's Y). Clamps to the series' first/last value outside
 * its range (flat extension). When the canvas or range is degenerate — or a
 * series value is NaN — it fills with a far-below Y, so the shader paints the
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
  // A Y safely below every fragment → shader compares "above" everywhere.
  // (canvasHeight * 2 stays below the canvas even when chartH is negative.)
  const farBelow = canvasHeight > 0 ? canvasHeight * 2 : 1e6;
  // !(valRange > 0) also catches a NaN display range.
  if (points.length === 0 || !(valRange > 0) || chartH <= 0 || windowSecs <= 0) {
    for (let i = 0; i < count; i++) arr.push(farBelow);
    return arr;
  }
  const dt = thresholdSampleStep(windowSecs, count);
  const t0 = thresholdSampleStart(now, windowSecs, count);
  for (let i = 0; i < count; i++) {
    const v = interpolateAtTime(points, t0 + i * dt)!;
    const y = thresholdLineY(
      v,
      displayMin,
      displayMax,
      canvasHeight,
      paddingTop,
      paddingBottom,
    );
    // A NaN series value degrades per-sample to the solid-above fallback
    // instead of leaking NaN into the shader uniform / band vertices.
    arr.push(Number.isFinite(y) ? y : farBelow);
  }
  return arr;
}

/**
 * Evaluate the threshold at pixel-x `x` from the evenly-spaced `samples[]` (the
 * same array the split shader reads), linearly interpolated across the sample
 * span `[spanLeft, spanRight]` (see {@link thresholdSampleSpanX}) and clamped
 * outside it. The profit/loss band's bottom edge and the marker polyline's
 * plot-edge pins are built from this so their geometry matches the shader
 * **exactly** — a sharp step in the threshold becomes the same ~1-sample ramp in
 * all of them, so no green/red sliver bleeds through at a step riser.
 */
export function sampleThresholdYAt(
  samples: number[],
  spanLeft: number,
  spanRight: number,
  x: number,
): number {
  "worklet";
  const count = samples.length;
  if (count === 0) return 0;
  if (count === 1) return samples[0];
  const span = spanRight - spanLeft;
  if (span <= 0) return samples[0];
  const u = ((x - spanLeft) / span) * (count - 1);
  if (u <= 0) return samples[0];
  if (u >= count - 1) return samples[count - 1];
  const i = Math.floor(u);
  return samples[i] + (samples[i + 1] - samples[i]) * (u - i);
}

/**
 * Dash-phase (px) for the series marker line so its dash pattern travels WITH
 * the scrolling threshold instead of staying screen-fixed. The marker path
 * starts at the static plot edge, so without a moving phase the dashes sit
 * still while the staircase glides left — reading as the dots "marching" right
 * along the line. Advancing the phase at exactly the content scroll speed
 * (`span/windowSecs` px per second, mod the dash cycle) pins the pattern to the
 * geometry. Returns 0 for a degenerate window/plot/cycle (static dashes).
 */
export function thresholdDashPhase(
  now: number,
  windowSecs: number,
  plotLeft: number,
  plotRight: number,
  dashCycle: number,
): number {
  "worklet";
  const span = plotRight - plotLeft;
  if (!(windowSecs > 0) || span <= 0 || !(dashCycle > 0)) return 0;
  return ((now * span) / windowSecs) % dashCycle;
}

/**
 * Min/max of a threshold series over the visible window `[now - windowSecs,
 * now]` — the values folded into the engine's Y-range fit when
 * `threshold.includeInRange` is set (like reference-line values). Uses the
 * clamped window-edge values plus every interior point; with `extendToNow` off,
 * the window end clamps to the series' last point (nothing projects forward).
 * Writes `[min, max]` into `out` and returns it, or returns null when the
 * series is empty / entirely outside the effective window / non-finite.
 */
export function thresholdRangeMinMax(
  points: LiveChartPoint[],
  now: number,
  windowSecs: number,
  extendToNow: boolean,
  out: [number, number],
): [number, number] | null {
  "worklet";
  if (points.length === 0 || !(windowSecs > 0)) return null;
  const tStart = now - windowSecs;
  let tEnd = now;
  if (!extendToNow) {
    const lastT = points[points.length - 1].time;
    if (lastT < tStart) return null;
    if (lastT < tEnd) tEnd = lastT;
  }
  let mn = interpolateAtTime(points, tStart)!;
  let mx = mn;
  const vEnd = interpolateAtTime(points, tEnd)!;
  if (vEnd < mn) mn = vEnd;
  else if (vEnd > mx) mx = vEnd;
  for (let i = 0; i < points.length; i++) {
    const t = points[i].time;
    if (t <= tStart) continue;
    if (t >= tEnd) break;
    const v = points[i].value;
    if (v < mn) mn = v;
    else if (v > mx) mx = v;
  }
  if (!Number.isFinite(mn) || !Number.isFinite(mx)) return null;
  out[0] = mn;
  out[1] = mx;
  return out;
}

/**
 * True when any part of a threshold screen polyline crosses the plot: a vertex
 * inside it, or a segment whose endpoints straddle it (a step riser can jump
 * from below the bottom edge to above the top edge between two samples without
 * landing a vertex inside).
 */
export function thresholdSeriesVisible(
  screenPts: number[],
  canvasHeight: number,
  paddingTop: number,
  paddingBottom: number,
): boolean {
  "worklet";
  if (canvasHeight <= 0) return false;
  let prev = NaN;
  for (let i = 1; i < screenPts.length; i += 2) {
    const y = screenPts[i];
    if (!Number.isFinite(y)) {
      prev = NaN;
      continue;
    }
    if (thresholdVisible(y, canvasHeight, paddingTop, paddingBottom)) return true;
    // Both endpoints are outside the plot band — on opposite sides means the
    // segment crosses straight through it.
    if (Number.isFinite(prev) && prev < paddingTop !== y < paddingTop)
      return true;
    prev = y;
  }
  return false;
}
