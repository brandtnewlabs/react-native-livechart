import { useRef, useState } from "react";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { MS_PER_FRAME_60FPS } from "../constants";
import type { LiveChartPoint, SeriesConfig } from "../types";
import { tickLiveChartSeriesEngineFrame } from "./liveChartSeriesEngineTick";
import type { MultiEngineState } from "./useLiveChartEngine";

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
  });
  sv.displayMin.value = state.displayMin;
  sv.displayMax.value = state.displayMax;
  sv.displayWindow.value = state.displayWindow;
  sv.timestamp.value = state.timestamp;
  sv.displaySeriesValues.value = state.displayValues;
  sv.seriesOpacities.value = state.opacities;
  sv.extremaMinValue.value = state.extremaMinValue;
  sv.extremaMaxValue.value = state.extremaMaxValue;
  sv.extremaMinTime.value = state.extremaMinTime;
  sv.extremaMaxTime.value = state.extremaMaxTime;
}

/**
 * UI-thread engine for multi-series charts. Dummies `data` / `value` / `displayValue`
 * mirror single-series fields for hooks that still read them.
 */
export function useLiveChartSeriesEngine(
  config: MultiSeriesEngineConfig,
): MultiEngineState {
  const timeWindow = useDerivedValue(() => config.timeWindow);
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

  const displayMin = useSharedValue(0);
  const displayMax = useSharedValue(1);
  const displayWindow = useSharedValue(config.timeWindow);
  const canvasWidth = useSharedValue(0);
  const canvasHeight = useSharedValue(0);
  // Seed once; overwritten by the frame callback on the first tick.
  const [initialTimestamp] = useState(() => Date.now() / 1000);
  const timestamp = useSharedValue(initialTimestamp);

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
        extremaMinValue,
        extremaMaxValue,
        extremaMinTime,
        extremaMaxTime,
      },
      scratch,
    );
  });

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
    series,
    displaySeriesValues,
    seriesOpacities,
    extremaMinValue,
    extremaMaxValue,
    extremaMinTime,
    extremaMaxTime,
  };
}
