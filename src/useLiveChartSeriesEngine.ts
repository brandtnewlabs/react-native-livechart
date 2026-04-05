import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { MS_PER_FRAME_60FPS } from "./constants";
import { tickLiveChartSeriesEngineFrame } from "./liveChartSeriesEngineTick";
import type { LiveChartPoint, SeriesConfig } from "./types";
import type { MultiEngineState } from "./useLiveChartEngine";

export interface MultiSeriesEngineConfig {
  series: SharedValue<SeriesConfig[]>;
  timeWindow: number;
  smoothing: number;
  exaggerate?: boolean;
  referenceValue?: number;
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
  exaggerateSV: SharedValue<boolean>;
  referenceValue: SharedValue<number | undefined>;
  pausedSV: SharedValue<boolean>;
}

/**
 * One frame of the multi-series chart engine.
 * Mirrors `applyLiveChartEngineFrame` but iterates over each series
 * to lerp per-series display values and opacities. Extracted as a
 * pure function so it can be called from both `useFrameCallback` and tests.
 */
export function applyLiveChartSeriesEngineFrame(
  frameInfo: { timeSincePreviousFrame?: number | null },
  sv: MultiEngineFrameRefs,
): void {
  "worklet";
  const dt = frameInfo.timeSincePreviousFrame ?? MS_PER_FRAME_60FPS;
  const seriesSnap = sv.series.value;
  const displayValues = sv.displaySeriesValues.value.slice();
  const opacities = sv.seriesOpacities.value.slice();
  const state = {
    displayMin: sv.displayMin.value,
    displayMax: sv.displayMax.value,
    displayWindow: sv.displayWindow.value,
    timestamp: sv.timestamp.value,
    displayValues,
    opacities,
  };
  tickLiveChartSeriesEngineFrame(state, {
    dt,
    canvasWidth: sv.canvasWidth.value,
    canvasHeight: sv.canvasHeight.value,
    timeWindow: sv.timeWindow.value,
    smoothing: sv.smoothing.value,
    exaggerate: sv.exaggerateSV.value,
    referenceValue: sv.referenceValue.value,
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
  const exaggerateSV = useDerivedValue(() => config.exaggerate ?? false);
  const referenceValue = useDerivedValue(() => config.referenceValue);
  const pausedSV = useDerivedValue(() => config.paused ?? false);

  const displayMin = useSharedValue(0);
  const displayMax = useSharedValue(1);
  const displayWindow = useSharedValue(config.timeWindow);
  const canvasWidth = useSharedValue(0);
  const canvasHeight = useSharedValue(0);
  const timestamp = useSharedValue(Date.now() / 1000);

  const displaySeriesValues = useSharedValue<number[]>([]);
  const seriesOpacities = useSharedValue<number[]>([]);

  const data = useSharedValue<LiveChartPoint[]>([]);
  const value = useSharedValue(0);
  const displayValue = useSharedValue(0);

  const { series } = config;

  useFrameCallback((frameInfo) => {
    "worklet";
    applyLiveChartSeriesEngineFrame(frameInfo, {
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
      exaggerateSV,
      referenceValue,
      pausedSV,
    });
  });

  return {
    data,
    value,
    displayValue,
    displayMin,
    displayMax,
    displayWindow,
    canvasWidth,
    canvasHeight,
    timestamp,
    series,
    displaySeriesValues,
    seriesOpacities,
  };
}
