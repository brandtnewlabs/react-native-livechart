import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { lerp } from "./math/lerp";
import type { LivelinePoint } from "./types";

export interface EngineConfig {
  data: SharedValue<LivelinePoint[]>;
  value: SharedValue<number>;
  window: number;
  lerpSpeed: number;
  exaggerate?: boolean;
  referenceValue?: number;
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

const ADAPTIVE_SPEED_BOOST = 0.12;

export function useLivelineEngine(config: EngineConfig): EngineState {
  // Low-frequency config → UI thread via useDerivedValue
  const windowSize = useDerivedValue(() => config.window);
  const lerpSpeed = useDerivedValue(() => config.lerpSpeed);
  const exaggerateSV = useDerivedValue(() => config.exaggerate ?? false);
  const referenceValue = useDerivedValue(() => config.referenceValue);

  // Animation state (mutated on UI thread each frame)
  const displayValue = useSharedValue(0);
  const displayMin = useSharedValue(0);
  const displayMax = useSharedValue(1);
  const displayWindow = useSharedValue(config.window);
  const canvasWidth = useSharedValue(0);
  const canvasHeight = useSharedValue(0);
  const timestamp = useSharedValue(Date.now() / 1000);

  // High-frequency data reads directly from the caller's shared values —
  // no useDerivedValue bridging, no closure serialization per tick.
  const { data, value } = config;

  useFrameCallback((frameInfo) => {
    "worklet";
    const dt = frameInfo.timeSincePreviousFrame ?? 16.67;
    timestamp.value = Date.now() / 1000;

    if (canvasWidth.value === 0 || canvasHeight.value === 0) return;

    const speed = lerpSpeed.value;
    const target = value.value;

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

    // Visible range — binary search on the shared data array
    const points = data.value;
    const now = timestamp.value;
    const winStart = now - displayWindow.value;

    let lo = 0;
    let hi = points.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid].time < winStart) lo = mid + 1;
      else hi = mid;
    }

    let tMin = Infinity;
    let tMax = -Infinity;
    for (let i = lo; i < points.length; i++) {
      const v = points[i].value;
      if (v < tMin) tMin = v;
      if (v > tMax) tMax = v;
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
