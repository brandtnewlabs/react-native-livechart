import { lerp } from "../math/lerp";

export interface GridEntry {
  y: number;
  label: string;
  alpha: number;
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
  return Math.abs(ratio - Math.round(ratio)) < 0.01;
}

const FADE_IN = 0.18;
const FADE_OUT = 0.12;

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
): { entries: GridEntry[]; interval: number } {
  "worklet";
  const chartH = canvasHeight - padTop - padBottom;
  if (chartH <= 0) return { entries: [], interval: prevInterval };

  const valRange = displayMax - displayMin;
  if (valRange <= 0) return { entries: [], interval: prevInterval };

  const pxPerUnit = chartH / valRange;

  const coarse = pickInterval(valRange, pxPerUnit, minGap, prevInterval);
  const fine = coarse / 2;
  const finePx = fine * pxPerUnit;
  const fineTarget = fineLineTargetAlpha(finePx, minGap);

  const fadeZone = 32;
  const toY = (v: number) => padTop + ((displayMax - v) / valRange) * chartH;

  // Phase 1: compute target alpha for every grid line
  const targets: Record<number, number> = {};
  const first = Math.ceil(displayMin / fine) * fine;
  for (let val = first; val <= displayMax; val += fine) {
    const y = toY(val);
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
    const speed = target >= alpha ? FADE_IN : FADE_OUT;
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
      labelAlphas[key] = (targets[key] ?? 0) * FADE_IN;
    }
  }

  // Phase 3: build entries
  const entries: GridEntry[] = [];
  const allKeys = Object.keys(labelAlphas);
  for (let i = 0; i < allKeys.length; i++) {
    const key = Number(allKeys[i]);
    const alpha = labelAlphas[key];
    if (alpha < 0.02) continue;
    const val = key / 1e10;
    const y = toY(val);
    /* istanbul ignore next -- vertical clip; y stays in-band when val comes from tracked keys */
    if (y < padTop - 10 || y > canvasHeight - padBottom + 10) continue;
    entries.push({ y, label: formatValue(val), alpha });
  }

  return { entries, interval: coarse };
}
