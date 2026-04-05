import { ADAPTIVE_SPEED_BOOST } from "./constants";
import { lerp } from "./math/lerp";
import type { SeriesConfig } from "./types";

export interface MultiEngineTickMutable {
  displayMin: number;
  displayMax: number;
  displayWindow: number;
  timestamp: number;
  displayValues: number[];
  opacities: number[];
}

export interface MultiEngineTickInput {
  dt: number;
  canvasWidth: number;
  canvasHeight: number;
  timeWindow: number;
  smoothing: number;
  exaggerate: boolean;
  referenceValue: number | undefined;
  series: SeriesConfig[];
  nowSeconds?: number;
  paused?: boolean;
}

/**
 * Multi-series frame tick: lerps per-series tips and visibility opacities,
 * combines Y-range over visible series (same margin rules as single-series).
 * Used by `useLiveChartSeriesEngine`.
 */
export function tickLiveChartSeriesEngineFrame(
  state: MultiEngineTickMutable,
  input: MultiEngineTickInput,
): void {
  "worklet";
  const now = input.nowSeconds ?? Date.now() / 1000;
  if (!input.paused) {
    state.timestamp = now;
  }

  if (input.canvasWidth === 0 || input.canvasHeight === 0) return;

  const speed = input.smoothing;
  const series = input.series;
  const n = series.length;

  while (state.displayValues.length < n) {
    const i = state.displayValues.length;
    state.displayValues.push(series[i].value);
    state.opacities.push(series[i].visible !== false ? 1 : 0);
  }
  if (state.displayValues.length > n) {
    state.displayValues.length = n;
    state.opacities.length = n;
  }

  state.displayWindow = lerp(
    state.displayWindow,
    input.timeWindow,
    speed,
    input.dt,
  );

  const winStart = state.timestamp - state.displayWindow;
  const range = state.displayMax - state.displayMin;

  for (let i = 0; i < n; i++) {
    const target = series[i].value;
    const cur = state.displayValues[i];
    const gapRatio =
      range > 0 ? Math.min(Math.abs(target - cur) / range, 1) : 0;
    const adaptiveSpeed = speed + (1 - gapRatio) * ADAPTIVE_SPEED_BOOST;
    state.displayValues[i] = lerp(cur, target, adaptiveSpeed, input.dt);

    const targetOp = series[i].visible !== false ? 1 : 0;
    state.opacities[i] = lerp(state.opacities[i], targetOp, speed, input.dt);
  }

  let tMin = Infinity;
  let tMax = -Infinity;

  for (let i = 0; i < n; i++) {
    if (series[i].visible === false) continue;
    const points = series[i].data;
    let lo = 0;
    let hi = points.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid].time < winStart) lo = mid + 1;
      else hi = mid;
    }
    for (let j = lo; j < points.length; j++) {
      const v = points[j].value;
      /* istanbul ignore next -- trivial min/max */
      if (v < tMin) tMin = v;
      /* istanbul ignore next -- trivial min/max */
      if (v > tMax) tMax = v;
    }
    const cv = state.displayValues[i];
    if (cv < tMin) tMin = cv;
    if (cv > tMax) tMax = cv;
  }

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
