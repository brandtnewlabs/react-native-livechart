import type { RangeAnimationConfig } from "../types";

/** Select per-bound easing while preserving immediate expansion and reduced motion. */
export function rangeAnimationSpeed(
  smoothing: number,
  config: RangeAnimationConfig | undefined,
  expanding: boolean,
): number {
  "worklet";
  if (smoothing >= 1 || (expanding && !config?.animateExpansion)) return 1;
  const speed = expanding ? config?.expansionSmoothing : config?.contractionSmoothing;
  return speed === undefined || !Number.isFinite(speed)
    ? smoothing
    : Math.max(0, Math.min(1, speed));
}
