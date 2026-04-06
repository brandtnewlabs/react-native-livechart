import type { LivelinePoint } from "../types";

/**
 * Compute visible Y range from data points + current value.
 * Returns { min, max } with margin applied.
 */
export function computeRange(
  visible: LivelinePoint[],
  currentValue: number,
  referenceValue?: number,
  exaggerate?: boolean,
): { min: number; max: number } {
  "worklet";
  let targetMin = Infinity;
  let targetMax = -Infinity;

  for (let i = 0; i < visible.length; i++) {
    const v = visible[i].value;
    if (v < targetMin) targetMin = v;
    if (v > targetMax) targetMax = v;
  }

  if (currentValue < targetMin) targetMin = currentValue;
  if (currentValue > targetMax) targetMax = currentValue;

  if (referenceValue !== undefined) {
    if (referenceValue < targetMin) targetMin = referenceValue;
    if (referenceValue > targetMax) targetMax = referenceValue;
  }

  const rawRange = targetMax - targetMin;
  const marginFactor = exaggerate ? 0.01 : 0.12;
  const minRange =
    rawRange * (exaggerate ? 0.02 : 0.1) || (exaggerate ? 0.04 : 0.4);

  if (rawRange < minRange) {
    const mid = (targetMin + targetMax) / 2;
    targetMin = mid - minRange / 2;
    targetMax = mid + minRange / 2;
  } else {
    const margin = rawRange * marginFactor;
    targetMin -= margin;
    targetMax += margin;
  }

  return { min: targetMin, max: targetMax };
}
