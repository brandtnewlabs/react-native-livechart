import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { LiveChartPoint } from "react-native-livechart";
import {
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

export type PhantomTimeframe = "live" | "15m" | "1h" | "1d" | "1w";

export const PHANTOM_TIMEFRAMES: readonly PhantomTimeframe[] = [
  "live",
  "15m",
  "1h",
  "1d",
  "1w",
];

export const PHANTOM_TIMEFRAME_SECONDS: Readonly<
  Record<PhantomTimeframe, number>
> = {
  live: 30,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "1d": 24 * 60 * 60,
  "1w": 7 * 24 * 60 * 60,
};

export const PHANTOM_TIMEFRAME_SAMPLE_SECONDS: Readonly<
  Record<PhantomTimeframe, number>
> = {
  live: 0.1,
  "15m": 2,
  "1h": 10,
  "1d": 120,
  "1w": 900,
};

const PHANTOM_HISTORY_FILTER_BUCKETS: Readonly<
  Record<PhantomTimeframe, number>
> = {
  live: 0,
  "15m": 0,
  "1h": 0,
  "1d": 2,
  "1w": 48,
};

const HISTORY_FILTER_SAMPLE_COUNT = 9;
const ENDPOINT_RECONCILIATION_BUCKETS = 12;

export type PhantomMarketOutcome = {
  side: "up" | "down" | "at";
  text: string;
};

/** Format header copy, treating a percent that rounds to 0.00 as at-target. */
export function formatPhantomMarketOutcome(
  currentValue: number,
  targetValue: number,
): PhantomMarketOutcome {
  const delta = currentValue - targetValue;
  const percent = targetValue === 0 ? 0 : (delta / targetValue) * 100;
  const displayPercent = Math.abs(percent).toFixed(2);

  if (displayPercent === "0.00") return { side: "at", text: "0.00% at target" };
  return delta > 0
    ? { side: "up", text: `+${displayPercent}% above target` }
    : { side: "down", text: `−${displayPercent}% below target` };
}

const LIVE_VALUE_INTERVAL_MS = 1000 / 30;
const LIVE_POINT_EVERY_TICKS = 3;
const LIVE_BUFFER_SECONDS = 34;
const TIMEFRAME_LOADING_MS = 1000;
const TIMEFRAME_FADE_IN_MS = 200;
const TIMEFRAME_DATA_MORPH_MS = 500;

function wallClockNow(): number {
  return Date.now();
}

const HASH_UNIT = 1 / 4_294_967_295;

/** Stable signed pseudo-random value for a time lattice point. */
function latticeHash(index: number, seed: number): number {
  let value = (Math.floor(index) | 0) ^ seed;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  value ^= value >>> 15;
  return (value >>> 0) * HASH_UNIT * 2 - 1;
}

/** Quintic-smoothed value noise: continuous position and velocity at each knot. */
function marketNoise(
  timeSeconds: number,
  knotSeconds: number,
  seed: number,
): number {
  const position = timeSeconds / knotSeconds;
  const left = Math.floor(position);
  const fraction = position - left;
  const fade =
    fraction * fraction * fraction * (fraction * (fraction * 6 - 15) + 10);
  const from = latticeHash(left, seed);
  return from + (latticeHash(left + 1, seed) - from) * fade;
}

/**
 * Occasional directional pushes with a quick onset and slower mean reversion.
 * Events are derived from wall-clock blocks, so every timeframe observes the
 * same move without keeping mutable random-walk state.
 */
function marketImpulses(timeSeconds: number): number {
  const blockSeconds = 47;
  const currentBlock = Math.floor(timeSeconds / blockSeconds);
  let impulse = 0;

  for (let offset = 0; offset < 4; offset += 1) {
    const block = currentBlock - offset;
    const trigger = (latticeHash(block, 0x45d9f3b) + 1) / 2;
    if (trigger < 0.78) continue;

    const eventOffset = 4 + ((latticeHash(block, 0x119de1f3) + 1) / 2) * 39;
    const age = timeSeconds - (block * blockSeconds + eventOffset);
    if (age < 0 || age > 150) continue;

    const direction = latticeHash(block, 0x27d4eb2d) >= 0 ? 1 : -1;
    const strength = (trigger - 0.78) / 0.22;
    const response = (1 - Math.exp(-age / 1.4)) * Math.exp(-age / 34);
    impulse += direction * strength * 0.018 * response;
  }

  return impulse;
}

/**
 * Deterministic, time-addressable SOL-like market path shared by every range.
 * Layered non-periodic noise provides regime drift, clustered volatility, and
 * microstructure; sparse impulses add asymmetric moves and mean reversion.
 */
export function phantomPriceAt(timeSeconds: number): number {
  const t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  const volatility =
    0.62 +
    0.42 * ((marketNoise(t, 240, 0x165667b1) + 1) / 2) +
    0.28 * Math.abs(marketNoise(t, 71, 0x9e3779b9));

  const regime =
    0.17 * marketNoise(t, 4.8 * 24 * 60 * 60, 0x12c6a7d5) +
    0.11 * marketNoise(t, 29 * 60 * 60, 0x2c1b3c6d) +
    0.065 * marketNoise(t, 5.2 * 60 * 60, 0x297a2d39) +
    0.038 * marketNoise(t, 52 * 60, 0x68e31da4);

  const trading =
    0.026 * marketNoise(t, 9 * 60, 0x7feb352d) +
    0.016 * marketNoise(t, 125, 0x846ca68b) +
    0.01 * marketNoise(t, 31, 0x3c6ef372) +
    0.006 * marketNoise(t, 8.5, 0xa54ff53a) +
    0.003 * marketNoise(t, 2.2, 0x510e527f) +
    0.0012 * marketNoise(t, 0.48, 0x1f83d9ab);

  return 76 + regime + volatility * trading + marketImpulses(t);
}

/**
 * Causal triangular aggregation for ranges whose display buckets are too wide
 * to represent the source's short-lived moves without aliasing.
 */
function aggregatePhantomPriceAt(
  timeSeconds: number,
  filterSeconds: number,
  filterSampleCount: number,
): number {
  if (filterSeconds <= 0) return phantomPriceAt(timeSeconds);

  let weightedValue = 0;
  let totalWeight = 0;
  for (let index = 0; index < filterSampleCount; index += 1) {
    const progress = index / (filterSampleCount - 1);
    const sampleTime = timeSeconds - filterSeconds * (1 - progress);
    const weight = index + 1;
    weightedValue += phantomPriceAt(sampleTime) * weight;
    totalWeight += weight;
  }
  return weightedValue / totalWeight;
}

function smoothstep(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return clamped * clamped * (3 - 2 * clamped);
}

export function buildPhantomTimeframeData(
  timeframe: PhantomTimeframe,
  endTimeSeconds: number,
): LiveChartPoint[] {
  const windowSeconds = PHANTOM_TIMEFRAME_SECONDS[timeframe];
  const sampleSeconds = PHANTOM_TIMEFRAME_SAMPLE_SECONDS[timeframe];
  const sampleCount = Math.max(2, Math.ceil(windowSeconds / sampleSeconds));
  const startTime = endTimeSeconds - windowSeconds;
  const points: LiveChartPoint[] = [];
  const filterSeconds =
    sampleSeconds * PHANTOM_HISTORY_FILTER_BUCKETS[timeframe];
  const filterSampleCount = Math.max(
    HISTORY_FILTER_SAMPLE_COUNT,
    PHANTOM_HISTORY_FILTER_BUCKETS[timeframe] + 1,
  );
  const filteredEndValue = aggregatePhantomPriceAt(
    endTimeSeconds,
    filterSeconds,
    filterSampleCount,
  );
  const endpointCorrection = phantomPriceAt(endTimeSeconds) - filteredEndValue;
  const reconciliationSeconds = sampleSeconds * ENDPOINT_RECONCILIATION_BUCKETS;

  for (let index = 0; index <= sampleCount; index++) {
    const progress = index / sampleCount;
    const time = startTime + windowSeconds * progress;
    const correctionProgress =
      reconciliationSeconds === 0
        ? 0
        : 1 - (endTimeSeconds - time) / reconciliationSeconds;
    points.push({
      time,
      value:
        aggregatePhantomPriceAt(time, filterSeconds, filterSampleCount) +
        endpointCorrection * smoothstep(correctionProgress),
    });
  }
  return points;
}

export interface PhantomTimeframeMorphPair {
  from: LiveChartPoint[];
  to: LiveChartPoint[];
}

function samplePhantomRangeAtProgress(
  points: readonly LiveChartPoint[],
  progress: number,
): LiveChartPoint {
  const position = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const leftIndex = Math.floor(position);
  const rightIndex = Math.min(points.length - 1, leftIndex + 1);
  const amount = position - leftIndex;
  const left = points[leftIndex];
  const right = points[rightIndex];
  return {
    time: left.time + (right.time - left.time) * amount,
    value: left.value + (right.value - left.value) * amount,
  };
}

/** Normalize differently-sized ranges onto the incoming range's X coordinates. */
export function alignPhantomTimeframeMorph(
  previous: readonly LiveChartPoint[],
  next: readonly LiveChartPoint[],
): PhantomTimeframeMorphPair {
  if (previous.length < 2 || next.length < 2) {
    return { from: [...next], to: [...next] };
  }

  const pointCount = Math.max(previous.length, next.length);
  const from: LiveChartPoint[] = [];
  const to: LiveChartPoint[] = [];
  for (let index = 0; index < pointCount; index += 1) {
    const progress = index / (pointCount - 1);
    const previousPoint = samplePhantomRangeAtProgress(previous, progress);
    const nextPoint = samplePhantomRangeAtProgress(next, progress);
    from.push({ time: nextPoint.time, value: previousPoint.value });
    to.push(nextPoint);
  }

  // The chart's synthetic live tip was already at the current price. Keep that
  // right-edge anchor fixed while the historical shape changes underneath it.
  from[pointCount - 1].value = to[pointCount - 1].value;
  return { from, to };
}

/** Interpolate two pre-aligned timeframe shapes. */
export function interpolatePhantomTimeframeMorph(
  from: readonly LiveChartPoint[],
  to: readonly LiveChartPoint[],
  progress: number,
): LiveChartPoint[] {
  "worklet";
  const amount = Math.max(0, Math.min(1, progress));
  const count = Math.min(from.length, to.length);
  const points: LiveChartPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    points.push({
      time: to[index].time,
      value: from[index].value + (to[index].value - from[index].value) * amount,
    });
  }
  return points;
}

export interface PhantomMarketSimulation {
  displayData: SharedValue<LiveChartPoint[]>;
  value: SharedValue<number>;
  seriesOpacity: SharedValue<number>;
  selectedTimeframe: PhantomTimeframe;
  committedTimeframe: PhantomTimeframe;
  dataSnapVersion: number;
  isLoadingTimeframe: boolean;
  selectTimeframe: (next: PhantomTimeframe) => void;
}

interface PhantomSimulationOptions {
  /** Test-only wall clock injection. */
  now?: () => number;
  /** Test-only loading duration override. */
  loadingDelayMs?: number;
  /** Test-only live scalar tick duration override. */
  liveValueIntervalMs?: number;
  /** Test-only fade duration override for runtimes without native animation. */
  fadeInDurationMs?: number;
  /** Test-only dataset morph duration override. */
  morphDurationMs?: number;
}

/** One stable chart feed with a retain/dim/write/snap/morph/fade transition. */
export function usePhantomMarketSimulation(
  options: PhantomSimulationOptions = {},
): PhantomMarketSimulation {
  const {
    now = wallClockNow,
    loadingDelayMs = TIMEFRAME_LOADING_MS,
    liveValueIntervalMs = LIVE_VALUE_INTERVAL_MS,
    fadeInDurationMs = TIMEFRAME_FADE_IN_MS,
    morphDurationMs = TIMEFRAME_DATA_MORPH_MS,
  } = options;
  const nowRef = useRef(now);
  useEffect(() => {
    nowRef.current = now;
  }, [now]);

  const [initialNowSeconds] = useState(() => now() / 1000);
  const [initialData] = useState(() =>
    buildPhantomTimeframeData("live", initialNowSeconds),
  );
  const displayData = useSharedValue<LiveChartPoint[]>(initialData);
  const value = useSharedValue(phantomPriceAt(initialNowSeconds));
  const seriesOpacity = useSharedValue(1);

  const [selectedTimeframe, setSelectedTimeframe] =
    useState<PhantomTimeframe>("live");
  const [committedTimeframe, setCommittedTimeframe] =
    useState<PhantomTimeframe>("live");
  const [dataSnapVersion, setDataSnapVersion] = useState(0);

  const selectedRef = useRef<PhantomTimeframe>("live");
  const committedRef = useRef<PhantomTimeframe>("live");
  const requestVersion = useRef(0);
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleFrame = useRef<number | null>(null);
  const morphFrame = useRef<number | null>(null);
  const finalDataRef = useRef<LiveChartPoint[]>(initialData);

  const selectTimeframe = useCallback(
    (next: PhantomTimeframe) => {
      if (next === selectedRef.current) return;

      requestVersion.current += 1;
      const version = requestVersion.current;
      selectedRef.current = next;
      setSelectedTimeframe(next);

      if (loadingTimer.current !== null) {
        clearTimeout(loadingTimer.current);
        loadingTimer.current = null;
      }
      if (settleFrame.current !== null) {
        cancelAnimationFrame(settleFrame.current);
        settleFrame.current = null;
      }

      // Returning to the still-rendered range only cancels the pending request.
      if (next === committedRef.current) {
        seriesOpacity.set(
          fadeInDurationMs === 0
            ? 1
            : withTiming(1, { duration: fadeInDurationMs }),
        );
        return;
      }

      seriesOpacity.set(0.5);
      loadingTimer.current = setTimeout(() => {
        loadingTimer.current = null;
        if (version !== requestVersion.current) return;

        const endTimeSeconds = nowRef.current() / 1000;
        const replacement = buildPhantomTimeframeData(next, endTimeSeconds);
        committedRef.current = next;
        setCommittedTimeframe(next);
        if (morphDurationMs === 0) {
          finalDataRef.current = replacement;
          displayData.set(replacement);
          value.set(phantomPriceAt(endTimeSeconds));
          setDataSnapVersion((current) => current + 1);
          seriesOpacity.set(
            fadeInDurationMs === 0
              ? 1
              : withTiming(1, { duration: fadeInDurationMs }),
          );
          return;
        }
        // Commit the new timeWindow first. The following frame installs the old
        // normalized shape on the new X coordinates and snaps the framing; the
        // frame after that starts the actual point-for-point path morph.
        settleFrame.current = requestAnimationFrame(() => {
          settleFrame.current = null;
          if (version !== requestVersion.current) return;

          if (morphFrame.current !== null) {
            cancelAnimationFrame(morphFrame.current);
            morphFrame.current = null;
          }
          const aligned = alignPhantomTimeframeMorph(
            displayData.get(),
            replacement,
          );
          finalDataRef.current = replacement;
          displayData.set(aligned.from);
          value.set(phantomPriceAt(endTimeSeconds));
          setDataSnapVersion((current) => current + 1);

          settleFrame.current = requestAnimationFrame(() => {
            settleFrame.current = null;
            if (version !== requestVersion.current) return;
            const startedAtMs = Date.now();
            const drawMorphFrame = () => {
              const elapsed = Date.now() - startedAtMs;
              const progress = smoothstep(elapsed / morphDurationMs);
              displayData.set(
                interpolatePhantomTimeframeMorph(
                  aligned.from,
                  aligned.to,
                  progress,
                ),
              );
              if (elapsed >= morphDurationMs) {
                displayData.set(replacement);
                morphFrame.current = null;
                return;
              }
              morphFrame.current = requestAnimationFrame(drawMorphFrame);
            };
            drawMorphFrame();
            seriesOpacity.set(
              fadeInDurationMs === 0
                ? 1
                : withTiming(1, { duration: fadeInDurationMs }),
            );
          });
        });
      }, loadingDelayMs);
    },
    [
      displayData,
      fadeInDurationMs,
      loadingDelayMs,
      morphDurationMs,
      seriesOpacity,
      value,
    ],
  );

  useEffect(() => {
    let tick = 0;
    const timer = setInterval(() => {
      const nowSeconds = nowRef.current() / 1000;
      const nextValue = phantomPriceAt(nowSeconds);
      value.set(nextValue);
      tick += 1;

      if (
        committedRef.current !== "live" ||
        morphFrame.current !== null ||
        tick % LIVE_POINT_EVERY_TICKS !== 0
      ) {
        return;
      }

      const point: LiveChartPoint = { time: nowSeconds, value: nextValue };
      const cutoff = nowSeconds - LIVE_BUFFER_SECONDS;
      displayData.modify((points) => {
        "worklet";
        // Keep the short buffer immutable while the transition driver may retain
        // an earlier array as its normalized source shape.
        const nextPoints = points.slice();
        nextPoints.push(point);
        while (nextPoints.length > 2 && nextPoints[1].time < cutoff) {
          nextPoints.shift();
        }
        return nextPoints;
      });
    }, liveValueIntervalMs);

    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state !== "active") return;
        const nowSeconds = nowRef.current() / 1000;
        if (morphFrame.current !== null) {
          cancelAnimationFrame(morphFrame.current);
          morphFrame.current = null;
        }
        value.set(phantomPriceAt(nowSeconds));
        if (committedRef.current === "live") {
          const resumedData = buildPhantomTimeframeData("live", nowSeconds);
          finalDataRef.current = resumedData;
          displayData.set(resumedData);
        } else {
          displayData.set(finalDataRef.current);
        }
      },
    );

    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [displayData, liveValueIntervalMs, value]);

  useEffect(() => {
    return () => {
      requestVersion.current += 1;
      if (loadingTimer.current !== null) clearTimeout(loadingTimer.current);
      if (settleFrame.current !== null)
        cancelAnimationFrame(settleFrame.current);
      if (morphFrame.current !== null) cancelAnimationFrame(morphFrame.current);
    };
  }, []);

  return {
    displayData,
    value,
    seriesOpacity,
    selectedTimeframe,
    committedTimeframe,
    dataSnapVersion,
    isLoadingTimeframe: selectedTimeframe !== committedTimeframe,
    selectTimeframe,
  };
}
