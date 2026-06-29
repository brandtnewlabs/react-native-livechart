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
import type { LiveChartPoint, SeriesConfig } from "../types";
import { tickLiveChartSeriesEngineFrame } from "./liveChartSeriesEngineTick";
import type { ChartEngineScroll, MultiEngineState } from "./useLiveChartEngine";

export interface MultiSeriesEngineConfig {
  series: SharedValue<SeriesConfig[]>;
  timeWindow: number;
  smoothing: number;
  /** Extra catch-up speed added to `smoothing` when a series tip lags. */
  adaptiveSpeedBoost?: number;
  exaggerate?: boolean;
  referenceValue?: number;
  referenceValues?: number[];
  nonNegative?: boolean;
  maxValue?: number;
  nowOverride?: number;
  windowBuffer?: number;
  paused?: boolean;
  /**
   * Whether the `timeScroll` gesture is active. Flipping to `false` while scrolled
   * back clears {@link ChartEngineScroll.viewEnd} and **glides** the window back to
   * the live edge (eased, not an instant jump), so disabling time-scroll never
   * strands the chart at a past position. See #164.
   */
  scrollEnabled?: boolean;
  /**
   * Duration (ms) of the return-to-live glide when {@link scrollEnabled} flips to
   * `false` while scrolled back. `0` snaps instantly. Defaults to
   * {@link RETURN_TO_LIVE_MS}. Resolved from `timeScroll.returnToLive`. See #164.
   */
  returnToLiveMs?: number;
  /**
   * Opaque key that snaps the framing to its target in one frame whenever it
   * changes (the next tick bypasses `smoothing` for the window, Y-range, and
   * series tips, then normal easing resumes). Lets a timeframe / dataset switch
   * land instantly while live ticks stay smooth. See {@link LiveChartSeriesProps.snapKey}.
   */
  snapKey?: string | number;
}

export interface MultiEngineFrameRefs {
  series: SharedValue<SeriesConfig[]>;
  displaySeriesValues: SharedValue<number[]>;
  seriesOpacities: SharedValue<number[]>;
  displayMin: SharedValue<number>;
  displayMax: SharedValue<number>;
  displayWindow: SharedValue<number>;
  timestamp: SharedValue<number>;
  canvasWidth: SharedValue<number>;
  canvasHeight: SharedValue<number>;
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
  /**
   * One-shot "snap the framing this frame" flag (set by the `snapKey` effect).
   * Consumed and cleared by {@link applyLiveChartSeriesEngineFrame} after the
   * tick. Optional for callers/tests.
   */
  snapSV?: SharedValue<boolean>;
  extremaMinValue: SharedValue<number>;
  extremaMaxValue: SharedValue<number>;
  extremaMinTime: SharedValue<number>;
  extremaMaxTime: SharedValue<number>;
}

/**
 * Reusable per-frame scratch for {@link applyLiveChartSeriesEngineFrame}. The two
 * output arrays ping-pong so the assigned reference still changes each frame
 * (Reanimated propagates on reference change) without allocating a fresh array
 * per frame. Create one per engine (the React Compiler keeps it stable).
 */
export interface MultiSeriesEngineScratch {
  dvA: number[];
  dvB: number[];
  opA: number[];
  opB: number[];
  tick: boolean;
}

/**
 * One frame of the multi-series chart engine.
 * Mirrors `applyLiveChartEngineFrame` but iterates over each series
 * to lerp per-series display values and opacities. Extracted as a
 * pure function so it can be called from both `useFrameCallback` and tests.
 *
 * Pass `scratch` to reuse the output arrays across frames instead of allocating
 * two via `.slice()` each frame; omit it (tests) to fall back to allocation.
 */
export function applyLiveChartSeriesEngineFrame(
  frameInfo: { timeSincePreviousFrame?: number | null },
  sv: MultiEngineFrameRefs,
  scratch?: MultiSeriesEngineScratch,
): void {
  "worklet";
  const dt = frameInfo.timeSincePreviousFrame ?? MS_PER_FRAME_60FPS;
  // One-shot settle: a `snapKey` change set this flag; consume it for this tick
  // and clear it below so only this frame snaps (live ticks stay smoothed).
  const snap = sv.snapSV?.value ?? false;
  const seriesSnap = sv.series.value;
  const curDv = sv.displaySeriesValues.value;
  const curOp = sv.seriesOpacities.value;
  let displayValues: number[];
  let opacities: number[];
  if (scratch) {
    scratch.tick = !scratch.tick;
    displayValues = scratch.tick ? scratch.dvA : scratch.dvB;
    opacities = scratch.tick ? scratch.opA : scratch.opB;
    displayValues.length = curDv.length;
    for (let i = 0; i < curDv.length; i++) displayValues[i] = curDv[i];
    opacities.length = curOp.length;
    for (let i = 0; i < curOp.length; i++) opacities[i] = curOp[i];
  } else {
    displayValues = curDv.slice();
    opacities = curOp.slice();
  }
  const state = {
    displayMin: sv.displayMin.value,
    displayMax: sv.displayMax.value,
    displayWindow: sv.displayWindow.value,
    timestamp: sv.timestamp.value,
    liveEdge: sv.liveEdgeSV?.value ?? 0,
    displayValues,
    opacities,
    extremaMinValue: sv.extremaMinValue.value,
    extremaMaxValue: sv.extremaMaxValue.value,
    extremaMinTime: sv.extremaMinTime.value,
    extremaMaxTime: sv.extremaMaxTime.value,
  };
  tickLiveChartSeriesEngineFrame(state, {
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
    series: seriesSnap,
    nowSeconds: Date.now() / 1000,
    paused: sv.pausedSV.value,
    snap,
    viewEnd: sv.viewEndSV?.value,
    returnT: sv.returnTSV?.value,
    returnFrom: sv.returnFromSV?.value,
    viewWindow: sv.viewWindowSV?.value,
  });
  sv.displayMin.value = state.displayMin;
  sv.displayMax.value = state.displayMax;
  sv.displayWindow.value = state.displayWindow;
  sv.timestamp.value = state.timestamp;
  if (sv.liveEdgeSV) sv.liveEdgeSV.value = state.liveEdge;
  sv.displaySeriesValues.value = state.displayValues;
  sv.seriesOpacities.value = state.opacities;
  sv.extremaMinValue.value = state.extremaMinValue;
  sv.extremaMaxValue.value = state.extremaMaxValue;
  sv.extremaMinTime.value = state.extremaMinTime;
  sv.extremaMaxTime.value = state.extremaMaxTime;
  // Clear the one-shot snap so the next frame eases normally again — but only
  // once a real (measured) frame consumed it (the tick early-returns on a
  // zero-size canvas before applying the snap). See applyLiveChartEngineFrame.
  if (snap && sv.snapSV && sv.canvasWidth.value !== 0 && sv.canvasHeight.value !== 0) {
    sv.snapSV.value = false;
  }
}

/**
 * UI-thread engine for multi-series charts. Dummies `data` / `value` / `displayValue`
 * mirror single-series fields for hooks that still read them.
 */
export function useLiveChartSeriesEngine(
  config: MultiSeriesEngineConfig,
): MultiEngineState & ChartEngineScroll {
  // Pinch-zoom window-width override (null = follow the configured window).
  // Declared first so `timeWindow` folds it in — see useLiveChartEngine.
  const viewWindow = useSharedValue<number | null>(null);
  const timeWindow = useDerivedValue(() => viewWindow.value ?? config.timeWindow);
  const smoothing = useDerivedValue(() => config.smoothing);
  const adaptiveSpeedBoostSV = useDerivedValue(() => config.adaptiveSpeedBoost);
  const exaggerateSV = useDerivedValue(() => config.exaggerate ?? false);
  const referenceValue = useDerivedValue(() => config.referenceValue);
  const referenceValues = useDerivedValue(() => config.referenceValues);
  const nonNegativeSV = useDerivedValue(() => config.nonNegative ?? false);
  const maxValueSV = useDerivedValue(() => config.maxValue);
  const nowOverrideSV = useDerivedValue(() => config.nowOverride);
  const windowBufferSV = useDerivedValue(() => config.windowBuffer ?? 0);
  const pausedSV = useDerivedValue(() => config.paused ?? false);
  // Whether time-scroll is active — drives the return-to-live reaction below.
  // Defaults to enabled (legacy behavior).
  const scrollEnabledSV = useDerivedValue(() => config.scrollEnabled ?? true);
  // Return-to-live glide duration (ms); 0 = instant snap. Read by the reaction.
  const returnToLiveMsSV = useDerivedValue(
    () => config.returnToLiveMs ?? RETURN_TO_LIVE_MS,
  );

  const displayMin = useSharedValue(0);
  const displayMax = useSharedValue(1);
  const displayWindow = useSharedValue(config.timeWindow);
  const canvasWidth = useSharedValue(0);
  const canvasHeight = useSharedValue(0);
  // Seed once; overwritten by the frame callback on the first tick.
  const [initialTimestamp] = useState(() => Date.now() / 1000);
  const timestamp = useSharedValue(initialTimestamp);

  // Pan-scroll state (see useLiveChartEngine). Defaults to following live.
  const viewEnd = useSharedValue<number | null>(null);
  const liveEdge = useSharedValue(initialTimestamp);
  // "Return to live" glide (see #164) — `returnT` rests at 1; the reaction below
  // animates it 0→1 from `returnFrom` when time-scroll is disabled while scrolled.
  const returnT = useSharedValue(1);
  const returnFrom = useSharedValue(0);

  const displaySeriesValues = useSharedValue<number[]>([]);
  const seriesOpacities = useSharedValue<number[]>([]);

  // Live data extrema (value + time of the visible high / low across series).
  const extremaMinValue = useSharedValue(NaN);
  const extremaMaxValue = useSharedValue(NaN);
  const extremaMinTime = useSharedValue(NaN);
  const extremaMaxTime = useSharedValue(NaN);

  const data = useSharedValue<LiveChartPoint[]>([]);
  const value = useSharedValue(0);
  const displayValue = useSharedValue(0);

  // One-shot "snap the framing" flag — flipped by the effect when `snapKey`
  // changes, consumed + cleared by the next frame (mirrors useLiveChartEngine).
  const snapSV = useSharedValue(false);
  const lastSnapKey = useRef(config.snapKey);
  useEffect(() => {
    if (config.snapKey === lastSnapKey.current) return;
    lastSnapKey.current = config.snapKey;
    snapSV.set(true);
  }, [config.snapKey, snapSV]);

  const { series } = config;

  // Reused per-frame output buffers (ping-ponged) — see applyLiveChartSeriesEngineFrame.
  const scratchRef = useRef<MultiSeriesEngineScratch | null>(null);
  if (scratchRef.current === null) {
    scratchRef.current = { dvA: [], dvB: [], opA: [], opB: [], tick: false };
  }

  useFrameCallback((frameInfo) => {
    "worklet";
    const scratch = scratchRef.current!;
    applyLiveChartSeriesEngineFrame(
      frameInfo,
      {
        series,
        displaySeriesValues,
        seriesOpacities,
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
        snapSV,
        extremaMinValue,
        extremaMaxValue,
        extremaMinTime,
        extremaMaxTime,
      },
      scratch,
    );
  });

  // Return the window to live when time-scroll is disabled while scrolled back
  // (mirrors useLiveChartEngine): with a positive duration, glide — snapshot the
  // frozen edge, clear `viewEnd`, and animate `returnT` 0→1 so the tick eases
  // `returnFrom`→live; duration 0 just clears `viewEnd` for an instant snap.
  // Clearing `viewEnd` also means a later re-enable resumes from live. See #164.
  useAnimatedReaction(
    () => scrollEnabledSV.value,
    /* istanbul ignore next -- Reanimated reaction driven by a prop→derived change; not exercised under the SharedValue mock, verified in-app */
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
          viewEnd.value = null;
        }
      }
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
    series,
    displaySeriesValues,
    seriesOpacities,
    extremaMinValue,
    extremaMaxValue,
    extremaMinTime,
    extremaMaxTime,
  };
}
