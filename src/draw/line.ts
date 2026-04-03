import type { LivelinePoint } from "../types";

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_PADDING: ChartPadding = {
  top: 12,
  right: 12,
  bottom: 28,
  left: 12,
};

/**
 * Build screen-space points as a flat number array [x0, y0, x1, y1, ...].
 * Includes one point before the window for smooth left-edge entry,
 * and appends a live tip at (now, displayValue).
 *
 * Flat layout avoids ~150 tuple object allocations per frame.
 */
export function buildLinePoints(
  data: LivelinePoint[],
  displayValue: number,
  now: number,
  windowSecs: number,
  displayMin: number,
  displayMax: number,
  canvasWidth: number,
  canvasHeight: number,
  padding: ChartPadding,
): number[] {
  "worklet";
  const chartW = canvasWidth - padding.left - padding.right;
  const chartH = canvasHeight - padding.top - padding.bottom;
  const valRange = displayMax - displayMin;

  if (valRange === 0 || chartW <= 0 || chartH <= 0 || data.length === 0)
    return [];

  const winStart = now - windowSecs;

  // Binary search for first point >= winStart
  let lo = 0;
  let hi = data.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].time < winStart) lo = mid + 1;
    else hi = mid;
  }
  const startIdx = Math.max(0, lo - 1);

  const pts: number[] = [];
  for (let i = startIdx; i < data.length; i++) {
    if (data[i].time > now) break;
    pts.push(
      padding.left + ((data[i].time - winStart) / windowSecs) * chartW,
      padding.top + ((displayMax - data[i].value) / valRange) * chartH,
    );
  }

  // Live tip at current time with smoothed value
  pts.push(
    padding.left + chartW,
    padding.top + ((displayMax - displayValue) / valRange) * chartH,
  );

  return pts;
}
