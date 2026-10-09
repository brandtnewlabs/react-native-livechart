import type { LiveChartPoint } from "../types";

/**
 * Compute visible Y range from data points + current value.
 * Returns { min, max } with margin applied.
 */
export function computeRange(
  visible: LiveChartPoint[],
  currentValue: number,
  referenceValue?: number,
  exaggerate?: boolean,
  nonNegative?: boolean,
  maxValue?: number,
  floorRange?: number,
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
  // marginFactor: breathing room above/below the data (tight for exaggerate mode)
  const marginFactor = exaggerate ? 0.01 : 0.12;
  // minRange: prevents the chart from collapsing to a flat line on tiny movements
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

  // Compare the bounded fit: a clamp can shrink an otherwise wider range.
  // Slide a widened fit off either bound; both hard bounds win if the floor
  // cannot fit between them. Mirrors the fitted range used by both engines.
  if (floorRange !== undefined && floorRange > 0 && Number.isFinite(floorRange)) {
    const boundedMin = nonNegative && targetMin < 0 ? 0 : targetMin;
    const boundedMax =
      maxValue !== undefined && targetMax > maxValue ? maxValue : targetMax;
    if (floorRange > boundedMax - boundedMin) {
      // Halve before adding so large finite prices cannot overflow the midpoint.
      const mid = targetMin / 2 + targetMax / 2;
      let nextMin = mid - floorRange / 2;
      let nextMax = mid + floorRange / 2;
      if (nonNegative && nextMin < 0) {
        nextMax -= nextMin;
        nextMin = 0;
      }
      if (maxValue !== undefined && nextMax > maxValue) {
        nextMin -= nextMax - maxValue;
        nextMax = maxValue;
      }
      if (nonNegative && nextMin < 0) nextMin = 0;
      // Ignore a floor that would overflow or round the bounds onto each other.
      if (
        Number.isFinite(nextMin) &&
        Number.isFinite(nextMax) &&
        nextMin < nextMax &&
        Number.isFinite(nextMax - nextMin)
      ) {
        targetMin = nextMin;
        targetMax = nextMax;
      }
    }
  }

  if (nonNegative && targetMin < 0) targetMin = 0;
  if (maxValue !== undefined && targetMax > maxValue) targetMax = maxValue;

  return { min: targetMin, max: targetMax };
}
