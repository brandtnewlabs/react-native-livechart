import type { CandleGap, CandleGapKind, LiveChartPoint } from "../types";
import type { ChartPadding } from "./line";

export interface LineGapBridge {
  x1: number;
  x2: number;
  y: number;
  kind: CandleGapKind;
}

export interface LineGapGeometry {
  bridges: LineGapBridge[];
}

/** Whether an explicit gap conflicts with at least one real line sample. */
export function lineGapContainsData(
  data: LiveChartPoint[],
  gap: CandleGap,
): boolean {
  "worklet";
  let lo = 0;
  let hi = data.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].time < gap.from) lo = mid + 1;
    else hi = mid;
  }
  return lo < data.length && data[lo].time < gap.to;
}

/** Latest observed line value strictly before `time`. */
export function previousLineValueAtTime(
  data: LiveChartPoint[],
  time: number,
): number | null {
  "worklet";
  let lo = 0;
  let hi = data.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? data[lo - 1].value : null;
}

/**
 * Contiguous point ranges that may be drawn without interpolating across an
 * explicit empty interval. Each pair is `[startPoint, endPointExclusive]`.
 * Real samples inside a declared gap make that gap inert, matching the candle
 * contract that observed market data always wins over presentation metadata.
 */
export function buildLineGapSegmentRanges(
  points: number[],
  data: LiveChartPoint[],
  gaps: CandleGap[],
  winStart: number,
  windowSecs: number,
  plotLeft: number,
  plotWidth: number,
  out?: number[],
  gapXsOut?: number[],
): number[] {
  "worklet";
  const ranges = out ?? [];
  if (out) out.length = 0;
  const count = points.length >> 1;
  if (count < 2 || windowSecs <= 0 || plotWidth <= 0) return ranges;
  if (gaps.length === 0) {
    ranges.push(0, count);
    return ranges;
  }

  const winEnd = winStart + windowSecs;
  const xScale = plotWidth / windowSecs;
  const gapXs = gapXsOut ?? [];
  if (gapXsOut) gapXsOut.length = 0;
  for (let gi = 0; gi < gaps.length; gi++) {
    const gap = gaps[gi];
    if (
      gap.from >= gap.to ||
      gap.from >= winEnd ||
      gap.to <= winStart ||
      lineGapContainsData(data, gap)
    ) {
      continue;
    }
    gapXs.push(
      plotLeft + (gap.from - winStart) * xScale,
      plotLeft + (gap.to - winStart) * xScale,
    );
  }
  if (gapXs.length === 0) {
    ranges.push(0, count);
    return ranges;
  }

  let segmentStart = 0;

  for (let i = 1; i < count; i++) {
    const previousX = points[(i - 1) * 2];
    const currentX = points[i * 2];
    let breaksHere = false;
    for (let gi = 0; gi < gapXs.length; gi += 2) {
      const gapStartX = gapXs[gi];
      const gapEndX = gapXs[gi + 1];
      if (previousX <= gapStartX && currentX >= gapEndX) {
        breaksHere = true;
        break;
      }
    }
    if (!breaksHere) continue;
    if (i - segmentStart >= 2) ranges.push(segmentStart, i);
    segmentStart = i;
  }

  if (count - segmentStart >= 2) ranges.push(segmentStart, count);
  return ranges;
}

/** Pure worklet geometry for flat previous-value bridges in line gaps. */
export function buildLineGapGeometry(
  data: LiveChartPoint[],
  gaps: CandleGap[],
  padding: ChartPadding,
  canvasW: number,
  canvasH: number,
  winStart: number,
  windowSecs: number,
  displayMin: number,
  displayMax: number,
  bridgeNoTrades: boolean,
  bridgeUnavailable: boolean,
  bridgeUnknown: boolean,
): LineGapGeometry {
  "worklet";
  const plotWidth = canvasW - padding.left - padding.right;
  const plotHeight = canvasH - padding.top - padding.bottom;
  const valueRange = displayMax - displayMin;
  if (plotWidth <= 0 || plotHeight <= 0 || valueRange <= 0 || windowSecs <= 0) {
    return { bridges: [] };
  }

  const winEnd = winStart + windowSecs;
  const plotRight = canvasW - padding.right;
  const bridges: LineGapBridge[] = [];
  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    const bridge =
      gap.kind === "no-trades"
        ? bridgeNoTrades
        : gap.kind === "unavailable"
          ? bridgeUnavailable
          : bridgeUnknown;
    if (
      !bridge ||
      gap.from >= gap.to ||
      gap.from >= winEnd ||
      gap.to <= winStart ||
      lineGapContainsData(data, gap)
    ) {
      continue;
    }
    const previousValue = previousLineValueAtTime(data, gap.from);
    if (previousValue === null) continue;

    const from = Math.max(gap.from, winStart);
    const to = Math.min(gap.to, winEnd);
    const x1 = padding.left + ((from - winStart) / windowSecs) * plotWidth;
    const x2 = padding.left + ((to - winStart) / windowSecs) * plotWidth;
    if (x2 <= padding.left || x1 >= plotRight || x2 <= x1) continue;
    bridges.push({
      x1: Math.max(padding.left, x1),
      x2: Math.min(plotRight, x2),
      y: padding.top + ((displayMax - previousValue) / valueRange) * plotHeight,
      kind: gap.kind,
    });
  }
  return { bridges };
}
