import type { ChartScale } from "../types";

/**
 * Pure worklet projections for the `renderOverlay` bridge ({@link ChartOverlayContext}).
 *
 * Each takes a {@link ChartScale} **snapshot** rather than reading any SharedValue
 * itself — so the consumer's `useAnimatedStyle` / `useDerivedValue` becomes
 * reactive simply by reading `scale.get()` (which subscribes it to the per-frame
 * scale), and these stay trivially unit-testable as plain functions of data.
 */

/** Maps a price (Y-axis value) to its canvas Y pixel. -1 when not laid out. */
export function priceToY(price: number, scale: ChartScale): number {
  "worklet";
  const { top, bottom } = scale.plot;
  const chartH = bottom - top;
  if (chartH <= 0) return -1;
  const range = scale.max - scale.min;
  if (range === 0) return top + chartH / 2;
  return top + ((scale.max - price) / range) * chartH;
}

/**
 * Inverse of {@link priceToY}: maps a canvas Y pixel back to a price. Clamps to
 * the visible range (a level can't sit beyond the axis bounds); null when not
 * laid out.
 */
export function yToPrice(y: number, scale: ChartScale): number | null {
  "worklet";
  const { top, bottom } = scale.plot;
  const chartH = bottom - top;
  if (chartH <= 0) return null;
  const range = scale.max - scale.min;
  if (range === 0) return scale.min;
  const clampedY = Math.min(bottom, Math.max(top, y));
  const frac = (clampedY - top) / chartH; // 0 at top, 1 at bottom
  return scale.max - frac * range;
}

/** Maps a unix-seconds timestamp to its canvas X pixel. -1 when not laid out. */
export function timeToX(time: number, scale: ChartScale): number {
  "worklet";
  const { left, right } = scale.plot;
  const chartW = right - left;
  if (chartW <= 0) return -1;
  if (scale.window <= 0) return left;
  const winStart = scale.now - scale.window;
  return left + ((time - winStart) / scale.window) * chartW;
}

/** Inverse of {@link timeToX}: maps a canvas X pixel back to a unix-seconds timestamp. */
export function xToTime(x: number, scale: ChartScale): number {
  "worklet";
  const { left, right } = scale.plot;
  const chartW = right - left;
  if (chartW <= 0) return -1;
  const winStart = scale.now - scale.window;
  return winStart + ((x - left) / chartW) * scale.window;
}
