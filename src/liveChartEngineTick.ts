import type { CandlePoint, LiveChartPoint } from "./types";

import { ADAPTIVE_SPEED_BOOST } from "./constants";
import { lerp } from "./math/lerp";

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
  timeWindow: number;
  smoothing: number;
  exaggerate: boolean;
  referenceValue: number | undefined;
  targetValue: number;
  points: LiveChartPoint[];
  /** Seconds since Unix epoch; defaults to `Date.now() / 1000` */
  nowSeconds?: number;
  /** When true, freeze the viewport timestamp and skip displayWindow lerp */
  paused?: boolean;
  /** Chart mode — `"candle"` uses OHLC bars for Y range instead of line points. */
  mode?: "line" | "candle";
  /** Committed OHLC bars (sorted by time). Used when mode is `"candle"`. */
  candles?: CandlePoint[];
  /** In-progress candle. Included in Y range when mode is `"candle"`. */
  liveCandle?: CandlePoint | null;
}

/**
 * One frame of the live chart engine (mirrors `useLiveChartEngine` worklet body).
 * Mutates `state` in place for testability and reuse from the hook.
 */
export function tickLiveChartEngineFrame(
  state: EngineTickMutable,
  input: EngineTickInput,
): void {
  "worklet";
  const now = input.nowSeconds ?? Date.now() / 1000;
  if (!input.paused) {
    state.timestamp = now;
  }

  if (input.canvasWidth === 0 || input.canvasHeight === 0) return;

  const speed = input.smoothing;
  let target = input.targetValue;
  if (input.mode === "candle" && input.liveCandle) {
    target = input.liveCandle.close;
  }

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
    input.timeWindow,
    speed,
    input.dt,
  );

  const winStart = state.timestamp - state.displayWindow;

  let tMin = Infinity;
  let tMax = -Infinity;

  if (input.mode === "candle") {
    const candles = input.candles;
    if (candles && candles.length > 0) {
      let lo = 0;
      let hi = candles.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (candles[mid].time < winStart) lo = mid + 1;
        else hi = mid;
      }
      for (let i = lo; i < candles.length; i++) {
        if (candles[i].time > state.timestamp) break;
        /* istanbul ignore next -- trivial min/max */
        if (candles[i].low < tMin) tMin = candles[i].low;
        /* istanbul ignore next -- trivial min/max */
        if (candles[i].high > tMax) tMax = candles[i].high;
      }
    }
    const lc = input.liveCandle;
    if (lc) {
      /* istanbul ignore next -- trivial min/max */
      if (lc.low < tMin) tMin = lc.low;
      /* istanbul ignore next -- trivial min/max */
      if (lc.high > tMax) tMax = lc.high;
    }
  } else {
    const points = input.points;
    let lo = 0;
    let hi = points.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid].time < winStart) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < points.length; i++) {
      const v = points[i].value;
      if (v < tMin) tMin = v;
      if (v > tMax) tMax = v;
    }
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
