import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { lerp } from "./math/lerp";
import type { LivelinePoint } from "./types";

export interface EngineConfig {
  data: LivelinePoint[];
  value: number;
  window: number;
  lerpSpeed: number;
  exaggerate?: boolean;
  referenceValue?: number;
}

export interface EngineState {
  dataPoints: SharedValue<LivelinePoint[]>;
  currentValue: SharedValue<number>;
  displayValue: SharedValue<number>;
  displayMin: SharedValue<number>;
  displayMax: SharedValue<number>;
  displayWindow: SharedValue<number>;
  canvasWidth: SharedValue<number>;
  canvasHeight: SharedValue<number>;
}

const ADAPTIVE_SPEED_BOOST = 0.12;

export function useLivelineEngine(config: EngineConfig): EngineState {
  // Props → UI thread (readonly, synchronous during render)
  const dataPoints = useDerivedValue(() => config.data);
  const currentValue = useDerivedValue(() => config.value);
  const lerpSpeed = useDerivedValue(() => config.lerpSpeed);
  const windowSize = useDerivedValue(() => config.window);
  const exaggerateSV = useDerivedValue(() => config.exaggerate ?? false);
  const referenceValue = useDerivedValue(() => config.referenceValue);

  // Animation state (read-write, mutated on UI thread each frame)
  const displayValue = useSharedValue(0);
  const displayMin = useSharedValue(0);
  const displayMax = useSharedValue(1);
  const displayWindow = useSharedValue(config.window);
  const canvasWidth = useSharedValue(0);
  const canvasHeight = useSharedValue(0);

  // Animation loop on UI thread
  useFrameCallback((frameInfo) => {
    "worklet";
    const dt = frameInfo.timeSincePreviousFrame ?? 16.67;
    if (canvasWidth.value === 0 || canvasHeight.value === 0) return;

    const speed = lerpSpeed.value;
    const target = currentValue.value;

    // Adaptive speed: small ticks animate faster, big jumps slower
    const range = displayMax.value - displayMin.value;
    const gapRatio =
      range > 0
        ? Math.min(Math.abs(target - displayValue.value) / range, 1)
        : 0;
    const adaptiveSpeed = speed + (1 - gapRatio) * ADAPTIVE_SPEED_BOOST;

    displayValue.value = lerp(displayValue.value, target, adaptiveSpeed, dt);

    // Lerp window
    displayWindow.value = lerp(
      displayWindow.value,
      windowSize.value,
      speed,
      dt,
    );

    // Compute visible range from data
    const data = dataPoints.value;
    const now = Date.now() / 1000;
    const winStart = now - displayWindow.value;

    let tMin = Infinity;
    let tMax = -Infinity;
    for (let i = 0; i < data.length; i++) {
      if (data[i].time >= winStart) {
        const v = data[i].value;
        if (v < tMin) tMin = v;
        if (v > tMax) tMax = v;
      }
    }

    // Include current display value
    const cv = displayValue.value;
    if (cv < tMin) tMin = cv;
    if (cv > tMax) tMax = cv;

    // Include reference line
    const ref = referenceValue.value;
    if (ref !== undefined) {
      if (ref < tMin) tMin = ref;
      if (ref > tMax) tMax = ref;
    }

    // Apply margin
    const isExaggerate = exaggerateSV.value;
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

      // Snap outward instantly, lerp inward (prevents clipping)
      if (tMin < displayMin.value) {
        displayMin.value = tMin;
      } else {
        displayMin.value = lerp(displayMin.value, tMin, speed, dt);
      }

      if (tMax > displayMax.value) {
        displayMax.value = tMax;
      } else {
        displayMax.value = lerp(displayMax.value, tMax, speed, dt);
      }
    }
  });

  return {
    dataPoints,
    currentValue,
    displayValue,
    displayMin,
    displayMax,
    displayWindow,
    canvasWidth,
    canvasHeight,
  };
}
