import type { CandlePoint, LiveChartPoint, SeriesConfig } from "../types";

/** A single historical line sample is enough to anchor the live tip. */
export function hasLineChartData(points: LiveChartPoint[]): boolean {
  "worklet";
  return points.length > 0;
}

/** A single committed OHLC bucket is drawable as a candle. */
export function hasCandleChartData(
  candles: CandlePoint[] | undefined,
): boolean {
  "worklet";
  return (candles?.length ?? 0) > 0;
}

/** Multi-series charts are non-empty when any series has one sample. */
export function hasMultiSeriesChartData(series: SeriesConfig[]): boolean {
  "worklet";
  for (let i = 0; i < series.length; i++) {
    if (series[i].data.length > 0) return true;
  }
  return false;
}
