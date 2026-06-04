import { type SkFont } from "@shopify/react-native-skia";
import { type ChartPadding } from "../draw/line";
import { interpolateAtTime } from "../math/interpolate";
import type { ScrubSeriesValue, SeriesConfig } from "../types";
import {
  computeTooltipLayoutMulti,
  HIDDEN_TOOLTIP,
  type TooltipLayout,
} from "./crosshairShared";

export function interpolateSeriesAtTime(
  series: SeriesConfig[],
  time: number,
): { primary: number | null; seriesValues: ScrubSeriesValue[] } {
  "worklet";
  const seriesValues: ScrubSeriesValue[] = [];
  let primary: number | null = null;
  for (let i = 0; i < series.length; i++) {
    if (series[i].visible === false) continue;
    const v = interpolateAtTime(series[i].data, time);
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

/** Series-chart stacked tooltip at scrub time — extracted for tests. */
export function computeSeriesScrubTooltipLayout(
  scrubActive: boolean,
  scrubX: number,
  scrubTime: number,
  series: SeriesConfig[],
  padding: ChartPadding,
  canvasWidth: number,
  formatValue: (v: number) => string,
  formatTime: (t: number) => string,
  font: SkFont,
): TooltipLayout {
  "worklet";
  if (!scrubActive || scrubTime < 0) return HIDDEN_TOOLTIP;
  const r = interpolateSeriesAtTime(series, scrubTime);
  if (r.primary === null) return HIDDEN_TOOLTIP;
  const lineObjs: { text: string; dim: boolean }[] = [
    { text: formatTime(scrubTime), dim: true },
  ];
  for (let k = 0; k < r.seriesValues.length; k++) {
    const sv = r.seriesValues[k];
    const label = sv.label ?? sv.id;
    lineObjs.push({
      text: `${label}: ${formatValue(sv.value)}`,
      dim: false,
    });
  }
  return computeTooltipLayoutMulti(
    scrubActive,
    scrubX,
    lineObjs,
    padding,
    canvasWidth,
    font,
  );
}
