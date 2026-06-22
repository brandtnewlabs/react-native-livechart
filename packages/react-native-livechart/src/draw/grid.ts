import { GRID_METRICS_DEFAULTS, MAX_Y_LABELS } from "../constants";
import { lerp } from "../math/lerp";
import type { GridMetrics } from "../types";

export interface YAxisEntry {
  y: number;
  label: string;
  alpha: number;
}

/**
 * Fixed-count Y-axis: place exactly `count` price labels evenly **in pixels**
 * across the plot band — top = `displayMax`, bottom = `displayMin`. Values track
 * the live range each frame (no nice-number rounding), so the label count stays
 * constant while data streams in.
 *
 * `minGap` is a floor: the count drops to what fits when the plot is too short
 * to space `count` labels at least `minGap` px apart. Clamped to
 * `[2, MAX_Y_LABELS]`. Every entry is fully opaque — there's no per-line fade
 * because the count (and thus each line's pixel slot) doesn't change.
 */
export function fixedGridEntries(
  displayMax: number,
  valRange: number,
  chartH: number,
  padTop: number,
  count: number,
  minGap: number,
  formatValue: (v: number) => string,
): YAxisEntry[] {
  "worklet";
  // minGap floor: at most `floor(chartH / minGap)` gaps fit ⇒ that many + 1 labels.
  const maxFit = Math.floor(chartH / minGap) + 1;
  let n = Math.min(count, maxFit, MAX_Y_LABELS);
  if (n < 2) n = 2;

  const stepPx = chartH / (n - 1);
  const stepVal = valRange / (n - 1);
  const entries: YAxisEntry[] = [];
  for (let i = 0; i < n; i++) {
    const y = padTop + i * stepPx;
    const val = displayMax - i * stepVal;
    entries.push({ y, label: formatValue(val), alpha: 1 });
  }
  return entries;
}

/**
 * Pick a nice Y-axis interval using TradingView's cycling divisor approach.
 * Hysteresis: once chosen, sticks until pixel spacing falls outside [0.5x, 4x] of minGap.
 */
export function pickInterval(
  valRange: number,
  pxPerUnit: number,
  minGap: number,
  prev: number,
): number {
  "worklet";
  if (prev > 0) {
    const px = prev * pxPerUnit;
    if (px >= minGap * 0.5 && px <= minGap * 4) return prev;
  }

  const divisorSets = [
    [2, 2.5, 2],
    [2, 2, 2.5],
    [2.5, 2, 2],
  ];
  let best = Infinity;
  for (let s = 0; s < divisorSets.length; s++) {
    const divs = divisorSets[s];
    let span = Math.pow(10, Math.ceil(Math.log10(valRange)));
    let i = 0;
    while ((span / divs[i % 3]) * pxPerUnit >= minGap) {
      span /= divs[i % 3];
      i++;
    }
    if (span < best) best = span;
  }
  if (best === Infinity) {
    return valRange / 5;
  }
  return best;
}

/**
 * Blend factor for fine (non-coarse) grid lines from pixel spacing.
 * Exposed for unit tests; matches `computeGridEntries` behaviour.
 */
export function fineLineTargetAlpha(finePx: number, minGap = 36): number {
  "worklet";
  const fineMin = minGap * 1.1;
  const fineMax = minGap * 1.7;
  if (finePx < fineMin) return 0;
  if (finePx >= fineMax) return 1;
  return (finePx - fineMin) / (fineMax - fineMin);
}

function divisible(val: number, interval: number): boolean {
  "worklet";
  const ratio = val / interval;
  // 1% tolerance for floating-point rounding in interval alignment
  return Math.abs(ratio - Math.round(ratio)) < 0.01;
}

/** Map data value → canvas Y (nested arrows inside worklets are not UI-thread-safe). */
function gridValueToY(
  val: number,
  displayMax: number,
  valRange: number,
  padTop: number,
  chartH: number,
): number {
  "worklet";
  return padTop + ((displayMax - val) / valRange) * chartH;
}

/**
 * Compute grid entries with per-label alpha fading.
 * `labelAlphas` is mutated in place (persistent state across frames).
 */
export function computeGridEntries(
  displayMin: number,
  displayMax: number,
  canvasHeight: number,
  padTop: number,
  padBottom: number,
  prevInterval: number,
  labelAlphas: Record<number, number>,
  formatValue: (v: number) => string,
  dt: number,
  minGap = 36,
  grid: GridMetrics = GRID_METRICS_DEFAULTS,
  count = 0,
): { entries: YAxisEntry[]; interval: number } {
  "worklet";
  const chartH = canvasHeight - padTop - padBottom;
  if (chartH <= 0) return { entries: [], interval: prevInterval };

  const valRange = displayMax - displayMin;
  if (valRange <= 0) return { entries: [], interval: prevInterval };

  // Fixed-count mode bypasses nice-interval picking and per-line fading. Leave
  // `prevInterval`/`labelAlphas` untouched so toggling back to the dynamic grid
  // resumes cleanly. Needs at least 2 labels (a high/low pair) to be meaningful;
  // count of 0 or 1 falls through to the dynamic nice-interval grid.
  if (count >= 2) {
    return {
      entries: fixedGridEntries(
        displayMax,
        valRange,
        chartH,
        padTop,
        count,
        minGap,
        formatValue,
      ),
      interval: prevInterval,
    };
  }

  const pxPerUnit = chartH / valRange;

  const coarse = pickInterval(valRange, pxPerUnit, minGap, prevInterval);
  const fine = coarse / 2;
  const finePx = fine * pxPerUnit;
  const fineTarget = fineLineTargetAlpha(finePx, minGap);

  const fadeZone = 32;

  // Phase 1: compute target alpha for every grid line
  const targets: Record<number, number> = {};
  const first = Math.ceil(displayMin / fine) * fine;
  // Guard against a non-advancing loop. On a near-flat (but not bit-identical)
  // range, `fine` can drop below ulp(val), so `val += fine === val` and the loop
  // never terminates — freezing the UI thread, since this runs in a worklet every
  // frame. `stepResolves` skips the degenerate range (also catches fine === 0);
  // MAX_GRID_LINES is a hard backstop in case the step stalls mid-loop (real
  // grids only have a handful of lines, so it never bites normal data).
  const stepResolves = first + fine !== first;
  const MAX_GRID_LINES = 1000;
  for (
    let val = first, lineCount = 0;
    stepResolves && val <= displayMax && lineCount < MAX_GRID_LINES;
    val += fine, lineCount++
  ) {
    const y = gridValueToY(val, displayMax, valRange, padTop, chartH);
    /* istanbul ignore next -- y stays in chart band for v in [first, displayMax] with consistent toY */
    if (y < padTop - 2 || y > canvasHeight - padBottom + 2) continue;
    const isCoarse = divisible(val, coarse);

    const fromEdge = Math.min(y - padTop, canvasHeight - padBottom - y);
    const edgeAlpha =
      fromEdge >= fadeZone ? 1 : fromEdge <= 0 ? 0 : fromEdge / fadeZone;

    const target = (isCoarse ? 1 : fineTarget) * edgeAlpha;
    const key = Math.round(val * 1e10);
    targets[key] = target;
  }

  // Phase 2: update tracked label alphas
  const keys = Object.keys(labelAlphas);
  for (let i = 0; i < keys.length; i++) {
    const key = Number(keys[i]);
    const alpha = labelAlphas[key];
    const target = targets[key] ?? 0;
    const speed = target >= alpha ? grid.fadeInSpeed : grid.fadeOutSpeed;
    let next = lerp(alpha, target, speed, dt);
    if (Math.abs(next - target) < 0.02) next = target;
    if (next < 0.01 && target === 0) {
      delete labelAlphas[key];
    } else {
      labelAlphas[key] = next;
    }
  }

  // New labels not yet tracked
  const targetKeys = Object.keys(targets);
  for (let i = 0; i < targetKeys.length; i++) {
    const key = Number(targetKeys[i]);
    /* istanbul ignore else -- key already tracked after phase 2 when targets repeat across frames */
    if (labelAlphas[key] === undefined) {
      /* istanbul ignore next -- targets keys always map to a number; ?? keeps types safe */
      labelAlphas[key] = (targets[key] ?? 0) * grid.fadeInSpeed;
    }
  }

  // Phase 3: build entries
  const entries: YAxisEntry[] = [];
  const allKeys = Object.keys(labelAlphas);
  for (let i = 0; i < allKeys.length; i++) {
    const key = Number(allKeys[i]);
    const alpha = labelAlphas[key];
    if (alpha < 0.02) continue;
    const val = key / 1e10;
    const y = gridValueToY(val, displayMax, valRange, padTop, chartH);
    /* istanbul ignore next -- vertical clip; y stays in-band when val comes from tracked keys */
    if (y < padTop - 10 || y > canvasHeight - padBottom + 10) continue;
    entries.push({ y, label: formatValue(val), alpha });
  }

  return { entries, interval: coarse };
}
