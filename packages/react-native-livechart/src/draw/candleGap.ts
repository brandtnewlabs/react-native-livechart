import { CANDLE_METRICS_DEFAULTS } from "../constants";
import {
  candleAtBucketTime,
  previousCandleAtTime,
  previousCandleCloseAtTime,
} from "../math/candleGaps";
import type {
  CandleGap,
  CandleGapKind,
  CandleMetrics,
  CandlePoint,
} from "../types";
import type { ChartPadding } from "./line";

export interface CandleGapMark {
  x1: number;
  x2: number;
  y: number;
  kind: CandleGapKind;
}

export interface CandleGapGeometry {
  marks: CandleGapMark[];
}

/** Pure worklet geometry for neutral previous-close marks in explicit gaps. */
export function buildCandleGapGeometry(
  candles: CandlePoint[],
  liveCandle: CandlePoint | null,
  gaps: CandleGap[],
  padding: ChartPadding,
  canvasW: number,
  canvasH: number,
  winStart: number,
  windowSecs: number,
  displayMin: number,
  displayMax: number,
  candleWidthSecs: number,
  bridgeNoTrades: boolean,
  bridgeUnavailable: boolean,
  bridgeUnknown: boolean,
  metrics: CandleMetrics = CANDLE_METRICS_DEFAULTS,
): CandleGapGeometry {
  "worklet";
  const chartW = canvasW - padding.left - padding.right;
  const chartH = canvasH - padding.top - padding.bottom;
  const valueRange = displayMax - displayMin;
  if (
    chartW <= 0 ||
    chartH <= 0 ||
    valueRange <= 0 ||
    windowSecs <= 0 ||
    candleWidthSecs <= 0
  ) {
    return { marks: [] };
  }

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
  const marks: CandleGapMark[] = [];

  for (let gi = 0; gi < gaps.length; gi++) {
    const gap = gaps[gi];
    if (gap.from >= winEnd || gap.to <= winStart) continue;
    const bridge =
      gap.kind === "no-trades"
        ? bridgeNoTrades
        : gap.kind === "unavailable"
          ? bridgeUnavailable
          : bridgeUnknown;
    if (!bridge) continue;

    const seedTime = Math.max(gap.from, winStart - candleWidthSecs);
    const previous = previousCandleAtTime(candles, liveCandle, seedTime);
    const origin =
      previous?.time ?? candles[0]?.time ?? liveCandle?.time ?? gap.from;
    let bucket =
      origin +
      Math.ceil((gap.from - origin) / candleWidthSecs - 1e-9) *
        candleWidthSecs;
    if (bucket < gap.from) bucket += candleWidthSecs;
    if (bucket + candleWidthSecs < winStart) {
      bucket +=
        Math.floor((winStart - bucket) / candleWidthSecs) * candleWidthSecs;
      while (bucket + candleWidthSecs < winStart) bucket += candleWidthSecs;
    }

    for (
      ;
      bucket + candleWidthSecs <= gap.to && bucket <= winEnd;
      bucket += candleWidthSecs
    ) {
      if (
        candleAtBucketTime(candles, liveCandle, bucket, candleWidthSecs) !== null
      ) {
        continue;
      }
      const close = previousCandleCloseAtTime(candles, liveCandle, bucket);
      if (close === null) continue;

      const centerTime = bucket + candleWidthSecs / 2;
      const centerX =
        padding.left + ((centerTime - winStart) / windowSecs) * chartW;
      if (
        centerX < chartLeft - bodyW / 2 ||
        centerX > chartRight + bodyW / 2
      ) {
        continue;
      }
      const y =
        padding.top + ((displayMax - close) / valueRange) * chartH;
      marks.push({
        x1: Math.max(chartLeft, centerX - bodyW / 2),
        x2: Math.min(chartRight, centerX + bodyW / 2),
        y,
        kind: gap.kind,
      });
    }
  }

  return { marks };
}
