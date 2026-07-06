import type { CandlePoint, LiveChartPoint } from "../types";

import { MOTION_METRICS_DEFAULTS } from "../constants";
import { lerp } from "../math/lerp";
import { thresholdRangeMinMax } from "../math/threshold";

/** Scratch for the threshold range fold — only alive within one tick call. */
const THRESHOLD_RANGE_SCRATCH: [number, number] = [0, 0];

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
   * Smoothed value at the visible window's right edge: the live value while
   * following, or the price at `viewEnd` while scrolled back. Lets a badge track
   * the last visible price as you pan (see `badge.followViewEdge`).
   */
  edgeValue: number;
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
  /**
   * Time-varying threshold series (`threshold.includeInRange`): its min/max over
   * the visible window is folded into the Y range, like {@link referenceValues}
   * but windowed each tick.
   */
  thresholdRangePoints?: LiveChartPoint[];
  /** Whether {@link thresholdRangePoints} extends flat past its last point to
   *  "now" (`threshold.extendToNow`). Default `true`. */
  thresholdRangeExtendToNow?: boolean;
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
   * Settle the framing in this one frame instead of easing into it: the time
   * window ({@link EngineTickMutable.displayWindow}), Y-range
   * ({@link EngineTickMutable.displayMin}/{@link EngineTickMutable.displayMax}),
   * and value ({@link EngineTickMutable.displayValue}/{@link EngineTickMutable.edgeValue})
   * jump straight to their targets — `smoothing` is bypassed for this tick only.
   * Set for the single frame after a `snapKey` change so a timeframe / dataset
   * switch lands instantly while live ticks keep their normal smoothing. Leaves
   * the timestamp / pan-scroll state untouched. See {@link LiveChartProps.snapKey}.
   */
  snap?: boolean;
  /**
   * Absolute right-edge time (unix seconds) to freeze the window at, or
   * `null`/`undefined` to follow the live edge. Set by the pan-scroll gesture
   * to scroll back in time; once it reaches (or passes) the live edge the engine
   * resumes following. Takes precedence over {@link paused}.
   */
  viewEnd?: number | null;
  /**
   * "Return to live" glide (see #164). When time-scroll is disabled while scrolled
   * back, the engine hook clears {@link viewEnd} and animates {@link returnT} from
   * `0`→`1`; each frame the right edge interpolates from {@link returnFrom} (the
   * frozen edge captured at that moment) to the *current* live edge by `returnT`,
   * so the window glides forward and lands exactly on live (no end-snap). At
   * `1`/`undefined` it pins to the live edge — the normal follow behavior.
   */
  returnT?: number;
  /** Frozen right-edge time the {@link returnT} glide starts from. See {@link returnT}. */
  returnFrom?: number;
  /**
   * Absolute visible-window width (seconds) to freeze at, or `null`/`undefined`
   * to follow the configured {@link timeWindow}. Set by the pinch-zoom gesture
   * (see `usePinchZoom` / the `zoom` prop). The symmetric counterpart of
   * {@link viewEnd}: `viewEnd` overrides the window's right edge, `viewWindow`
   * overrides its width. `displayWindow` eases toward this when set.
   */
  viewWindow?: number | null;
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
  // First time of the visible series' data — the floor a frozen edge must stay
  // at or above. `-Infinity` when there's no data to bound against, so the freeze
  // still works (we can't strand a plot we have no time bounds for).
  let firstDataTime = -Infinity;
  if (input.mode === "candle") {
    const cs = input.candles;
    if (cs && cs.length > 0) firstDataTime = cs[0].time;
  } else if (input.points.length > 0) {
    firstDataTime = input.points[0].time;
  }
  // Freeze the right edge while the pan gesture has parked `viewEnd` behind the
  // live edge AND that edge still sits within the data. A frozen edge stranded
  // before the active series' first point falls through to following live (so a
  // line/candle span mismatch never strands the window on an empty plot). When
  // time-scroll is disabled the hook clears `viewEnd` (and kicks off the glide
  // below), so a stale edge can't keep the window frozen. See #164.
  const scrolledBack =
    viewEnd != null && viewEnd < liveEdge && viewEnd >= firstDataTime;
  if (scrolledBack) {
    state.timestamp = viewEnd;
  } else if (!input.paused) {
    // Following live. While a "return to live" glide is in flight (returnT < 1)
    // ease the right edge from the frozen `returnFrom` to the *current* live edge
    // by returnT — converges exactly on live with no end-snap. Otherwise pin to
    // the live edge (the steady-state follow).
    const returnT = input.returnT;
    if (returnT != null && returnT < 1 && input.returnFrom != null) {
      state.timestamp =
        input.returnFrom + (liveEdge - input.returnFrom) * returnT;
    } else {
      state.timestamp = liveEdge;
    }
  }
  // else: paused with no active pan → leave the frozen timestamp untouched.

  if (input.canvasWidth === 0 || input.canvasHeight === 0) return;

  const speed = input.smoothing;
  // One-shot settle (snapKey change): collapse this frame's easing so the
  // window / range / value land on target instantly, then normal smoothing
  // resumes next frame. See `EngineTickInput.snap`.
  const snap = input.snap === true;
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

  state.displayValue = snap
    ? target
    : lerp(state.displayValue, target, adaptiveSpeed, input.dt);

  // Pinch-zoom: ease toward the zoom override when set, else the configured
  // window. Mirrors the viewEnd freeze above (width vs. right edge).
  const targetWindow = input.viewWindow ?? input.timeWindow;
  state.displayWindow = snap
    ? targetWindow
    : lerp(state.displayWindow, targetWindow, speed, input.dt);

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

  const thrPts = input.thresholdRangePoints;
  if (thrPts !== undefined && thrPts.length > 0) {
    const mm = thresholdRangeMinMax(
      thrPts,
      state.timestamp,
      state.displayWindow,
      input.thresholdRangeExtendToNow ?? true,
      THRESHOLD_RANGE_SCRATCH,
    );
    if (mm !== null) {
      if (mm[0] < tMin) tMin = mm[0];
      if (mm[1] > tMax) tMax = mm[1];
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

    if (snap || tMin < state.displayMin) {
      state.displayMin = tMin;
    } else {
      state.displayMin = lerp(state.displayMin, tMin, speed, input.dt);
    }

    if (snap || tMax > state.displayMax) {
      state.displayMax = tMax;
    } else {
      state.displayMax = lerp(state.displayMax, tMax, speed, input.dt);
    }
  }

  // Edge value: the price at the visible window's right edge. Following live →
  // track the live value (badge unchanged). Scrolled back → track the last
  // visible point/candle close, lerped so a `followViewEdge` badge glides to the
  // last price as you pan. Reuses the gated `scrolledBack` computed above.
  if (!scrolledBack) {
    state.edgeValue = state.displayValue;
  } else {
    let edgeTarget = state.displayValue;
    if (input.mode === "candle") {
      const cs = input.candles;
      if (cs && cs.length > 0) {
        let elo = 0;
        let ehi = cs.length;
        while (elo < ehi) {
          const m = (elo + ehi) >> 1;
          if (cs[m].time <= state.timestamp) elo = m + 1;
          else ehi = m;
        }
        if (elo > 0) edgeTarget = cs[elo - 1].close;
      }
      const lc = input.liveCandle;
      if (lc && lc.time <= state.timestamp) edgeTarget = lc.close;
    } else {
      const pts = input.points;
      let elo = 0;
      let ehi = pts.length;
      while (elo < ehi) {
        const m = (elo + ehi) >> 1;
        if (pts[m].time <= state.timestamp) elo = m + 1;
        else ehi = m;
      }
      if (elo > 0) edgeTarget = pts[elo - 1].value;
    }
    state.edgeValue = snap
      ? edgeTarget
      : lerp(state.edgeValue, edgeTarget, speed, input.dt);
  }
}
