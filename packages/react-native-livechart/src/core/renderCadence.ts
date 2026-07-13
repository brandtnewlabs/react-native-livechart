import { MS_PER_FRAME_60FPS } from "../constants";

export type RenderCadenceMode = "display" | "fixed30" | "adaptive";

export const FIXED_30FPS_INTERVAL_MS = 1000 / 30;
export const ADAPTIVE_PIXEL_STEP = 0.5;

/** Bundle-time profiling mode. Unknown/absent values preserve display cadence. */
export function resolveRenderCadenceMode(
  value: string | undefined,
): RenderCadenceMode {
  return value === "fixed30" || value === "adaptive" ? value : "display";
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
