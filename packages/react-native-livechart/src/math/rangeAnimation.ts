import type { RangeAnimationConfig } from "../types";

// Worklet closures capture local functions when the caller is initialized.
function resolveSpeed(smoothing: number, speed: number | undefined): number {
  "worklet";
  return speed === undefined || !Number.isFinite(speed)
    ? smoothing
    : Math.max(0, Math.min(1, speed));
}

/** Select per-bound easing while preserving immediate expansion and reduced motion. */
export function rangeAnimationSpeed(
  smoothing: number,
  config: RangeAnimationConfig | undefined,
  expanding: boolean,
  disjoint = false,
): number {
  "worklet";
  if (smoothing >= 1 || (expanding && !config?.animateExpansion)) return 1;
  const speed = resolveSpeed(
    smoothing,
    expanding ? config?.expansionSmoothing : config?.contractionSmoothing,
  );
  // Until the ranges overlap, contraction must not outrun the expanding bound.
  return !expanding && disjoint && config?.animateExpansion
    ? Math.min(speed, resolveSpeed(smoothing, config.expansionSmoothing))
    : speed;
}
