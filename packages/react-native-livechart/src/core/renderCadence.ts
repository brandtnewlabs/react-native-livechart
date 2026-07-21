import { MS_PER_FRAME_60FPS } from "../constants";
import type { SharedValue } from "react-native-reanimated";

export type RenderCadenceMode = "display" | "fixed30" | "adaptive";

type RenderCadenceProfileGlobal = typeof globalThis & {
  __reactNativeLiveChartProfileCadence?: string;
  __reactNativeLiveChartProfilePublicationCount?: SharedValue<number>;
};

export interface RenderCadenceSchedulerState {
  /** Wall-clock time that the next engine publication must consume. */
  elapsedSincePublicationMs: number;
  /** Cadence phase, retained across publications to avoid display-rate quantization. */
  cadenceElapsedMs: number;
  /** Number of engine publications selected by this scheduler. */
  publicationCount: number;
}

export const FIXED_30FPS_INTERVAL_MS = 1000 / 30;
export const ADAPTIVE_PIXEL_STEP = 0.5;
const CADENCE_TOLERANCE_MS = 0.01;

export function makeRenderCadenceSchedulerState(): RenderCadenceSchedulerState {
  return {
    elapsedSincePublicationMs: 0,
    cadenceElapsedMs: 0,
    publicationCount: 0,
  };
}

/** Bundle-time profiling mode. Unknown/absent values preserve display cadence. */
export function resolveRenderCadenceMode(
  value: string | undefined,
  fallback: RenderCadenceMode = "display",
): RenderCadenceMode {
  return value === "display" || value === "fixed30" || value === "adaptive"
    ? value
    : fallback;
}

/** Read the example app's bundle-time profiling override without Node globals. */
export function resolveRenderCadenceProfileOverride(
  fallback: RenderCadenceMode = "display",
): RenderCadenceMode {
  const value = (globalThis as RenderCadenceProfileGlobal)
    .__reactNativeLiveChartProfileCadence;
  return resolveRenderCadenceMode(value, fallback);
}

/** Read the profiling screen's counter without exposing a production prop. */
export function resolveRenderCadencePublicationCounter():
  | SharedValue<number>
  | undefined {
  return (globalThis as RenderCadenceProfileGlobal)
    .__reactNativeLiveChartProfilePublicationCount;
}

/**
 * Minimum time between expensive chart-state publications for a profiling mode.
 *
 * Adaptive cadence waits until steady horizontal scrolling would move by half a
 * pixel, clamped to 30–60 fps. Short windows therefore retain display cadence;
 * longer, slower windows coalesce adjacent display frames.
 */
export function renderCadenceIntervalMs(
  mode: RenderCadenceMode,
  canvasWidth: number,
  displayWindowSeconds: number,
): number {
  "worklet";
  if (mode === "display" || canvasWidth <= 0 || displayWindowSeconds <= 0) {
    return 0;
  }
  if (mode === "fixed30") return FIXED_30FPS_INTERVAL_MS;

  const pixelsPerSecond = canvasWidth / displayWindowSeconds;
  const halfPixelInterval = (ADAPTIVE_PIXEL_STEP / pixelsPerSecond) * 1000;
  return Math.max(
    MS_PER_FRAME_60FPS,
    Math.min(FIXED_30FPS_INTERVAL_MS, halfPixelInterval),
  );
}

/**
 * Accumulate display callbacks and return the elapsed time for the next engine
 * publication, or `null` when this frame should be coalesced.
 *
 * Cadence phase is separate from elapsed engine time. Retaining phase remainder
 * lets a 25 ms target alternate across 60 Hz frames and average 40 publications
 * per second, while the returned elapsed time still covers every display delta.
 */
export function scheduleRenderCadenceFrame(
  state: RenderCadenceSchedulerState,
  mode: RenderCadenceMode,
  frameMs: number,
  canvasWidth: number,
  displayWindowSeconds: number,
): number | null {
  "worklet";
  const intervalMs = renderCadenceIntervalMs(
    mode,
    canvasWidth,
    displayWindowSeconds,
  );
  if (intervalMs === 0) {
    state.elapsedSincePublicationMs = 0;
    state.cadenceElapsedMs = 0;
    state.publicationCount += 1;
    return frameMs;
  }

  const elapsedMs = state.elapsedSincePublicationMs + frameMs;
  const cadenceElapsedMs = state.cadenceElapsedMs + frameMs;
  state.elapsedSincePublicationMs = elapsedMs;
  state.cadenceElapsedMs = cadenceElapsedMs;
  if (cadenceElapsedMs + CADENCE_TOLERANCE_MS < intervalMs) return null;

  const elapsedIntervals = Math.max(
    1,
    Math.floor((cadenceElapsedMs + CADENCE_TOLERANCE_MS) / intervalMs),
  );
  state.cadenceElapsedMs = Math.max(
    0,
    cadenceElapsedMs - elapsedIntervals * intervalMs,
  );
  state.elapsedSincePublicationMs = 0;
  state.publicationCount += 1;
  return elapsedMs;
}
