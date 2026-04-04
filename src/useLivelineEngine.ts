import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { tickLivelineEngineFrame } from "./livelineEngineTick";
import type { LivelinePoint } from "./types";

export interface EngineConfig {
  data: SharedValue<LivelinePoint[]>;
  value: SharedValue<number>;
  timeWindow: number;
  smoothing: number;
  exaggerate?: boolean;
  referenceValue?: number;
  paused?: boolean;
}

export interface EngineState {
  data: SharedValue<LivelinePoint[]>;
  value: SharedValue<number>;
  displayValue: SharedValue<number>;
  displayMin: SharedValue<number>;
  displayMax: SharedValue<number>;
  displayWindow: SharedValue<number>;
  canvasWidth: SharedValue<number>;
  canvasHeight: SharedValue<number>;
  timestamp: SharedValue<number>;
}

export interface EngineFrameRefs {
  data: SharedValue<LivelinePoint[]>;
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
}

/**
 * Shared between the `useFrameCallback` worklet and unit tests.
 * Mutates shared values from a snapshot tick (`tickLivelineEngineFrame`).
 */
export function applyLivelineEngineFrame(
  frameInfo: { timeSincePreviousFrame?: number | null },
  sv: EngineFrameRefs,
): void {
  "worklet";
  const dt = frameInfo.timeSincePreviousFrame ?? 16.67;
  const state = {
    displayValue: sv.displayValue.value,
    displayMin: sv.displayMin.value,
    displayMax: sv.displayMax.value,
    displayWindow: sv.displayWindow.value,
    timestamp: sv.timestamp.value,
  };
  tickLivelineEngineFrame(state, {
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
  });
  sv.displayValue.value = state.displayValue;
  sv.displayMin.value = state.displayMin;
  sv.displayMax.value = state.displayMax;
  sv.displayWindow.value = state.displayWindow;
  sv.timestamp.value = state.timestamp;
}

export function useLivelineEngine(config: EngineConfig): EngineState {
  // Low-frequency config → UI thread via useDerivedValue
  const timeWindow = useDerivedValue(() => config.timeWindow);
  const smoothing = useDerivedValue(() => config.smoothing);
  const exaggerateSV = useDerivedValue(() => config.exaggerate ?? false);
  const referenceValue = useDerivedValue(() => config.referenceValue);
  const pausedSV = useDerivedValue(() => config.paused ?? false);

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
  const { data, value } = config;

  useFrameCallback((frameInfo) => {
    "worklet";
    applyLivelineEngineFrame(frameInfo, {
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
