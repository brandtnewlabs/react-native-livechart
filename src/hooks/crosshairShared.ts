import { type SkFont } from "@shopify/react-native-skia";
import { type Gesture } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import { type ChartPadding } from "../draw/line";
import { interpolateAtTime } from "../math/interpolate";
import { measureFontTextWidth } from "../measureFontTextWidth";

const TOOLTIP_PAD_X = 8;
const TOOLTIP_PAD_Y = 6;
const TOOLTIP_LINE_GAP = 4;
export const FADE_ZONE = 4;

export interface TooltipLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  valueStr: string;
  timeStr: string;
  valueTextX: number;
  timeTextX: number;
  line1Y: number;
  line2Y: number;
  /** Multi-series tooltip: time + per-series rows (replaces valueStr/timeStr rendering). */
  stackedLines?: {
    text: string;
    textX: number;
    baselineY: number;
    dim: boolean;
  }[];
}

export const HIDDEN_TOOLTIP: TooltipLayout = {
  x: -400,
  y: 0,
  w: 0,
  h: 0,
  valueStr: "",
  timeStr: "",
  valueTextX: -400,
  timeTextX: -400,
  line1Y: 0,
  line2Y: 0,
  stackedLines: undefined,
};

export interface CrosshairState {
  scrubX: SharedValue<number>;
  scrubActive: SharedValue<boolean>;
  scrubTime: SharedValue<number>;
  scrubValue: SharedValue<number | null>;
  crosshairOpacity: SharedValue<number>;
  tooltipLayout: SharedValue<TooltipLayout>;
  gesture: ReturnType<typeof Gesture.Pan>;
}

/**
 * Maps a scrub X position to a window timestamp.
 * Returns -1 when inactive or when the canvas is not yet laid out.
 */
export function computeScrubTime(
  scrubActive: boolean,
  scrubX: number,
  padding: ChartPadding,
  canvasWidth: number,
  timestamp: number,
  windowSecs: number,
): number {
  "worklet";
  if (!scrubActive) return -1;
  const chartW = canvasWidth - padding.left - padding.right;
  if (chartW <= 0) return -1;
  const winStart = timestamp - windowSecs;
  const fraction = (scrubX - padding.left) / chartW;
  return winStart + fraction * windowSecs;
}

/**
 * Crosshair opacity: fades 1→0 over FADE_ZONE px as the crosshair
 * approaches the live dot at the right chart edge.
 */
export function computeCrosshairOpacity(
  scrubActive: boolean,
  scrubX: number,
  canvasWidth: number,
  paddingRight: number,
): number {
  "worklet";
  if (!scrubActive) return 0;
  const dotX = canvasWidth - paddingRight;
  const dist = dotX - scrubX;
  return Math.min(1, Math.max(0, dist / FADE_ZONE));
}

/**
 * Full tooltip pill layout. Returns HIDDEN_TOOLTIP when the scrub is
 * inactive or no value can be interpolated at the current time.
 */
export function computeTooltipLayout(
  scrubActive: boolean,
  scrubX: number,
  scrubValue: number | null,
  scrubTime: number,
  padding: ChartPadding,
  canvasWidth: number,
  formatValue: (v: number) => string,
  formatTime: (t: number) => string,
  font: SkFont,
): TooltipLayout {
  "worklet";
  if (!scrubActive || scrubValue === null) return HIDDEN_TOOLTIP;

  const v = scrubValue;
  const t = scrubTime;
  const valueStr = formatValue(v);
  const timeStr = formatTime(t);

  const fm = font.getMetrics();
  const lineH = -fm.ascent + fm.descent;
  const totalH = TOOLTIP_PAD_Y * 2 + lineH * 2 + TOOLTIP_LINE_GAP;

  const valueW = measureFontTextWidth(font, valueStr);
  const timeW = measureFontTextWidth(font, timeStr);
  const contentW = Math.max(valueW, timeW);
  const pillW = contentW + TOOLTIP_PAD_X * 2;

  const rightEdge = canvasWidth - padding.right;

  let pillX = scrubX + 12;
  if (pillX + pillW > rightEdge - 4) {
    pillX = scrubX - pillW - 12;
  }
  const pillY = padding.top + 8;

  const line1Y = pillY + TOOLTIP_PAD_Y - fm.ascent;
  const line2Y = line1Y + lineH + TOOLTIP_LINE_GAP;

  const valueTextX = pillX + TOOLTIP_PAD_X + (contentW - valueW) / 2;
  const timeTextX = pillX + TOOLTIP_PAD_X + (contentW - timeW) / 2;

  return {
    x: pillX,
    y: pillY,
    w: pillW,
    h: totalH,
    valueStr,
    timeStr,
    valueTextX,
    timeTextX,
    line1Y,
    line2Y,
    stackedLines: undefined,
  };
}

/**
 * Multi-series scrub tooltip — stacked lines (first row typically time, dim).
 */
export function computeTooltipLayoutMulti(
  scrubActive: boolean,
  scrubX: number,
  lines: { text: string; dim: boolean }[],
  padding: ChartPadding,
  canvasWidth: number,
  font: SkFont,
): TooltipLayout {
  "worklet";
  if (!scrubActive || lines.length === 0) return HIDDEN_TOOLTIP;

  const fm = font.getMetrics();
  const lineH = -fm.ascent + fm.descent;
  const lineGap = TOOLTIP_LINE_GAP;
  const n = lines.length;
  const totalH = TOOLTIP_PAD_Y * 2 + lineH * n + lineGap * Math.max(0, n - 1);

  let contentW = 0;
  const lineWidths: number[] = [];
  for (let i = 0; i < n; i++) {
    const w = measureFontTextWidth(font, lines[i].text);
    lineWidths.push(w);
    if (w > contentW) contentW = w;
  }
  const pillW = contentW + TOOLTIP_PAD_X * 2;

  const rightEdge = canvasWidth - padding.right;
  let pillX = scrubX + 12;
  if (pillX + pillW > rightEdge - 4) {
    pillX = scrubX - pillW - 12;
  }
  const pillY = padding.top + 8;

  const stackedLines: {
    text: string;
    textX: number;
    baselineY: number;
    dim: boolean;
  }[] = [];
  let y = pillY + TOOLTIP_PAD_Y - fm.ascent;
  for (let i = 0; i < n; i++) {
    stackedLines.push({
      text: lines[i].text,
      textX: pillX + TOOLTIP_PAD_X + (contentW - lineWidths[i]) / 2,
      baselineY: y,
      dim: lines[i].dim,
    });
    y += lineH + lineGap;
  }

  return {
    x: pillX,
    y: pillY,
    w: pillW,
    h: totalH,
    valueStr: "",
    timeStr: "",
    valueTextX: -400,
    timeTextX: -400,
    line1Y: 0,
    line2Y: 0,
    stackedLines,
  };
}

/**
 * Candle-mode tooltip — 5 stacked rows: O, H, L, C (bright) + time (dim).
 */
export function computeCandleTooltipLayout(
  scrubActive: boolean,
  scrubX: number,
  candle: { open: number; high: number; low: number; close: number } | null,
  scrubTime: number,
  padding: ChartPadding,
  canvasWidth: number,
  formatValue: (v: number) => string,
  formatTime: (t: number) => string,
  font: SkFont,
): TooltipLayout {
  "worklet";
  if (!scrubActive || !candle) return HIDDEN_TOOLTIP;
  const lines: { text: string; dim: boolean }[] = [
    { text: `O ${formatValue(candle.open)}`, dim: false },
    { text: `H ${formatValue(candle.high)}`, dim: false },
    { text: `L ${formatValue(candle.low)}`, dim: false },
    { text: `C ${formatValue(candle.close)}`, dim: false },
    { text: formatTime(scrubTime), dim: true },
  ];
  return computeTooltipLayoutMulti(
    scrubActive,
    scrubX,
    lines,
    padding,
    canvasWidth,
    font,
  );
}

/** Single-series scrub value at window time — extracted for tests. */
export function deriveScrubValueSingle(
  scrubActive: boolean,
  scrubTime: number,
  data: { time: number; value: number }[],
): number | null {
  "worklet";
  if (!scrubActive || scrubTime < 0) return null;
  return interpolateAtTime(data, scrubTime);
}

/** Single-series crosshair tooltip — extracted for tests. */
export function deriveCrosshairTooltipSingle(
  scrubActive: boolean,
  scrubX: number,
  scrubTime: number,
  scrubValue: number | null,
  padding: ChartPadding,
  canvasWidth: number,
  formatValue: (v: number) => string,
  formatTime: (t: number) => string,
  font: SkFont,
): TooltipLayout {
  "worklet";
  if (!scrubActive || scrubTime < 0) return HIDDEN_TOOLTIP;
  return computeTooltipLayout(
    scrubActive,
    scrubX,
    scrubValue,
    scrubTime,
    padding,
    canvasWidth,
    formatValue,
    formatTime,
    font,
  );
}
