import { type SkFont } from "@shopify/react-native-skia";
import type { ResolvedPerSeriesTooltipConfig } from "../core/resolveConfig";
import { type ChartPadding } from "../draw/line";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import { interpolateAtTime } from "../math/interpolate";
import type { ScrubSeriesValue, SeriesConfig } from "../types";
import {
  HIDDEN_TOOLTIP,
  type TooltipLayout,
} from "./crosshairShared";

const TOOLTIP_EDGE_GAP = 4;
const TOOLTIP_SIDE_GAP = 8;
const TOOLTIP_STACK_GAP = 4;
const TOOLTIP_TOP_GAP = 4;

function valueAtTime(series: SeriesConfig, time: number): number | null {
  "worklet";
  return interpolateAtTime(series.data, time);
}

export function interpolateSeriesAtTime(
  series: SeriesConfig[],
  time: number,
): { primary: number | null; seriesValues: ScrubSeriesValue[] } {
  "worklet";
  const seriesValues: ScrubSeriesValue[] = [];
  let primary: number | null = null;
  for (let i = 0; i < series.length; i++) {
    if (series[i].visible === false) continue;
    const v = valueAtTime(series[i], time);
    if (v === null) continue;
    seriesValues.push({
      id: series[i].id,
      label: series[i].label,
      value: v,
    });
    if (primary === null) primary = v;
  }
  return { primary, seriesValues };
}

/** Infer a bucket width from the latest positive interval in a visible series. */
export function estimateSeriesBucketSeconds(series: SeriesConfig[]): number {
  "worklet";
  for (let i = 0; i < series.length; i++) {
    if (series[i].visible === false) continue;
    const points = series[i].data;
    for (let j = points.length - 1; j > 0; j--) {
      const delta = points[j].time - points[j - 1].time;
      if (delta > 0) return delta;
    }
  }
  return 0;
}

/** Truncate a series label with the same ellipsis treatment as Morfi web. */
export function truncateSeriesTooltipLabel(
  label: string,
  maxChars: number,
): string {
  "worklet";
  if (label.length <= maxChars) return label;
  return `${label.slice(0, Math.max(1, maxChars - 1))}…`;
}

function clamp(value: number, min: number, max: number): number {
  "worklet";
  if (max < min) return min;
  return value < min ? min : value > max ? max : value;
}

/**
 * Morfi-style per-series scrub tooltip geometry. Pure/worklet-safe so the
 * entire readout can be recomputed on the UI thread without React renders.
 */
export function computePerSeriesTooltipLayout(
  scrubActive: boolean,
  scrubX: number,
  scrubTime: number,
  series: SeriesConfig[],
  displaySeriesValues: number[],
  colors: string[],
  displayMin: number,
  displayMax: number,
  padding: ChartPadding,
  canvasWidth: number,
  canvasHeight: number,
  maxTime: number,
  formatValue: (value: number) => string,
  formatTime: (time: number) => string,
  font: SkFont,
  config: ResolvedPerSeriesTooltipConfig,
): TooltipLayout {
  "worklet";
  const pinned = !scrubActive && config.alwaysShow;
  if ((!scrubActive && !pinned) || canvasWidth <= 0 || canvasHeight <= 0) {
    return HIDDEN_TOOLTIP;
  }

  const plotLeft = padding.left;
  const plotRight = canvasWidth - padding.right;
  const plotTop = padding.top;
  const plotBottom = canvasHeight - padding.bottom;
  if (plotRight <= plotLeft || plotBottom <= plotTop) return HIDDEN_TOOLTIP;

  const anchorX = pinned
    ? plotRight
    : clamp(scrubX, plotLeft, plotRight);
  const activeTime = Math.min(scrubTime, maxTime);
  if (!pinned && activeTime < 0) return HIDDEN_TOOLTIP;

  const fm = font.getMetrics();
  const lineH = Math.max(1, -fm.ascent + fm.descent);
  const seriesPillH = lineH + config.seriesPillPaddingY * 2;
  const maxPillW = Math.max(1, plotRight - plotLeft - TOOLTIP_EDGE_GAP * 2);
  const valueFormatter = config.formatSeriesValue;

  const pills: NonNullable<
    NonNullable<TooltipLayout["perSeries"]>["pills"]
  > = [];
  const preferredY: number[] = [];
  for (let i = 0; i < series.length; i++) {
    const item = series[i];
    if (item.visible === false || item.data.length === 0) continue;
    const value = pinned
      ? (displaySeriesValues[i] ?? item.value)
      : valueAtTime(item, activeTime);
    if (value === null || !Number.isFinite(value)) continue;

    const label = truncateSeriesTooltipLabel(
      item.label ?? item.id,
      config.maxLabelChars,
    );
    const valueText = valueFormatter
      ? valueFormatter(value, item.id)
      : formatValue(value);
    const labelW = measureFontTextWidth(font, label);
    const valueW = measureFontTextWidth(font, valueText);
    const labelGap = label.length > 0 ? config.seriesPillLabelValueGap : 0;
    const rawPillW =
      config.seriesPillPaddingX * 2 +
      config.seriesPillDotSize +
      config.seriesPillDotGap +
      labelW +
      labelGap +
      valueW;
    const pillW = Math.min(rawPillW, maxPillW);
    let pillX = anchorX + TOOLTIP_SIDE_GAP;
    if (pillX + pillW > plotRight - TOOLTIP_EDGE_GAP) {
      pillX = anchorX - pillW - TOOLTIP_SIDE_GAP;
    }
    pillX = clamp(
      pillX,
      plotLeft + TOOLTIP_EDGE_GAP,
      plotRight - TOOLTIP_EDGE_GAP - pillW,
    );

    const chartH = plotBottom - plotTop;
    const valRange = displayMax - displayMin;
    const anchorY =
      valRange === 0
        ? plotTop + chartH / 2
        : clamp(
            plotTop + ((displayMax - value) / valRange) * chartH,
            plotTop,
            plotBottom,
          );
    const dotX =
      pillX + config.seriesPillPaddingX + config.seriesPillDotSize / 2;
    const dotY = anchorY;
    const labelX =
      dotX + config.seriesPillDotSize / 2 + config.seriesPillDotGap;
    const valueX = labelX + labelW + labelGap;
    pills.push({
      id: item.id,
      color: colors[i] ?? item.color ?? "#ffffff",
      anchorX,
      anchorY,
      x: pillX,
      y: anchorY - seriesPillH / 2,
      w: pillW,
      h: seriesPillH,
      dotX,
      dotY,
      label,
      labelX,
      value: valueText,
      valueX,
      baselineY: 0,
    });
    preferredY.push(anchorY - seriesPillH / 2);
  }
  if (pills.length === 0) return HIDDEN_TOOLTIP;

  let timePill: NonNullable<
    NonNullable<TooltipLayout["perSeries"]>["timePill"]
  > | undefined;
  if (!pinned) {
    const bucketSeconds =
      config.bucketSeconds ?? estimateSeriesBucketSeconds(series);
    const from = activeTime;
    const to = Math.max(from, Math.min(from + bucketSeconds, maxTime));
    const timeText = config.formatTimeRange
      ? config.formatTimeRange(from, to)
      : bucketSeconds > 0
        ? `${formatTime(from)} – ${formatTime(to)}`
        : formatTime(from);
    const timeW = Math.min(
      measureFontTextWidth(font, timeText) + config.timePillPaddingX * 2,
      maxPillW,
    );
    const timeH = lineH + config.timePillPaddingY * 2;
    const timeX = clamp(
      anchorX - timeW / 2,
      plotLeft + TOOLTIP_EDGE_GAP,
      plotRight - TOOLTIP_EDGE_GAP - timeW,
    );
    const timeY = plotTop + TOOLTIP_TOP_GAP;
    timePill = {
      x: timeX,
      y: timeY,
      w: timeW,
      h: timeH,
      text: timeText,
      textX: timeX + config.timePillPaddingX,
      baselineY: timeY + config.timePillPaddingY - fm.ascent,
    };
  }

  // Collision avoidance: sort by preferred position, push down, then pull the
  // stack back up from the bottom. If the plot is extremely short, compress the
  // inter-pill gap to zero before accepting overlap as the unavoidable fallback.
  const topBound = Math.min(
    plotBottom - seriesPillH,
    timePill
      ? Math.max(plotTop, timePill.y + timePill.h + TOOLTIP_STACK_GAP)
      : plotTop,
  );
  const bottomBound = plotBottom;
  const order = pills.map((_, index) => index);
  order.sort((a, b) => preferredY[a] - preferredY[b]);

  let stackGap = TOOLTIP_STACK_GAP;
  const availableH = Math.max(0, bottomBound - topBound);
  const requiredWithoutGaps = pills.length * seriesPillH;
  if (pills.length > 1 && requiredWithoutGaps + stackGap * (pills.length - 1) > availableH) {
    stackGap = Math.max(
      0,
      (availableH - requiredWithoutGaps) / (pills.length - 1),
    );
  }

  let cursor = topBound;
  for (let i = 0; i < order.length; i++) {
    const index = order[i];
    const y = clamp(
      Math.max(preferredY[index], cursor),
      topBound,
      Math.max(topBound, bottomBound - seriesPillH),
    );
    pills[index].y = y;
    cursor = y + seriesPillH + stackGap;
  }
  for (let i = order.length - 2; i >= 0; i--) {
    const index = order[i];
    const next = pills[order[i + 1]];
    pills[index].y = Math.max(
      topBound,
      Math.min(pills[index].y, next.y - seriesPillH - stackGap),
    );
  }
  for (let i = 0; i < pills.length; i++) {
    pills[i].dotY = pills[i].y + pills[i].h / 2;
    pills[i].baselineY =
      pills[i].y + config.seriesPillPaddingY - fm.ascent;
  }

  const firstRect = timePill ?? pills[0];
  return {
    x: firstRect.x,
    y: firstRect.y,
    w: firstRect.w,
    h: firstRect.h,
    valueStr: "",
    timeStr: "",
    valueTextX: -400,
    timeTextX: -400,
    line1Y: 0,
    line2Y: 0,
    stackedLines: undefined,
    perSeries: { pinned, timePill, pills },
  };
}

/** Series-chart scrub primary value at window time — extracted for tests. */
export function deriveScrubValueSeries(
  scrubActive: boolean,
  scrubTime: number,
  series: SeriesConfig[],
): number | null {
  "worklet";
  if (!scrubActive || scrubTime < 0) return null;
  return interpolateSeriesAtTime(series, scrubTime).primary;
}
