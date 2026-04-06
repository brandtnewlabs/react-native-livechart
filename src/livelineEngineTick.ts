import type { LivelinePoint } from "./types";
import { lerp } from "./math/lerp";

export const ADAPTIVE_SPEED_BOOST = 0.12;

export interface EngineTickMutable {
  displayValue: number;
  displayMin: number;
  displayMax: number;
  displayWindow: number;
  timestamp: number;
}

export interface EngineTickInput {
  dt: number;
  canvasWidth: number;
  canvasHeight: number;
  windowSize: number;
  lerpSpeed: number;
  exaggerate: boolean;
  referenceValue: number | undefined;
  targetValue: number;
  points: LivelinePoint[];
  /** Seconds since Unix epoch; defaults to `Date.now() / 1000` */
  nowSeconds?: number;
}

/**
 * One frame of the liveline engine (mirrors `useLivelineEngine` worklet body).
 * Mutates `state` in place for testability and reuse from the hook.
 */
export function tickLivelineEngineFrame(
  state: EngineTickMutable,
  input: EngineTickInput,
): void {
  "worklet";
  const now = input.nowSeconds ?? Date.now() / 1000;
  state.timestamp = now;

  if (input.canvasWidth === 0 || input.canvasHeight === 0) return;

  const speed = input.lerpSpeed;
  const target = input.targetValue;

  const range = state.displayMax - state.displayMin;
  const gapRatio =
    range > 0 ? Math.min(Math.abs(target - state.displayValue) / range, 1) : 0;
  const adaptiveSpeed = speed + (1 - gapRatio) * ADAPTIVE_SPEED_BOOST;

  state.displayValue = lerp(
    state.displayValue,
    target,
    adaptiveSpeed,
    input.dt,
  );

  state.displayWindow = lerp(
    state.displayWindow,
    input.windowSize,
    speed,
    input.dt,
  );

  const points = input.points;
  const winStart = now - state.displayWindow;

  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].time < winStart) lo = mid + 1;
    else hi = mid;
  }

  let tMin = Infinity;
  let tMax = -Infinity;
  for (let i = lo; i < points.length; i++) {
    const v = points[i].value;
    if (v < tMin) tMin = v;
    if (v > tMax) tMax = v;
  }

  const cv = state.displayValue;
  if (cv < tMin) tMin = cv;
  if (cv > tMax) tMax = cv;

  const ref = input.referenceValue;
  if (ref !== undefined) {
    if (ref < tMin) tMin = ref;
    if (ref > tMax) tMax = ref;
  }

  const isExaggerate = input.exaggerate;
  if (tMin !== Infinity && tMax !== -Infinity) {
    const rawRange = tMax - tMin;
    const marginFactor = isExaggerate ? 0.01 : 0.12;
    const minRange =
      rawRange * (isExaggerate ? 0.02 : 0.1) || (isExaggerate ? 0.04 : 0.4);

    if (rawRange < minRange) {
      const mid = (tMin + tMax) / 2;
      tMin = mid - minRange / 2;
      tMax = mid + minRange / 2;
    } else {
      const margin = rawRange * marginFactor;
      tMin -= margin;
      tMax += margin;
    }

    if (tMin < state.displayMin) {
      state.displayMin = tMin;
    } else {
      state.displayMin = lerp(state.displayMin, tMin, speed, input.dt);
    }

    if (tMax > state.displayMax) {
      state.displayMax = tMax;
    } else {
      state.displayMax = lerp(state.displayMax, tMax, speed, input.dt);
    }
  }
}
