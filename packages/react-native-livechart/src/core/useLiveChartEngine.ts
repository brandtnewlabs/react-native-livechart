/**
 * UI-thread chart engine: time window, Y-range smoothing, and tick cadence pursue
 * the same “live chart” feel as liveline’s `requestAnimationFrame` loop; mechanism
 * here is Reanimated frame callbacks and SharedValues, not DOM canvas.
 *
 * @see https://github.com/benjitaylor/liveline
 */
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { MS_PER_FRAME_60FPS } from "../constants";
import type { CandlePoint, LiveChartPoint, SeriesConfig } from "../types";
import { tickLiveChartEngineFrame } from "./liveChartEngineTick";

export interface EngineConfig {
  data: SharedValue<LiveChartPoint[]>;
  value: SharedValue<number>;
  timeWindow: number;
  smoothing: number;
  exaggerate?: boolean;
  referenceValue?: number;
  paused?: boolean;
  mode?: "line" | "candle";
  candles?: SharedValue<CandlePoint[]>;
  liveCandle?: SharedValue<CandlePoint | null>;
}

/** Canvas, time window, and Y-range — shared by single- and multi-series engines. */
export interface ChartEngineLayout {
  displayMin: SharedValue<number>;
  displayMax: SharedValue<number>;
  displayWindow: SharedValue<number>;
  canvasWidth: SharedValue<number>;
  canvasHeight: SharedValue<number>;
  timestamp: SharedValue<number>;
}

export interface SingleEngineState extends ChartEngineLayout {
  data: SharedValue<LiveChartPoint[]>;
  value: SharedValue<number>;
  displayValue: SharedValue<number>;
}

export interface MultiEngineState extends ChartEngineLayout {
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
  exaggerateSV: SharedValue<boolean>;
  referenceValue: SharedValue<number | undefined>;
  pausedSV: SharedValue<boolean>;
  modeSV: SharedValue<"line" | "candle">;
  candles?: SharedValue<CandlePoint[]>;
  liveCandle?: SharedValue<CandlePoint | null>;
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
  const state = {
    displayValue: sv.displayValue.value,
    displayMin: sv.displayMin.value,
    displayMax: sv.displayMax.value,
    displayWindow: sv.displayWindow.value,
    timestamp: sv.timestamp.value,
  };
  tickLiveChartEngineFrame(state, {
    dt,
    canvasWidth: sv.canvasWidth.value,
    canvasHeight: sv.canvasHeight.value,
    timeWindow: sv.timeWindow.value,
    smoothing: sv.smoothing.value,
    exaggerate: sv.exaggerateSV.value,
    referenceValue: sv.referenceValue.value,
    targetValue: sv.value.value,
    points: sv.data.value,
    nowSeconds: Date.now() / 1000,
    paused: sv.pausedSV.value,
    mode: sv.modeSV.value,
    candles: sv.candles?.value,
    liveCandle: sv.liveCandle?.value,
  });
  sv.displayValue.value = state.displayValue;
  sv.displayMin.value = state.displayMin;
  sv.displayMax.value = state.displayMax;
  sv.displayWindow.value = state.displayWindow;
  sv.timestamp.value = state.timestamp;
}

export function useLiveChartEngine(config: EngineConfig): SingleEngineState {
  // Low-frequency config → UI thread via useDerivedValue
  const timeWindow = useDerivedValue(() => config.timeWindow);
  const smoothing = useDerivedValue(() => config.smoothing);
  const exaggerateSV = useDerivedValue(() => config.exaggerate ?? false);
  const referenceValue = useDerivedValue(() => config.referenceValue);
  const pausedSV = useDerivedValue(() => config.paused ?? false);
  const modeSV = useDerivedValue(() => config.mode ?? "line");

  // Animation state (mutated on UI thread each frame)
  const displayValue = useSharedValue(0);
  const displayMin = useSharedValue(0);
  const displayMax = useSharedValue(1);
  const displayWindow = useSharedValue(config.timeWindow);
  const canvasWidth = useSharedValue(0);
  const canvasHeight = useSharedValue(0);
  const timestamp = useSharedValue(Date.now() / 1000);

  // High-frequency data reads directly from the caller's shared values —
  // no useDerivedValue bridging, no closure serialization per tick.
  const { data, value, candles, liveCandle } = config;

  useFrameCallback((frameInfo) => {
    "worklet";
    applyLiveChartEngineFrame(frameInfo, {
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
      exaggerateSV,
      referenceValue,
      pausedSV,
      modeSV,
      candles,
      liveCandle,
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
  };
}
