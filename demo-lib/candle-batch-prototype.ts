import type { Skia } from "react-native-skia";
import { CANDLE_METRICS_DEFAULTS } from "../packages/react-native-livechart/src/constants";
import type {
  CandleMetrics,
  CandlePoint,
} from "../packages/react-native-livechart/src/types";
import type { ChartPadding } from "../packages/react-native-livechart/src/draw/line";

type Builder = ReturnType<typeof Skia.PathBuilder.Make>;
export interface CandleBatchScratch {
  upBodies: Builder;
  downBodies: Builder;
  upWicks: Builder;
  downWicks: Builder;
  rect: { x: number; y: number; width: number; height: number };
  roundRect: { rect: CandleBatchScratch["rect"]; rx: number; ry: number };
}

/** Create on the UI runtime; each instance belongs to one chart. */
export function makeCandleBatchScratch(
  builders: Builder[],
): CandleBatchScratch {
  "worklet";
  const rect = { x: 0, y: 0, width: 0, height: 0 };
  return {
    upBodies: builders[0],
    downBodies: builders[1],
    upWicks: builders[2],
    downWicks: builders[3],
    rect,
    roundRect: { rect, rx: 0, ry: 0 },
  };
}

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
  batch: CandleBatchScratch,
  radius: number,
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

  const rect = batch.rect;
  rect.x = bx;
  rect.y = bodyTop;
  rect.width = bw;
  rect.height = bodyH;
  const builder = up ? batch.upBodies : batch.downBodies;
  const rr = radius > 0 ? Math.min(radius, bw / 2, bodyH / 2) : 0;
  if (rr > 0) {
    batch.roundRect.rx = rr;
    batch.roundRect.ry = rr;
    builder.addRRect(batch.roundRect);
  } else {
    builder.addRect(rect);
  }

  const wickX = Math.max(chartLeft, Math.min(xCenter, chartRight));
  const wickTop = candleValueToY(c.high, padTop, displayMax, valRange, chartH);
  const wickBot = candleValueToY(c.low, padTop, displayMax, valRange, chartH);
  const wick = up ? batch.upWicks : batch.downWicks;
  wick.moveTo(wickX, wickTop);
  wick.lineTo(wickX, wickBot);
}

/**
 * Measurement prototype. Emit four existing batches in one geometry pass.
 * No per-candle body/wick objects or rectangle wrappers are allocated here.
 * Production useCandlePaths is deliberately unchanged during this experiment.
 */
function emitCandleBatch(
  batch: CandleBatchScratch,
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
): void {
  "worklet";
  const chartW = canvasW - padding.left - padding.right;
  const chartH = canvasH - padding.top - padding.bottom;
  const valRange = displayMax - displayMin;

  if (valRange === 0 || chartW <= 0 || chartH <= 0) return;

  const slotPx = (candleWidthSecs / windowSecs) * chartW;
  const bodyW = Math.max(
    1,
    Math.min(
      slotPx * metrics.bodyWidthRatio,
      slotPx - metrics.minGapPx,
      metrics.maxBodyPx,
    ),
  );

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
      batch,
      metrics.bodyRadius,
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
      batch,
      metrics.bodyRadius,
    );
  }
}

/** Same four immutable paths and native drawing commands as the current renderer. */
export function buildCandleBatch(
  batch: CandleBatchScratch,
  ...args: Parameters<typeof emitCandleBatch> extends [
    CandleBatchScratch,
    ...infer Args,
  ]
    ? Args
    : never
) {
  "worklet";
  emitCandleBatch(batch, ...args);
  return [
    batch.upBodies.detach(),
    batch.downBodies.detach(),
    batch.upWicks.detach(),
    batch.downWicks.detach(),
  ];
}
