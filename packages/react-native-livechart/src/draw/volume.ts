import { CANDLE_METRICS_DEFAULTS } from "../constants";
import type { CandleMetrics, CandlePoint } from "../types";
import type { ChartPadding } from "./line";

export interface VolumeBar {
  x: number;
  y: number;
  w: number;
  h: number;
  up: boolean;
}

export interface VolumeGeometry {
  bars: VolumeBar[];
}

function volumeTimeToX(
  t: number,
  padLeft: number,
  winStart: number,
  windowSecs: number,
  chartW: number,
): number {
  "worklet";
  return padLeft + ((t - winStart) / windowSecs) * chartW;
}

/** Whether a candle's bucket overlaps the visible window. Only the live candle
 *  needs this — committed candles are pre-filtered by the binary search + break. */
function candleVisible(
  c: CandlePoint,
  winStart: number,
  winEnd: number,
  candleWidthSecs: number,
): boolean {
  "worklet";
  return c.time + candleWidthSecs >= winStart && c.time <= winEnd;
}

/** One candle → a volume bar appended to `bars` (skips zero/empty volume). */
function appendVolumeBar(
  c: CandlePoint,
  winStart: number,
  windowSecs: number,
  chartW: number,
  chartLeft: number,
  chartRight: number,
  padLeft: number,
  candleWidthSecs: number,
  bodyW: number,
  maxVol: number,
  baseline: number,
  bandHeight: number,
  bars: VolumeBar[],
): void {
  "worklet";
  const vol = c.volume ?? 0;
  if (vol <= 0) return;

  const xCenter = volumeTimeToX(
    c.time + candleWidthSecs / 2,
    padLeft,
    winStart,
    windowSecs,
    chartW,
  );
  if (xCenter < chartLeft - bodyW / 2 || xCenter > chartRight + bodyW / 2)
    return;

  let bx = xCenter - bodyW / 2;
  let bw = bodyW;
  if (bx < chartLeft) {
    bw -= chartLeft - bx;
    bx = chartLeft;
  }
  if (bx + bw > chartRight) {
    bw = chartRight - bx;
  }
  /* istanbul ignore next -- clipped to zero width */
  if (bw <= 0) return;

  const h = (vol / maxVol) * bandHeight;
  bars.push({ x: bx, y: baseline - h, w: bw, h, up: c.close >= c.open });
}

/**
 * Build screen-space volume bars for the reserved band below the candles. Bars
 * align under the candle bodies (same width + center) and grow up from the band
 * baseline (the x-axis line). Heights are normalized to the largest *visible*
 * volume so the tallest bar fills `bandHeight`. Pure worklet — no Skia imports,
 * consumed by {@link useCandlePaths}.
 *
 * `padding.bottom` is the already-reserved bottom (it includes `bandHeight`), so
 * `canvasH - padding.bottom` is the candle plot's bottom = the top of the band,
 * and the baseline sits `bandHeight` below it (the x-axis line).
 */
export function buildVolumeGeometry(
  candles: CandlePoint[],
  liveCandle: CandlePoint | null,
  padding: ChartPadding,
  canvasW: number,
  canvasH: number,
  winStart: number,
  windowSecs: number,
  bandHeight: number,
  candleWidthSecs: number,
  metrics: CandleMetrics = CANDLE_METRICS_DEFAULTS,
): VolumeGeometry {
  "worklet";
  const chartW = canvasW - padding.left - padding.right;
  if (bandHeight <= 0 || chartW <= 0) return { bars: [] };

  const slotPx = (candleWidthSecs / windowSecs) * chartW;
  const bodyW = Math.max(
    1,
    Math.min(slotPx * metrics.bodyWidthRatio, slotPx - 2, metrics.maxBodyPx),
  );

  const winEnd = winStart + windowSecs;
  const chartLeft = padding.left;
  const chartRight = canvasW - padding.right;
  const padLeft = padding.left;
  const baseline = canvasH - padding.bottom + bandHeight;

  // Binary search for the first candle overlapping the window (same as candles).
  let lo = 0;
  let hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time + candleWidthSecs < winStart) lo = mid + 1;
    else hi = mid;
  }

  // Pass 1 — largest visible volume (the bar that fills the band). The live
  // candle counts too so a tall in-progress bar doesn't overflow the band.
  let maxVol = 0;
  for (let i = lo; i < candles.length; i++) {
    /* istanbul ignore next -- past visible window */
    if (candles[i].time > winEnd) break;
    const v = candles[i].volume ?? 0;
    if (v > maxVol) maxVol = v;
  }
  if (liveCandle && candleVisible(liveCandle, winStart, winEnd, candleWidthSecs)) {
    const v = liveCandle.volume ?? 0;
    if (v > maxVol) maxVol = v;
  }

  if (maxVol <= 0) return { bars: [] };

  // Pass 2 — build the bars normalized to maxVol.
  const bars: VolumeBar[] = [];
  for (let i = lo; i < candles.length; i++) {
    /* istanbul ignore next -- past visible window */
    if (candles[i].time > winEnd) break;
    appendVolumeBar(
      candles[i],
      winStart,
      windowSecs,
      chartW,
      chartLeft,
      chartRight,
      padLeft,
      candleWidthSecs,
      bodyW,
      maxVol,
      baseline,
      bandHeight,
      bars,
    );
  }
  if (liveCandle && candleVisible(liveCandle, winStart, winEnd, candleWidthSecs)) {
    appendVolumeBar(
      liveCandle,
      winStart,
      windowSecs,
      chartW,
      chartLeft,
      chartRight,
      padLeft,
      candleWidthSecs,
      bodyW,
      maxVol,
      baseline,
      bandHeight,
      bars,
    );
  }

  return { bars };
}
