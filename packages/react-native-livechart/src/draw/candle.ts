import { CANDLE_METRICS_DEFAULTS } from "../constants";
import type { CandleMetrics, CandlePoint } from "../types";
import type { ChartPadding } from "./line";

export interface CandleRect {
  x: number;
  y: number;
  w: number;
  h: number;
  up: boolean;
}

export interface CandleWick {
  x: number;
  y1: number;
  y2: number;
  up: boolean;
}

export interface CandleGeometry {
  bodies: CandleRect[];
  wicks: CandleWick[];
}

export interface CandleFocusClip {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Stable off-canvas clip used when no candle is focused. */
export const HIDDEN_CANDLE_FOCUS_CLIP: CandleFocusClip = {
  x: -1,
  y: 0,
  width: 0,
  height: 0,
};

function candleTimeToX(
  t: number,
  padLeft: number,
  winStart: number,
  windowSecs: number,
  chartW: number,
): number {
  "worklet";
  return padLeft + ((t - winStart) / windowSecs) * chartW;
}

function candleValueToY(
  v: number,
  padTop: number,
  displayMax: number,
  valRange: number,
  chartH: number,
): number {
  "worklet";
  return padTop + ((displayMax - v) / valRange) * chartH;
}

/**
 * Return the visible screen-space time slot occupied by one candle bucket.
 * The focus renderer clips the existing batched candle paths to this strip,
 * repainting only the selected body and wick without building another SkPath.
 */
export function computeCandleFocusClip(
  candle: CandlePoint | null,
  padding: ChartPadding,
  canvasW: number,
  canvasH: number,
  winStart: number,
  windowSecs: number,
  candleWidthSecs: number,
): CandleFocusClip {
  "worklet";
  if (!candle || windowSecs <= 0 || candleWidthSecs <= 0) {
    return HIDDEN_CANDLE_FOCUS_CLIP;
  }

  const chartLeft = padding.left;
  const chartRight = canvasW - padding.right;
  const chartTop = padding.top;
  const chartBottom = canvasH - padding.bottom;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;
  if (chartW <= 0 || chartH <= 0) return HIDDEN_CANDLE_FOCUS_CLIP;

  const bucketLeft = candleTimeToX(
    candle.time,
    padding.left,
    winStart,
    windowSecs,
    chartW,
  );
  const bucketRight = candleTimeToX(
    candle.time + candleWidthSecs,
    padding.left,
    winStart,
    windowSecs,
    chartW,
  );
  const x = Math.max(chartLeft, bucketLeft);
  const right = Math.min(chartRight, bucketRight);
  if (right <= x) return HIDDEN_CANDLE_FOCUS_CLIP;

  return { x, y: chartTop, width: right - x, height: chartH };
}

/** One candle → bodies/wicks; top-level worklet (no nested closures). */
function appendCandleShapes(
  c: CandlePoint,
  winStart: number,
  winEnd: number,
  windowSecs: number,
  chartW: number,
  chartH: number,
  chartLeft: number,
  chartRight: number,
  padTop: number,
  padLeft: number,
  displayMax: number,
  valRange: number,
  candleWidthSecs: number,
  bodyW: number,
  minBodyPx: number,
  bodies: CandleRect[],
  wicks: CandleWick[],
): void {
  "worklet";
  if (c.time + candleWidthSecs < winStart || c.time > winEnd) return;

  const up = c.close >= c.open;
  const xCenter = candleTimeToX(
    c.time + candleWidthSecs / 2,
    padLeft,
    winStart,
    windowSecs,
    chartW,
  );

  if (xCenter < chartLeft - bodyW / 2 || xCenter > chartRight + bodyW / 2)
    return;

  const bodyTop = candleValueToY(
    up ? c.close : c.open,
    padTop,
    displayMax,
    valRange,
    chartH,
  );
  const bodyBot = candleValueToY(
    up ? c.open : c.close,
    padTop,
    displayMax,
    valRange,
    chartH,
  );
  const bodyH = Math.max(minBodyPx, bodyBot - bodyTop);

  let bx = xCenter - bodyW / 2;
  let bw = bodyW;
  if (bx < chartLeft) {
    bw -= chartLeft - bx;
    bx = chartLeft;
  }
  /* istanbul ignore next -- right-edge clip rare in tests */
  if (bx + bw > chartRight) {
    bw = chartRight - bx;
  }
  /* istanbul ignore next -- clipped to zero width */
  if (bw <= 0) return;

  bodies.push({ x: bx, y: bodyTop, w: bw, h: bodyH, up });

  const wickX = Math.max(chartLeft, Math.min(xCenter, chartRight));
  const wickTop = candleValueToY(c.high, padTop, displayMax, valRange, chartH);
  const wickBot = candleValueToY(c.low, padTop, displayMax, valRange, chartH);
  wicks.push({ x: wickX, y1: wickTop, y2: wickBot, up });
}

/**
 * Build screen-space candle bodies and wicks for a visible window.
 * Pure worklet — no Skia imports, consumed by useCandlePaths.
 */
export function buildCandleGeometry(
  candles: CandlePoint[],
  liveCandle: CandlePoint | null,
  padding: ChartPadding,
  canvasW: number,
  canvasH: number,
  winStart: number,
  windowSecs: number,
  displayMin: number,
  displayMax: number,
  candleWidthSecs: number,
  metrics: CandleMetrics = CANDLE_METRICS_DEFAULTS,
): CandleGeometry {
  "worklet";
  const chartW = canvasW - padding.left - padding.right;
  const chartH = canvasH - padding.top - padding.bottom;
  const valRange = displayMax - displayMin;

  if (valRange === 0 || chartW <= 0 || chartH <= 0)
    return { bodies: [], wicks: [] };

  const slotPx = (candleWidthSecs / windowSecs) * chartW;
  const bodyW = Math.max(
    1,
    Math.min(
      slotPx * metrics.bodyWidthRatio,
      slotPx - metrics.minGapPx,
      metrics.maxBodyPx,
    ),
  );

  const bodies: CandleRect[] = [];
  const wicks: CandleWick[] = [];

  const winEnd = winStart + windowSecs;
  const chartLeft = padding.left;
  const chartRight = canvasW - padding.right;
  const padTop = padding.top;
  const padLeft = padding.left;

  // Binary search for first candle overlapping the window
  let lo = 0;
  let hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time + candleWidthSecs < winStart) lo = mid + 1;
    else hi = mid;
  }

  for (let i = lo; i < candles.length; i++) {
    /* istanbul ignore next -- past visible window */
    if (candles[i].time > winEnd) break;
    appendCandleShapes(
      candles[i],
      winStart,
      winEnd,
      windowSecs,
      chartW,
      chartH,
      chartLeft,
      chartRight,
      padTop,
      padLeft,
      displayMax,
      valRange,
      candleWidthSecs,
      bodyW,
      metrics.minBodyPx,
      bodies,
      wicks,
    );
  }

  if (liveCandle) {
    appendCandleShapes(
      liveCandle,
      winStart,
      winEnd,
      windowSecs,
      chartW,
      chartH,
      chartLeft,
      chartRight,
      padTop,
      padLeft,
      displayMax,
      valRange,
      candleWidthSecs,
      bodyW,
      metrics.minBodyPx,
      bodies,
      wicks,
    );
  }

  return { bodies, wicks };
}
