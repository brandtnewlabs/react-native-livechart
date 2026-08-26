import type { ChartPadding } from "../draw/line";
import type { LiveChartPoint } from "../types";
import { interpolateAtTime } from "./interpolate";
import { thresholdLineY } from "./threshold";

/**
 * Project a historical reference-line series into screen-space `[x, y, …]`
 * points for the visible time window. Window-edge values are interpolated so
 * the path enters and leaves the plot cleanly. The series clamps to its first
 * value on the left and, by default, to its last value at the live edge.
 *
 * Worklet-safe. When `out` is supplied it is cleared and reused.
 */
export function buildReferenceLineSeriesPoints(
  points: LiveChartPoint[],
  now: number,
  windowSecs: number,
  displayMin: number,
  displayMax: number,
  canvasWidth: number,
  canvasHeight: number,
  padding: ChartPadding,
  extendToNow: boolean,
  out?: number[],
): number[] {
  "worklet";
  const result = out ?? [];
  result.length = 0;

  const plotLeft = padding.left;
  const plotRight = canvasWidth - padding.right;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = canvasHeight - padding.top - padding.bottom;
  const valueRange = displayMax - displayMin;
  if (
    points.length === 0 ||
    !(windowSecs > 0) ||
    plotWidth <= 0 ||
    plotHeight <= 0 ||
    !(valueRange > 0)
  ) {
    return result;
  }

  const windowStart = now - windowSecs;
  const lastTime = points[points.length - 1].time;
  const endTime = extendToNow ? now : Math.min(now, lastTime);
  if (endTime < windowStart) return result;

  const startValue = interpolateAtTime(points, windowStart);
  const endValue = interpolateAtTime(points, endTime);
  if (
    startValue === null ||
    endValue === null ||
    !Number.isFinite(startValue) ||
    !Number.isFinite(endValue)
  ) {
    return result;
  }

  const toX = (time: number) =>
    plotLeft + ((time - windowStart) / windowSecs) * plotWidth;
  const toY = (value: number) =>
    thresholdLineY(
      value,
      displayMin,
      displayMax,
      canvasHeight,
      padding.top,
      padding.bottom,
    );

  result.push(plotLeft, toY(startValue));
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (point.time <= windowStart) continue;
    if (point.time >= endTime) break;
    if (!Number.isFinite(point.time) || !Number.isFinite(point.value)) continue;
    result.push(toX(point.time), toY(point.value));
  }
  result.push(toX(endTime), toY(endValue));
  return result;
}
