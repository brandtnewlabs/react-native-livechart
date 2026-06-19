import type { CandlePoint, LiveChartPoint } from "../types";

import { MOTION_METRICS_DEFAULTS } from "../constants";
import { lerp } from "../math/lerp";

export interface EngineTickMutable {
  displayValue: number;
  displayMin: number;
  displayMax: number;
  displayWindow: number;
  timestamp: number;
  /**
   * The right-edge time the engine would use if it were following live —
   * `now (+ windowBuffer)`. Equals {@link timestamp} while following; when
   * scrolled back in time (see {@link EngineTickInput.viewEnd}) it keeps
   * advancing while `timestamp` stays frozen. Exposed so the pan-scroll gesture
   * can clamp against the live edge and detect catch-up.
   */
  liveEdge: number;
  /**
   * Value + time of the lowest / highest data point in the visible window —
   * the actual extrema, NOT the smoothed display bounds (which carry margin and
   * fold in the live value / reference lines). `NaN` when the window holds no
   * data. Used to float `topLabel` / `bottomLabel` at their occurrence point
   * (see {@link AxisLabelConfig.position} `"extrema"`).
   */
  extremaMinValue: number;
  extremaMaxValue: number;
  extremaMinTime: number;
  extremaMaxTime: number;
}

export interface EngineTickInput {
  dt: number;
  canvasWidth: number;
  canvasHeight: number;
  timeWindow: number;
  smoothing: number;
  exaggerate: boolean;
  /** Extra catch-up speed added to `smoothing` when the live value lags. Default `0.12`. */
  adaptiveSpeedBoost?: number;
  referenceValue: number | undefined;
  /** Additional reference values (lines + bands) folded into the Y range. */
  referenceValues?: number[];
  /** Clamp the computed lower bound at 0. */
  nonNegative?: boolean;
  /** Hard cap for the computed upper bound. */
  maxValue?: number;
  targetValue: number;
  points: LiveChartPoint[];
  /** Seconds since Unix epoch; defaults to `Date.now() / 1000` */
  nowSeconds?: number;
  /** Override the engine's "now" (unix seconds) — e.g. fill historical data edge-to-edge. */
  nowOverride?: number;
  /** Right-edge buffer as a fraction of the time window (pushes the live edge past "now"). */
  windowBuffer?: number;
  /** When true, freeze the viewport timestamp and skip displayWindow lerp */
  paused?: boolean;
  /**
   * Absolute right-edge time (unix seconds) to freeze the window at, or
   * `null`/`undefined` to follow the live edge. Set by the pan-scroll gesture
   * to scroll back in time; once it reaches (or passes) the live edge the engine
   * resumes following. Takes precedence over {@link paused}.
   */
  viewEnd?: number | null;
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
  const baseNow = input.nowOverride ?? input.nowSeconds ?? Date.now() / 1000;
  const liveEdge = baseNow + (input.windowBuffer ?? 0) * input.timeWindow;
  state.liveEdge = liveEdge;
  const viewEnd = input.viewEnd;
  if (viewEnd != null && viewEnd < liveEdge) {
    // Scrolled back in time: freeze the right edge at an absolute timestamp so
    // the window stops tracking "now" (see usePanScroll / the `timeScroll` prop).
    state.timestamp = viewEnd;
  } else if (!input.paused) {
    // Following the live edge — viewEnd is null/undefined or has caught back up.
    state.timestamp = liveEdge;
  }
  // else: paused with no active pan → leave the frozen timestamp untouched.

  if (input.canvasWidth === 0 || input.canvasHeight === 0) return;

  const speed = input.smoothing;
  let target = input.targetValue;
  if (input.mode === "candle" && input.liveCandle) {
    target = input.liveCandle.close;
  }

  const range = state.displayMax - state.displayMin;
  const gapRatio =
    range > 0 ? Math.min(Math.abs(target - state.displayValue) / range, 1) : 0;
  const adaptiveSpeed =
    speed +
    (1 - gapRatio) *
      (input.adaptiveSpeedBoost ?? MOTION_METRICS_DEFAULTS.adaptiveSpeedBoost);

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
  // Time of the running min / max — captured alongside the value so an extrema
  // label can be pinned at the point's x. Holds the data extrema only (folded
  // below with the live value / references for the Y range, but snapshotted
  // before that into `extrema*` so the label tracks the real high/low).
  let minTime = 0;
  let maxTime = 0;

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
        if (candles[i].low < tMin) {
          tMin = candles[i].low;
          minTime = candles[i].time;
        }
        /* istanbul ignore next -- trivial min/max */
        if (candles[i].high > tMax) {
          tMax = candles[i].high;
          maxTime = candles[i].time;
        }
      }
    }
    const lc = input.liveCandle;
    if (lc) {
      /* istanbul ignore next -- trivial min/max */
      if (lc.low < tMin) {
        tMin = lc.low;
        minTime = lc.time;
      }
      /* istanbul ignore next -- trivial min/max */
      if (lc.high > tMax) {
        tMax = lc.high;
        maxTime = lc.time;
      }
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
      if (v < tMin) {
        tMin = v;
        minTime = points[i].time;
      }
      if (v > tMax) {
        tMax = v;
        maxTime = points[i].time;
      }
    }
  }

  // Snapshot the raw data extrema (value + time) before the live value /
  // reference values fold into tMin/tMax for the Y range. NaN when the window
  // is empty so the extrema label hides rather than pinning to a fake point.
  const hasMin = tMin !== Infinity;
  const hasMax = tMax !== -Infinity;
  state.extremaMinValue = hasMin ? tMin : NaN;
  state.extremaMaxValue = hasMax ? tMax : NaN;
  state.extremaMinTime = hasMin ? minTime : NaN;
  state.extremaMaxTime = hasMax ? maxTime : NaN;

  const cv = state.displayValue;
  if (cv < tMin) tMin = cv;
  if (cv > tMax) tMax = cv;

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
