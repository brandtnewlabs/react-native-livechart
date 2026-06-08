/**
 * UI-thread chart engine: time window, Y-range smoothing, and tick cadence pursue
 * the same “live chart” feel as liveline’s `requestAnimationFrame` loop; mechanism
 * here is Reanimated frame callbacks and SharedValues, not DOM canvas.
 *
 * @see https://github.com/benjitaylor/liveline
 */
import { useState } from "react";
import {
  useAnimatedReaction,
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
  /** Extra catch-up speed added to `smoothing` when the live value lags. */
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
   * Loop-free render: settle the display state once (smoothing forced to 1, no
   * per-frame frame callback) for many small charts in a list. See
   * {@link LiveChartProps.static}.
   */
  static?: boolean;
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
  adaptiveSpeedBoostSV?: SharedValue<number | undefined>;
  exaggerateSV: SharedValue<boolean>;
  referenceValue: SharedValue<number | undefined>;
  referenceValues?: SharedValue<number[] | undefined>;
  nonNegativeSV?: SharedValue<boolean>;
  maxValueSV?: SharedValue<number | undefined>;
  nowOverrideSV?: SharedValue<number | undefined>;
  windowBufferSV?: SharedValue<number>;
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
  // Static charts snap to their target in one tick (smoothing=1), so the single
  // settle reaction below produces the final state with no per-frame easing.
  const smoothing = useDerivedValue(() =>
    config.static ? 1 : config.smoothing,
  );
  const adaptiveSpeedBoostSV = useDerivedValue(() => config.adaptiveSpeedBoost);
  const exaggerateSV = useDerivedValue(() => config.exaggerate ?? false);
  const referenceValue = useDerivedValue(() => config.referenceValue);
  const referenceValues = useDerivedValue(() => config.referenceValues);
  const nonNegativeSV = useDerivedValue(() => config.nonNegative ?? false);
  const maxValueSV = useDerivedValue(() => config.maxValue);
  const nowOverrideSV = useDerivedValue(() => config.nowOverride);
  const windowBufferSV = useDerivedValue(() => config.windowBuffer ?? 0);
  const pausedSV = useDerivedValue(() => config.paused ?? false);
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

  // High-frequency data reads directly from the caller's shared values —
  // no useDerivedValue bridging, no closure serialization per tick.
  const { data, value, candles, liveCandle } = config;

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
    modeSV,
    candles,
    liveCandle,
  };

  // `autostart=false` registers the frame callback without running it — the live
  // loop is fully inert in static mode (the invariant that makes this worth it).
  useFrameCallback((frameInfo) => {
    "worklet";
    applyLiveChartEngineFrame(frameInfo, frameRefs);
  }, !config.static);

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
    canvasWidth,
    canvasHeight,
    timestamp,
  };
}
