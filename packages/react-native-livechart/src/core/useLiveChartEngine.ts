/**
 * UI-thread chart engine: time window, Y-range smoothing, and tick cadence pursue
 * the same “live chart” feel as liveline’s `requestAnimationFrame` loop; mechanism
 * here is Reanimated frame callbacks and SharedValues, not DOM canvas.
 *
 * @see https://github.com/benjitaylor/liveline
 */
import { useEffect, useRef, useState } from "react";
import {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { MS_PER_FRAME_60FPS, RETURN_TO_LIVE_MS } from "../constants";
import type { CandlePoint, LiveChartPoint, SeriesConfig } from "../types";
import { tickLiveChartEngineFrame } from "./liveChartEngineTick";

export interface EngineConfig {
  data: SharedValue<LiveChartPoint[]>;
  value: SharedValue<number>;
  timeWindow: number;
  smoothing: number;
  /** Extra catch-up speed added to `smoothing` when the live value lags. */
  adaptiveSpeedBoost?: number;
  exaggerate?: boolean;
  referenceValue?: number;
  referenceValues?: number[];
  /**
   * Live, per-frame Y values to fold into the axis-range fit on top of the static
   * {@link referenceValues} — used so a *dragging* reference line expands the range
   * and the axis follows the finger smoothly (the committed values already sit in
   * `referenceValues`). Read on the UI thread each frame; omit for non-draggable charts.
   */
  liveReferenceValues?: SharedValue<number[]>;
  nonNegative?: boolean;
  maxValue?: number;
  nowOverride?: number;
  windowBuffer?: number;
  paused?: boolean;
  /**
   * Whether the `timeScroll` gesture is active. Flipping this to `false` while
   * scrolled back clears {@link ChartEngineScroll.viewEnd} and **glides** the
   * window back to the live edge (a brief eased animation, not an instant jump),
   * so disabling time-scroll — or a mode switch that turns it off — never strands
   * the chart at a past position. See #164.
   */
  scrollEnabled?: boolean;
  /**
   * Duration (ms) of the return-to-live glide when {@link scrollEnabled} flips to
   * `false` while scrolled back. `0` snaps instantly (no animation). Defaults to
   * {@link RETURN_TO_LIVE_MS}. Resolved from `timeScroll.returnToLive`. See #164.
   */
  returnToLiveMs?: number;
  /**
   * Loop-free render: settle the display state once (smoothing forced to 1, no
   * per-frame frame callback) for many small charts in a list. See
   * {@link LiveChartProps.static}.
   */
  static?: boolean;
  /**
   * Opaque key that snaps the framing to its target in one frame whenever it
   * changes (the next tick bypasses `smoothing` for the window, Y-range, and
   * value, then normal easing resumes). Lets a timeframe / dataset switch land
   * instantly while live ticks stay smooth. See {@link LiveChartProps.snapKey}.
   */
  snapKey?: string | number;
  mode?: "line" | "candle";
  candles?: SharedValue<CandlePoint[]>;
  liveCandle?: SharedValue<CandlePoint | null>;
}

/** Canvas, time window, and Y-range — shared by single- and multi-series engines. */
export interface ChartEngineLayout {
  displayMin: SharedValue<number>;
  displayMax: SharedValue<number>;
  /** Animating window (lerps toward {@link timeWindow}); use for positioning. */
  displayWindow: SharedValue<number>;
  /**
   * The *effective* target window — the value `displayWindow` eases toward: the
   * pinch-zoom override ({@link ChartEngineScroll.viewWindow}) when active, else
   * the `timeWindow` prop. Tick *selection* (which X-axis labels exist) must read
   * this, not `displayWindow`: the lerp is asymptotic and never reaches the
   * target, so it settles just above or just below it depending on the prior
   * window. Bucketing that off-by-epsilon value (e.g. via `niceTimeInterval`)
   * would otherwise make the tick cadence depend on where you came from. See
   * issue #126.
   */
  timeWindow: SharedValue<number>;
  canvasWidth: SharedValue<number>;
  canvasHeight: SharedValue<number>;
  timestamp: SharedValue<number>;
}

/**
 * Live extrema (value + time of the lowest / highest data point in the visible
 * window) — the raw data high/low, not the smoothed display bounds. Each field
 * is `NaN` when the window holds no data. Provided by both engines so an
 * `"extrema"`-positioned `topLabel` / `bottomLabel` can be pinned at the point.
 */
export interface ChartEngineExtrema {
  extremaMinValue: SharedValue<number>;
  extremaMaxValue: SharedValue<number>;
  extremaMinTime: SharedValue<number>;
  extremaMaxTime: SharedValue<number>;
}

/**
 * Time-scroll state: lets a pan gesture freeze the window at an absolute time
 * and resume following the live edge. Returned by both engines (intersected onto
 * the state) but kept off {@link ChartEngineLayout} so overlay components — which
 * only read the layout — don't have to carry it.
 */
export interface ChartEngineScroll {
  /**
   * Absolute right-edge time (unix seconds) to freeze at, or `null` to follow
   * the live edge. Written by the pan-scroll gesture; read by the engine tick.
   */
  viewEnd: SharedValue<number | null>;
  /**
   * The right-edge time the engine would use if following live — advances each
   * frame even while {@link ChartEngineLayout.timestamp} is frozen by a pan.
   */
  liveEdge: SharedValue<number>;
  /**
   * Absolute visible-window width (seconds) to freeze at, or `null` to follow
   * the configured `timeWindow`. Written by the pinch-zoom gesture; the
   * symmetric counterpart of {@link viewEnd} (width vs. right edge). Folded into
   * {@link ChartEngineLayout.timeWindow}, so downstream selection/positioning
   * picks up the zoom for free.
   */
  viewWindow: SharedValue<number | null>;
}

/** Single-series only: smoothed price at the visible window's right edge. */
export interface ChartEngineEdge {
  /**
   * Smoothed value at the window's right edge — the live value while following,
   * the price at `viewEnd` while scrolled back. For a `followViewEdge` badge.
   */
  edgeValue: SharedValue<number>;
}

export interface SingleEngineState extends ChartEngineLayout, ChartEngineExtrema {
  data: SharedValue<LiveChartPoint[]>;
  value: SharedValue<number>;
  displayValue: SharedValue<number>;
}

export interface MultiEngineState extends ChartEngineLayout, ChartEngineExtrema {
  data: SharedValue<LiveChartPoint[]>;
  value: SharedValue<number>;
  displayValue: SharedValue<number>;
  series: SharedValue<SeriesConfig[]>;
  displaySeriesValues: SharedValue<number[]>;
  seriesOpacities: SharedValue<number[]>;
}

export type EngineState = SingleEngineState | MultiEngineState;

/** Canvas, range, and animated live value (badge / value line). */
export type ChartEngineWithLiveValue = ChartEngineLayout & {
  displayValue: SharedValue<number>;
};

export interface EngineFrameRefs {
  data: SharedValue<LiveChartPoint[]>;
  value: SharedValue<number>;
  displayValue: SharedValue<number>;
  displayMin: SharedValue<number>;
  displayMax: SharedValue<number>;
  displayWindow: SharedValue<number>;
  canvasWidth: SharedValue<number>;
  canvasHeight: SharedValue<number>;
  timestamp: SharedValue<number>;
  timeWindow: SharedValue<number>;
  smoothing: SharedValue<number>;
  adaptiveSpeedBoostSV?: SharedValue<number | undefined>;
  exaggerateSV: SharedValue<boolean>;
  referenceValue: SharedValue<number | undefined>;
  referenceValues?: SharedValue<number[] | undefined>;
  nonNegativeSV?: SharedValue<boolean>;
  maxValueSV?: SharedValue<number | undefined>;
  nowOverrideSV?: SharedValue<number | undefined>;
  windowBufferSV?: SharedValue<number>;
  pausedSV: SharedValue<boolean>;
  /** Pan-scroll right-edge override (null = follow live). Optional for callers/tests. */
  viewEndSV?: SharedValue<number | null>;
  /** "Return to live" glide progress (0→1); the right edge eases to live. Optional. */
  returnTSV?: SharedValue<number>;
  /** Frozen right-edge time the return glide starts from. Optional. */
  returnFromSV?: SharedValue<number>;
  /** Pinch-zoom window-width override (null = follow timeWindow). Optional for callers/tests. */
  viewWindowSV?: SharedValue<number | null>;
  /** Receives the computed live edge each frame. Optional for callers/tests. */
  liveEdgeSV?: SharedValue<number>;
  /** Receives the smoothed right-edge value each frame. Optional for callers/tests. */
  edgeValueSV?: SharedValue<number>;
  /**
   * One-shot "snap the framing this frame" flag (set by the `snapKey` effect).
   * Consumed and cleared by {@link applyLiveChartEngineFrame} after the tick.
   * Optional for callers/tests.
   */
  snapSV?: SharedValue<boolean>;
  modeSV: SharedValue<"line" | "candle">;
  candles?: SharedValue<CandlePoint[]>;
  liveCandle?: SharedValue<CandlePoint | null>;
  extremaMinValue: SharedValue<number>;
  extremaMaxValue: SharedValue<number>;
  extremaMinTime: SharedValue<number>;
  extremaMaxTime: SharedValue<number>;
}

/**
 * Shared between the `useFrameCallback` worklet and unit tests.
 * Mutates shared values from a snapshot tick (`tickLiveChartEngineFrame`).
 */
export function applyLiveChartEngineFrame(
  frameInfo: { timeSincePreviousFrame?: number | null },
  sv: EngineFrameRefs,
): void {
  "worklet";
  const dt = frameInfo.timeSincePreviousFrame ?? MS_PER_FRAME_60FPS;
  // One-shot settle: a `snapKey` change set this flag; consume it for this tick
  // and clear it below so only this frame snaps (live ticks stay smoothed).
  const snap = sv.snapSV?.value ?? false;
  const state = {
    displayValue: sv.displayValue.value,
    displayMin: sv.displayMin.value,
    displayMax: sv.displayMax.value,
    displayWindow: sv.displayWindow.value,
    timestamp: sv.timestamp.value,
    liveEdge: sv.liveEdgeSV?.value ?? 0,
    edgeValue: sv.edgeValueSV?.value ?? 0,
    extremaMinValue: sv.extremaMinValue.value,
    extremaMaxValue: sv.extremaMaxValue.value,
    extremaMinTime: sv.extremaMinTime.value,
    extremaMaxTime: sv.extremaMaxTime.value,
  };
  tickLiveChartEngineFrame(state, {
    dt,
    canvasWidth: sv.canvasWidth.value,
    canvasHeight: sv.canvasHeight.value,
    timeWindow: sv.timeWindow.value,
    smoothing: sv.smoothing.value,
    adaptiveSpeedBoost: sv.adaptiveSpeedBoostSV?.value,
    exaggerate: sv.exaggerateSV.value,
    referenceValue: sv.referenceValue.value,
    referenceValues: sv.referenceValues?.value,
    nonNegative: sv.nonNegativeSV?.value ?? false,
    maxValue: sv.maxValueSV?.value,
    nowOverride: sv.nowOverrideSV?.value,
    windowBuffer: sv.windowBufferSV?.value ?? 0,
    targetValue: sv.value.value,
    points: sv.data.value,
    nowSeconds: Date.now() / 1000,
    paused: sv.pausedSV.value,
    snap,
    viewEnd: sv.viewEndSV?.value,
    returnT: sv.returnTSV?.value,
    returnFrom: sv.returnFromSV?.value,
    viewWindow: sv.viewWindowSV?.value,
    mode: sv.modeSV.value,
    candles: sv.candles?.value,
    liveCandle: sv.liveCandle?.value,
  });
  sv.displayValue.value = state.displayValue;
  sv.displayMin.value = state.displayMin;
  sv.displayMax.value = state.displayMax;
  sv.displayWindow.value = state.displayWindow;
  sv.timestamp.value = state.timestamp;
  if (sv.liveEdgeSV) sv.liveEdgeSV.value = state.liveEdge;
  if (sv.edgeValueSV) sv.edgeValueSV.value = state.edgeValue;
  sv.extremaMinValue.value = state.extremaMinValue;
  sv.extremaMaxValue.value = state.extremaMaxValue;
  sv.extremaMinTime.value = state.extremaMinTime;
  sv.extremaMaxTime.value = state.extremaMaxTime;
  // Clear the one-shot snap so the next frame eases normally again — but only
  // once a real (measured) frame consumed it. The tick early-returns on a
  // zero-size canvas (before applying the snap), so keep the flag pending until
  // the canvas has laid out, or a snap arriving pre-layout would be dropped.
  if (snap && sv.snapSV && sv.canvasWidth.value !== 0 && sv.canvasHeight.value !== 0) {
    sv.snapSV.value = false;
  }
}

export function useLiveChartEngine(
  config: EngineConfig,
): SingleEngineState & ChartEngineScroll & ChartEngineEdge {
  // Pinch-zoom window-width override (null = follow the configured window).
  // Declared first so `timeWindow` below can fold it in. Defaults to null so
  // charts without `zoom` behave exactly as before.
  const viewWindow = useSharedValue<number | null>(null);
  // A change to the `timeWindow` prop (a range / timeframe selector) is an explicit
  // request to set the window, so it clears any active pinch-zoom override —
  // otherwise the override below (`viewWindow ?? config.timeWindow`) would shadow
  // the new prop forever, and prop-driven window changes would silently no-op.
  useEffect(() => {
    viewWindow.set(null);
  }, [config.timeWindow, viewWindow]);

  // Low-frequency config → UI thread via useDerivedValue. `timeWindow` is the
  // *effective* target window: the zoom override when set, else the prop. Both
  // the tick's window lerp and the X-axis tick selection read it, so zoom flows
  // downstream for free (mirrors how viewEnd drives `timestamp`).
  const timeWindow = useDerivedValue(() => viewWindow.value ?? config.timeWindow);
  // Static charts snap to their target in one tick (smoothing=1), so the single
  // settle reaction below produces the final state with no per-frame easing.
  const smoothing = useDerivedValue(() =>
    config.static ? 1 : config.smoothing,
  );
  const adaptiveSpeedBoostSV = useDerivedValue(() => config.adaptiveSpeedBoost);
  const exaggerateSV = useDerivedValue(() => config.exaggerate ?? false);
  const referenceValue = useDerivedValue(() => config.referenceValue);
  // Captured directly (not via `config.`) so Reanimated tracks the SharedValue and
  // the merge re-runs each frame while a line is dragged; stable when idle.
  const liveReferenceValuesSV = config.liveReferenceValues;
  const referenceValues = useDerivedValue(() => {
    const base = config.referenceValues;
    const live = liveReferenceValuesSV?.value;
    if (!live || live.length === 0) return base;
    return base && base.length > 0 ? base.concat(live) : live;
  });
  const nonNegativeSV = useDerivedValue(() => config.nonNegative ?? false);
  const maxValueSV = useDerivedValue(() => config.maxValue);
  const nowOverrideSV = useDerivedValue(() => config.nowOverride);
  const windowBufferSV = useDerivedValue(() => config.windowBuffer ?? 0);
  const pausedSV = useDerivedValue(() => config.paused ?? false);
  // Whether time-scroll is active. Drives the return-to-live reaction below
  // (the tick no longer reads it — clearing `viewEnd` is what makes it follow).
  // Defaults to enabled so a caller that omits it behaves as before.
  const scrollEnabledSV = useDerivedValue(() => config.scrollEnabled ?? true);
  // Return-to-live glide duration (ms); 0 = instant snap. Read by the reaction.
  const returnToLiveMsSV = useDerivedValue(
    () => config.returnToLiveMs ?? RETURN_TO_LIVE_MS,
  );
  const modeSV = useDerivedValue(() => config.mode ?? "line");

  // Animation state (mutated on UI thread each frame)
  const displayValue = useSharedValue(0);
  const displayMin = useSharedValue(0);
  const displayMax = useSharedValue(1);
  const displayWindow = useSharedValue(config.timeWindow);
  const canvasWidth = useSharedValue(0);
  const canvasHeight = useSharedValue(0);
  // Seed once; overwritten by the frame callback on the first tick.
  const [initialTimestamp] = useState(() => Date.now() / 1000);
  const timestamp = useSharedValue(initialTimestamp);

  // Pan-scroll state. `viewEnd` null = follow live; a number freezes the right
  // edge at that absolute time. `liveEdge` mirrors the would-be-live timestamp
  // each frame so the gesture can clamp / detect catch-up. Both default to
  // "following" so charts without `timeScroll` behave exactly as before.
  const viewEnd = useSharedValue<number | null>(null);
  const liveEdge = useSharedValue(initialTimestamp);
  const edgeValue = useSharedValue(0);
  // "Return to live" glide (see #164). When time-scroll is disabled while scrolled
  // back, the reaction below clears `viewEnd`, snapshots the frozen edge into
  // `returnFrom`, and animates `returnT` 0→1; the tick eases the right edge onto
  // the live edge over that progress. `returnT` rests at 1 (no glide in flight).
  const returnT = useSharedValue(1);
  const returnFrom = useSharedValue(0);

  // Live data extrema (value + time of the visible high / low). NaN until the
  // first tick finds data — the extrema label stays hidden until then.
  const extremaMinValue = useSharedValue(NaN);
  const extremaMaxValue = useSharedValue(NaN);
  const extremaMinTime = useSharedValue(NaN);
  const extremaMaxTime = useSharedValue(NaN);

  // High-frequency data reads directly from the caller's shared values —
  // no useDerivedValue bridging, no closure serialization per tick.
  const { data, value, candles, liveCandle } = config;

  // One-shot "snap the framing" flag. The effect below flips it to `true` when
  // `snapKey` changes; the next frame consumes it (bypassing `smoothing` for the
  // window / range / value) and clears it, so a timeframe / dataset switch lands
  // in one frame while live ticks stay smoothed. See `snapKey`.
  const snapSV = useSharedValue(false);
  // Compare against the previous key (not a "first render" flag) so React 18
  // StrictMode's double-invoked mount effect can't fire a spurious snap.
  const lastSnapKey = useRef(config.snapKey);
  useEffect(() => {
    if (config.snapKey === lastSnapKey.current) return;
    lastSnapKey.current = config.snapKey;
    snapSV.set(true);
  }, [config.snapKey, snapSV]);

  // Static charts run zero per-frame loops. `isStaticSV` gates both the
  // frame-callback autostart and the one-shot settle reaction below.
  const isStaticSV = useDerivedValue(() => config.static ?? false);

  // Single refs object shared by the frame callback and the settle reaction so
  // they can never drift out of sync.
  const frameRefs: EngineFrameRefs = {
    data,
    value,
    displayValue,
    displayMin,
    displayMax,
    displayWindow,
    timestamp,
    canvasWidth,
    canvasHeight,
    timeWindow,
    smoothing,
    adaptiveSpeedBoostSV,
    exaggerateSV,
    referenceValue,
    referenceValues,
    nonNegativeSV,
    maxValueSV,
    nowOverrideSV,
    windowBufferSV,
    pausedSV,
    viewEndSV: viewEnd,
    returnTSV: returnT,
    returnFromSV: returnFrom,
    viewWindowSV: viewWindow,
    liveEdgeSV: liveEdge,
    edgeValueSV: edgeValue,
    snapSV,
    modeSV,
    candles,
    liveCandle,
    extremaMinValue,
    extremaMaxValue,
    extremaMinTime,
    extremaMaxTime,
  };

  // `autostart=false` registers the frame callback without running it — the live
  // loop is fully inert in static mode (the invariant that makes this worth it).
  useFrameCallback((frameInfo) => {
    "worklet";
    applyLiveChartEngineFrame(frameInfo, frameRefs);
  }, !config.static);

  // When time-scroll is disabled while scrolled back, return the window to the
  // live edge. With a positive duration this glides: snapshot the frozen edge into
  // `returnFrom`, clear `viewEnd` (so the tick stops freezing and follows), and
  // animate `returnT` 0→1 — the tick interpolates `returnFrom`→live by that
  // progress, landing exactly on live. Duration 0 (`returnToLive: false`) just
  // clears `viewEnd` for an instant snap. Clearing `viewEnd` also means a later
  // re-enable resumes from live, not the stale frozen position. All on the UI
  // thread, no JS round-trip. See #164.
  useAnimatedReaction(
    () => scrollEnabledSV.value,
    /* istanbul ignore next -- Reanimated reaction driven by a prop→derived change; not exercised under the SharedValue mock (see the viewWindow-reset test note), verified in-app */
    (enabled, prev) => {
      if (prev === true && !enabled && viewEnd.value != null) {
        const ms = returnToLiveMsSV.value;
        if (ms > 0) {
          returnFrom.value = viewEnd.value;
          cancelAnimation(viewEnd);
          viewEnd.value = null;
          returnT.value = 0;
          returnT.value = withTiming(1, {
            duration: ms,
            easing: Easing.out(Easing.cubic),
          });
        } else {
          cancelAnimation(viewEnd);
          viewEnd.value = null; // returnT stays 1 → tick pins to live (instant)
        }
      }
    },
  );

  // One-shot settle for static charts: the fingerprint changes when the canvas
  // lays out (width 0→real) or the framing inputs change, and the handler runs a
  // single snap tick (smoothing=1). Inert when not static — `prepare` returns a
  // constant so it never fires.
  useAnimatedReaction(
    () => {
      if (!isStaticSV.get()) return 0; // inert when not static — never changes
      const d = data.get();
      const n = d.length;
      return [
        n,
        n ? d[0].time : 0,
        n ? d[0].value : 0,
        n ? d[n - 1].time : 0,
        n ? d[n - 1].value : 0,
        value.get(),
        canvasWidth.get(),
        canvasHeight.get(),
        timeWindow.get(),
      ].join(",");
    },
    (curr, prev) => {
      if (!isStaticSV.get() || curr === prev) return;
      applyLiveChartEngineFrame(
        { timeSincePreviousFrame: MS_PER_FRAME_60FPS },
        frameRefs,
      );
    },
  );

  return {
    data,
    value,
    displayValue,
    displayMin,
    displayMax,
    displayWindow,
    timeWindow,
    canvasWidth,
    canvasHeight,
    timestamp,
    viewEnd,
    viewWindow,
    liveEdge,
    edgeValue,
    extremaMinValue,
    extremaMaxValue,
    extremaMinTime,
    extremaMaxTime,
  };
}
