import type { CandlePoint } from "../types";
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

const MIN_BODY_PX = 1;
const MAX_BODY_PX = 40;

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
): CandleGeometry {
  "worklet";
  const chartW = canvasW - padding.left - padding.right;
  const chartH = canvasH - padding.top - padding.bottom;
  const valRange = displayMax - displayMin;

  if (valRange === 0 || chartW <= 0 || chartH <= 0)
    return { bodies: [], wicks: [] };

  const toX = (t: number) =>
    padding.left + ((t - winStart) / windowSecs) * chartW;
  const toY = (v: number) =>
    padding.top + ((displayMax - v) / valRange) * chartH;

  const slotPx = (candleWidthSecs / windowSecs) * chartW;
  const bodyW = Math.max(1, Math.min(slotPx * 0.8, slotPx - 2, MAX_BODY_PX));

  const bodies: CandleRect[] = [];
  const wicks: CandleWick[] = [];

  const winEnd = winStart + windowSecs;
  const chartLeft = padding.left;
  const chartRight = canvasW - padding.right;

  const processCandle = (c: CandlePoint) => {
    if (c.time + candleWidthSecs < winStart || c.time > winEnd) return;

    const up = c.close >= c.open;
    const xCenter = toX(c.time + candleWidthSecs / 2);

    // Skip candles whose center is outside the drawable chart area
    if (xCenter < chartLeft - bodyW / 2 || xCenter > chartRight + bodyW / 2)
      return;

    const bodyTop = toY(up ? c.close : c.open);
    const bodyBot = toY(up ? c.open : c.close);
    const bodyH = Math.max(MIN_BODY_PX, bodyBot - bodyTop);

    // Clamp horizontal extent to the chart area
    let bx = xCenter - bodyW / 2;
    let bw = bodyW;
    if (bx < chartLeft) {
      bw -= chartLeft - bx;
      bx = chartLeft;
    }
    if (bx + bw > chartRight) {
      bw = chartRight - bx;
    }
    if (bw <= 0) return;

    bodies.push({ x: bx, y: bodyTop, w: bw, h: bodyH, up });

    const wickX = Math.max(chartLeft, Math.min(xCenter, chartRight));
    const wickTop = toY(c.high);
    const wickBot = toY(c.low);
    wicks.push({ x: wickX, y1: wickTop, y2: wickBot, up });
  };

  // Binary search for first candle overlapping the window
  let lo = 0;
  let hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time + candleWidthSecs < winStart) lo = mid + 1;
    else hi = mid;
  }

  for (let i = lo; i < candles.length; i++) {
    if (candles[i].time > winEnd) break;
    processCandle(candles[i]);
  }

  if (liveCandle) {
    processCandle(liveCandle);
  }

  return { bodies, wicks };
}
