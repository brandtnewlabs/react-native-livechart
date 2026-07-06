import { MOTION_METRICS_DEFAULTS } from "../constants";
import { lerp } from "../math/lerp";
import type { SeriesConfig } from "../types";

export interface MultiEngineTickMutable {
  displayMin: number;
  displayMax: number;
  displayWindow: number;
  timestamp: number;
  /**
   * The right-edge time the engine would use if following live (`now (+ buffer)`).
   * Equals {@link timestamp} while following; keeps advancing while `timestamp`
   * stays frozen when scrolled back (see {@link MultiEngineTickInput.viewEnd}).
   */
  liveEdge: number;
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
  /**
   * Settle the framing in this one frame instead of easing into it: the time
   * window, Y-range ({@link MultiEngineTickMutable.displayMin}/{@link MultiEngineTickMutable.displayMax}),
   * and per-series tips ({@link MultiEngineTickMutable.displayValues}) jump
   * straight to their targets — `smoothing` is bypassed for this tick only. Set
   * for the single frame after a `snapKey` change so a timeframe / dataset switch
   * lands instantly while live ticks keep their normal smoothing. Series-toggle
   * opacities and the timestamp / pan-scroll state are left untouched. See
   * {@link LiveChartSeriesProps.snapKey}.
   */
  snap?: boolean;
  /**
   * Absolute right-edge time (unix seconds) to freeze the window at, or
   * `null`/`undefined` to follow the live edge. Drives pan-scroll; takes
   * precedence over {@link paused}.
   */
  viewEnd?: number | null;
  /**
   * "Return to live" glide (see #164). When time-scroll is disabled while scrolled
   * back, the hook clears {@link viewEnd} and animates {@link returnT} `0`→`1`;
   * each frame the right edge interpolates from {@link returnFrom} to the *current*
   * live edge by `returnT`, gliding onto live with no end-snap. `1`/`undefined`
   * pins to the live edge.
   */
  returnT?: number;
  /** Frozen right-edge time the {@link returnT} glide starts from. */
  returnFrom?: number;
  /**
   * Absolute visible-window width (seconds) to freeze at, or `null`/`undefined`
   * to follow {@link timeWindow}. Drives pinch-zoom (see `usePinchZoom`); the
   * symmetric counterpart of {@link viewEnd}.
   */
  viewWindow?: number | null;
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
  const liveEdge = baseNow + (input.windowBuffer ?? 0) * input.timeWindow;
  state.liveEdge = liveEdge;
  const viewEnd = input.viewEnd;
  // Earliest first-point time across visible series — the floor a frozen edge
  // must stay at or above. `-Infinity` when no visible series has data, so the
  // freeze still works (nothing to bound the window against).
  let firstDataTime = Infinity;
  for (let i = 0; i < input.series.length; i++) {
    if (input.series[i].visible === false) continue;
    const d = input.series[i].data;
    if (d.length > 0 && d[0].time < firstDataTime) firstDataTime = d[0].time;
  }
  if (firstDataTime === Infinity) firstDataTime = -Infinity;
  // Freeze the right edge while the gesture has parked `viewEnd` behind the live
  // edge AND that edge still sits within the data; a stranded edge falls through
  // to following live. When time-scroll is disabled the hook clears `viewEnd` and
  // kicks off the glide below, so a stale edge can't keep the window frozen. #164.
  const scrolledBack =
    viewEnd != null && viewEnd < liveEdge && viewEnd >= firstDataTime;
  if (scrolledBack) {
    state.timestamp = viewEnd;
  } else if (!input.paused) {
    // Following live; ease from the frozen `returnFrom` to the current live edge
    // while a "return to live" glide is in flight (returnT < 1), else pin to live.
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
  // window / range / tips land on target instantly. See `MultiEngineTickInput.snap`.
  const snap = input.snap === true;
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

  // Pinch-zoom: ease toward the zoom override when set, else the configured
  // window (mirrors the single-series tick).
  const targetWindow = input.viewWindow ?? input.timeWindow;
  state.displayWindow = snap
    ? targetWindow
    : lerp(state.displayWindow, targetWindow, speed, input.dt);

  const winStart = state.timestamp - state.displayWindow;
  const range = state.displayMax - state.displayMin;

  // Scrolled back in time (pan/zoom): the per-series tips/dots sit at the
  // window's right edge, so they must track each series' value AT that edge
  // (`timestamp`), not the live value — otherwise the dot floats at the current
  // price while the line ends in the past. Mirrors single-series `edgeValue`.
  // Reuses the gated `scrolledBack` computed above.

  for (let i = 0; i < n; i++) {
    let target = series[i].value;
    if (scrolledBack) {
      const pts = series[i].data;
      let elo = 0;
      let ehi = pts.length;
      while (elo < ehi) {
        const m = (elo + ehi) >> 1;
        if (pts[m].time <= state.timestamp) elo = m + 1;
        else ehi = m;
      }
      if (elo > 0) target = pts[elo - 1].value;
    }
    const cur = state.displayValues[i];
    const gapRatio =
      range > 0 ? Math.min(Math.abs(target - cur) / range, 1) : 0;
    const adaptiveSpeed =
      speed +
      (1 - gapRatio) *
        (input.adaptiveSpeedBoost ??
          MOTION_METRICS_DEFAULTS.adaptiveSpeedBoost);
    state.displayValues[i] = snap
      ? target
      : lerp(cur, target, adaptiveSpeed, input.dt);

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
      // While scrolled back, stop at the frozen right edge so newer points
      // don't inflate the visible Y range (the per-series tips folded below
      // already track the edge value, so they stay in-range). Following live,
      // keep the tail inclusive — feed timestamps can run slightly ahead of
      // the local clock and must not flicker out of the range.
      if (scrolledBack && points[j].time > state.timestamp) break;
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
}
