import { MOTION_METRICS_DEFAULTS } from "../constants";
import { lerp } from "../math/lerp";
import type { SeriesConfig } from "../types";

export interface MultiEngineTickMutable {
  displayMin: number;
  displayMax: number;
  displayWindow: number;
  timestamp: number;
  displayValues: number[];
  opacities: number[];
  /**
   * Value + time of the lowest / highest point across the visible series — the
   * actual extrema, NOT the smoothed display bounds. `NaN` when no visible
   * series has data in the window. Used to float `topLabel` / `bottomLabel` at
   * their occurrence point (see {@link AxisLabelConfig.position} `"extrema"`).
   */
  extremaMinValue: number;
  extremaMaxValue: number;
  extremaMinTime: number;
  extremaMaxTime: number;
}

export interface MultiEngineTickInput {
  dt: number;
  canvasWidth: number;
  canvasHeight: number;
  timeWindow: number;
  smoothing: number;
  exaggerate: boolean;
  /** Extra catch-up speed added to `smoothing` when a series tip lags. Default `0.12`. */
  adaptiveSpeedBoost?: number;
  referenceValue: number | undefined;
  /** Additional reference values (lines + bands) folded into the Y range. */
  referenceValues?: number[];
  /** Clamp the computed lower bound at 0. */
  nonNegative?: boolean;
  /** Hard cap for the computed upper bound. */
  maxValue?: number;
  series: SeriesConfig[];
  nowSeconds?: number;
  /** Override the engine's "now" (unix seconds). */
  nowOverride?: number;
  /** Right-edge buffer as a fraction of the time window. */
  windowBuffer?: number;
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
  const baseNow = input.nowOverride ?? input.nowSeconds ?? Date.now() / 1000;
  if (!input.paused) {
    state.timestamp = baseNow + (input.windowBuffer ?? 0) * input.timeWindow;
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
    const adaptiveSpeed =
      speed +
      (1 - gapRatio) *
        (input.adaptiveSpeedBoost ??
          MOTION_METRICS_DEFAULTS.adaptiveSpeedBoost);
    state.displayValues[i] = lerp(cur, target, adaptiveSpeed, input.dt);

    const targetOp = series[i].visible !== false ? 1 : 0;
    state.opacities[i] = lerp(state.opacities[i], targetOp, speed, input.dt);
  }

  let tMin = Infinity;
  let tMax = -Infinity;
  // Time of the running global min / max data point — captured so an extrema
  // label can be pinned at its x (data extrema only; the live tips folded below
  // into the Y range are snapshotted out before that).
  let minTime = 0;
  let maxTime = 0;
  let dataMin = Infinity;
  let dataMax = -Infinity;

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
      if (v < dataMin) {
        dataMin = v;
        minTime = points[j].time;
      }
      if (v > dataMax) {
        dataMax = v;
        maxTime = points[j].time;
      }
    }
    const cv = state.displayValues[i];
    if (cv < tMin) tMin = cv;
    if (cv > tMax) tMax = cv;
  }

  // Snapshot the raw data extrema before the references fold in. NaN when no
  // visible series has data in the window so the extrema label hides.
  const hasMin = dataMin !== Infinity;
  const hasMax = dataMax !== -Infinity;
  state.extremaMinValue = hasMin ? dataMin : NaN;
  state.extremaMaxValue = hasMax ? dataMax : NaN;
  state.extremaMinTime = hasMin ? minTime : NaN;
  state.extremaMaxTime = hasMax ? maxTime : NaN;

  const ref = input.referenceValue;
  if (ref !== undefined) {
    if (ref < tMin) tMin = ref;
    if (ref > tMax) tMax = ref;
  }

  const refs = input.referenceValues;
  if (refs !== undefined) {
    for (let i = 0; i < refs.length; i++) {
      const rv = refs[i];
      if (rv < tMin) tMin = rv;
      if (rv > tMax) tMax = rv;
    }
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

    if (input.nonNegative && tMin < 0) tMin = 0;
    const maxV = input.maxValue;
    if (maxV !== undefined && tMax > maxV) tMax = maxV;

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
