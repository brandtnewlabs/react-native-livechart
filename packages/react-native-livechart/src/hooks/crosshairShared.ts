import { type SkFont } from "@shopify/react-native-skia";
import { type Gesture } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import { type ChartPadding } from "../draw/line";
import { interpolateAtTime } from "../math/interpolate";

const TOOLTIP_PAD_X = 8;
const TOOLTIP_PAD_Y = 6;
const TOOLTIP_LINE_GAP = 4;
const TOOLTIP_OFFSET_X = 12;
const TOOLTIP_EDGE_GAP = 4;
const TOOLTIP_TOP_MARGIN = 8;
const FADE_ZONE = 4;

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
  /** Scrub intersection Y in canvas px; -1 when there's no dot to draw
   *  (inactive / no value / degenerate range). See {@link computeScrubDotY}. */
  scrubDotY: SharedValue<number>;
  gesture: ReturnType<typeof Gesture.Pan>;

  // ── Scrub-action ("order ticket") lock state — single-series `useCrosshair`
  //    only; undefined on the multi-series crosshair. ───────────────────────────
  /** Whether a reticle is currently placed/locked. */
  lockActive?: SharedValue<boolean>;
  /** Locked reticle X in canvas px (-1 when none). */
  lockX?: SharedValue<number>;
  /** Locked reticle Y in canvas px (-1 when none). */
  lockY?: SharedValue<number>;
  /** Chosen price = value at the reticle Y (optionally snapped); null when none. */
  lockPrice?: SharedValue<number | null>;
  /** Right-gutter action-badge layout (also the tap hit rect). */
  actionBadge?: SharedValue<ActionBadgeLayout>;
  /** X-axis time-badge layout at the reticle (opt-in; hidden when off). */
  timeBadge?: SharedValue<TimeBadgeLayout>;
  /** Tap gesture that places/moves the reticle, presses the badge, or dismisses. */
  tapGesture?: ReturnType<typeof Gesture.Tap>;
}

/**
 * Maps a scrub value to its Y pixel at the crosshair intersection — the same
 * mapping the live dot and tooltip use. Returns -1 when there is no dot to draw
 * (value is null or the canvas isn't laid out); a degenerate (zero) range pins
 * the dot to the vertical center of the plot.
 */
export function computeScrubDotY(
  value: number | null,
  displayMin: number,
  displayMax: number,
  canvasHeight: number,
  padTop: number,
  padBottom: number,
): number {
  "worklet";
  if (value === null) return -1;
  const chartH = canvasHeight - padTop - padBottom;
  if (chartH <= 0) return -1;
  const valRange = displayMax - displayMin;
  if (valRange === 0) return padTop + chartH / 2;
  return padTop + ((displayMax - value) / valRange) * chartH;
}

/**
 * Inverse of {@link computeScrubDotY}: maps a canvas Y pixel back to a value (a
 * free price *level*, used by scrub-action mode where the reticle Y is the chosen
 * price, not the line value at the reticle X). Returns null when the canvas isn't
 * laid out. A degenerate (zero) range collapses to the single value; a Y dragged
 * past the plot edges clamps to `displayMin` / `displayMax` rather than
 * extrapolating to a nonsensical price.
 */
export function computeValueAtY(
  y: number,
  displayMin: number,
  displayMax: number,
  canvasHeight: number,
  padTop: number,
  padBottom: number,
): number | null {
  "worklet";
  const chartH = canvasHeight - padTop - padBottom;
  if (chartH <= 0) return null;
  const valRange = displayMax - displayMin;
  if (valRange === 0) return displayMin;
  const clampedY = Math.min(padTop + chartH, Math.max(padTop, y));
  const frac = (clampedY - padTop) / chartH; // 0 at top, 1 at bottom
  return displayMax - frac * valRange; // top → displayMax, bottom → displayMin
}

/** Rounds `price` to the nearest `increment` (no-op when increment is falsy/≤0). */
export function snapPrice(price: number, increment?: number): number {
  "worklet";
  if (!increment || increment <= 0) return price;
  return Math.round(price / increment) * increment;
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
  /** Monospace advance width. When > 0, text width is `len * monoCharWidth`
   *  instead of a per-frame Skia `measureText` — scrubbing re-runs this worklet
   *  every frame, and `measureText` shapes text each call (a real cost,
   *  especially in the simulator). Falls back to `measureText` when 0. */
  monoCharWidth = 0,
  /** Where the pill sits relative to the scrub line. `"side"` offsets it right
   *  (flipping left near the edge); `"top"`/`"bottom"` center it over the line,
   *  clamped into the plot and pinned to the plot's top/bottom. */
  placement: "side" | "top" | "bottom" = "side",
  /** Render the value row. */
  showValue = true,
  /** Render the time row. */
  showTime = true,
  /** Canvas height in px — needed to pin `"bottom"` placement. */
  canvasHeight = 0,
  /** Gap in px between the pill and the plot edge it's pinned to. */
  margin = TOOLTIP_TOP_MARGIN,
): TooltipLayout {
  "worklet";
  if (!scrubActive || scrubValue === null) return HIDDEN_TOOLTIP;

  const v = scrubValue;
  const t = scrubTime;
  const valueStr = formatValue(v);
  const timeStr = formatTime(t);

  // Content toggles: pick which rows render. Guard both-off → keep the time row.
  let sv = showValue;
  let st = showTime;
  let rowCount = (sv ? 1 : 0) + (st ? 1 : 0);
  if (rowCount === 0) {
    st = true;
    rowCount = 1;
  }

  const fm = font.getMetrics();
  const lineH = -fm.ascent + fm.descent;
  const totalH =
    TOOLTIP_PAD_Y * 2 + lineH * rowCount + TOOLTIP_LINE_GAP * (rowCount - 1);

  const valueW =
    monoCharWidth > 0
      ? valueStr.length * monoCharWidth
      : measureFontTextWidth(font, valueStr);
  const timeW =
    monoCharWidth > 0
      ? timeStr.length * monoCharWidth
      : measureFontTextWidth(font, timeStr);
  // Only the visible rows contribute to the pill width.
  const contentW = Math.max(sv ? valueW : 0, st ? timeW : 0);
  const pillW = contentW + TOOLTIP_PAD_X * 2;

  const rightEdge = canvasWidth - padding.right;

  let pillX: number;
  let pillY: number;
  if (placement === "side") {
    pillX = scrubX + TOOLTIP_OFFSET_X;
    if (pillX + pillW > rightEdge - TOOLTIP_EDGE_GAP) {
      pillX = scrubX - pillW - TOOLTIP_OFFSET_X;
    }
    pillY = padding.top + margin;
  } else {
    // Centered horizontally over the scrub line, clamped into the plot.
    const leftBound = padding.left + TOOLTIP_EDGE_GAP;
    const rightBound = rightEdge - TOOLTIP_EDGE_GAP - pillW;
    pillX = Math.min(
      Math.max(scrubX - pillW / 2, leftBound),
      Math.max(leftBound, rightBound),
    );
    pillY =
      placement === "top"
        ? padding.top + margin
        : canvasHeight - padding.bottom - margin - totalH;
  }

  // line1Y = first rendered row's baseline; line2Y = second (when both shown).
  // The overlay maps value→line1Y and time→(showValue ? line2Y : line1Y).
  const firstBaseline = pillY + TOOLTIP_PAD_Y - fm.ascent;
  const line1Y = firstBaseline;
  const line2Y = firstBaseline + lineH + TOOLTIP_LINE_GAP;

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
  /** Monospace advance width; when > 0, sizes text by length instead of a
   *  per-frame Skia `measureText`. See {@link computeTooltipLayout}. */
  monoCharWidth = 0,
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
    const w =
      monoCharWidth > 0
        ? lines[i].text.length * monoCharWidth
        : measureFontTextWidth(font, lines[i].text);
    lineWidths.push(w);
    if (w > contentW) contentW = w;
  }
  const pillW = contentW + TOOLTIP_PAD_X * 2;

  const rightEdge = canvasWidth - padding.right;
  let pillX = scrubX + TOOLTIP_OFFSET_X;
  if (pillX + pillW > rightEdge - TOOLTIP_EDGE_GAP) {
    pillX = scrubX - pillW - TOOLTIP_OFFSET_X;
  }
  const pillY = padding.top + TOOLTIP_TOP_MARGIN;

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
  monoCharWidth = 0,
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
    monoCharWidth,
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

/**
 * Right-gutter action-badge layout for scrub-action mode — two pills, vertically
 * centered on the locked reticle Y and anchored to the canvas right edge:
 *
 * - a **circular** icon button (the action), and
 * - a capsule **price pill** showing the formatted value,
 *
 * separated by {@link ACTION_BADGE_GAP}px (`[icon] [price]`). The price pill is
 * right-anchored in the gutter with its text horizontally centered; a lone icon
 * (icon-only) anchors to the plot's right edge, attached to the level line.
 * Either element is omitted when its content is empty (icon-only, or no price).
 * The union rect (`x/y/w/h`) is the single source of truth for the tap hit-test
 * (see {@link pointInRect}). When not locked / not laid out / both empty, returns
 * {@link HIDDEN_ACTION_BADGE}.
 *
 * The price text is sized to its actual visual bounds via `font.measureText`
 * (run only while a reticle is shown) so the readout stays exactly centered —
 * see the inline note on `priceTextX` below.
 */
export interface ActionBadgeLayout {
  /** Union hit rect (icon button + price pill). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Whether the circular icon button is shown. */
  hasIcon: boolean;
  /** Icon button circle center + radius (the glyph is centered on this by the overlay). */
  iconCx: number;
  iconCy: number;
  iconR: number;
  /** Whether the price pill is shown. */
  hasPrice: boolean;
  /** Price pill rect. */
  priceX: number;
  priceY: number;
  priceW: number;
  priceH: number;
  /** Price text left x. */
  priceTextX: number;
  /** Shared baseline y for the icon glyph + price text. */
  textY: number;
  /** Formatted price string drawn in the price pill. */
  priceText: string;
  /** Whether the badge is shown (locked + laid out + has content). */
  visible: boolean;
}

export const HIDDEN_ACTION_BADGE: ActionBadgeLayout = {
  x: -400,
  y: 0,
  w: 0,
  h: 0,
  hasIcon: false,
  iconCx: -400,
  iconCy: 0,
  iconR: 0,
  hasPrice: false,
  priceX: -400,
  priceY: 0,
  priceW: 0,
  priceH: 0,
  priceTextX: -400,
  textY: 0,
  priceText: "",
  visible: false,
};

/** Gap between the icon button and the price pill, in px. */
const ACTION_BADGE_GAP = 2;

export function computeActionBadgeLayout(
  locked: boolean,
  lockY: number,
  priceText: string,
  icon: string,
  canvasWidth: number,
  /** Plot's right edge (= canvasWidth - padding.right) — where the level line ends. */
  plotRight: number,
  font: SkFont,
  marginEdge: number,
  padX: number,
  padY: number,
): ActionBadgeLayout {
  "worklet";
  if (!locked || canvasWidth <= 0) return HIDDEN_ACTION_BADGE;

  const hasIcon = icon.length > 0;
  const hasPrice = priceText.length > 0;
  if (!hasIcon && !hasPrice) return HIDDEN_ACTION_BADGE;

  const pillH = font.getSize() + padY * 2;
  const r = pillH / 2;
  const top = lockY - pillH / 2;
  const rightEdge = canvasWidth - marginEdge;

  const fm = font.getMetrics();
  const textY = lockY - (fm.ascent + fm.descent) / 2;

  // Price pill (the readout) sits in the price-axis gutter, anchored to the edge.
  let priceW = 0;
  let priceX = rightEdge;
  let priceTextX = rightEdge;
  if (hasPrice) {
    // Size the pill to the text's ACTUAL visual bounds (+ pad each side), then
    // position the text origin so the *ink* — not the advance box — is centered:
    // subtract the glyph's left side-bearing (`bounds.x`). `SkiaText` draws from
    // the pen origin, so an origin at `padX` would leave the ink shifted by the
    // bearing; this lands the visual center exactly on the pill center.
    //
    // This measures the actual string each frame rather than estimating from a
    // per-char monospace width. A uniform width over-reserves for prices with
    // narrow glyphs ("1", "."), which visibly de-centers the readout — and
    // exact centering matters more here than shaving the per-frame `measureText`,
    // which profiling put at ~4% of one core on the simulator (transient, only
    // while a reticle is shown). See the price-pill centering tests.
    const bounds = font.measureText(priceText);
    priceW = bounds.width + padX * 2;
    priceX = rightEdge - priceW;
    priceTextX = priceX + padX - bounds.x;
  }

  // Circular icon button: left of the price pill, or — when alone (icon-only) —
  // anchored to the plot's right edge so it stays attached to the level line.
  let iconCx = plotRight;
  if (hasIcon && hasPrice) {
    iconCx = priceX - ACTION_BADGE_GAP - r;
  }

  const unionLeft = hasIcon ? iconCx - r : priceX;
  const unionRight = hasPrice ? rightEdge : iconCx + r;

  return {
    x: unionLeft,
    y: top,
    w: unionRight - unionLeft,
    h: pillH,
    hasIcon,
    iconCx,
    iconCy: lockY,
    iconR: r,
    hasPrice,
    priceX,
    priceY: top,
    priceW,
    priceH: pillH,
    priceTextX,
    textY,
    priceText,
    visible: true,
  };
}

/**
 * X-axis time-badge layout for scrub-action mode — a small capsule pinned where
 * the reticle's vertical line meets the time axis (the bottom gutter), centered
 * on the reticle X and clamped to stay within the canvas. Display-only (no
 * hit-test): an opt-in readout of the date/time under the reticle, formatted by
 * the chart's `formatTime`. Hidden when not locked / not laid out / empty text.
 */
export interface TimeBadgeLayout {
  /** Pill rect. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Time text left x (visual-bounds centered) + shared baseline y. */
  textX: number;
  textY: number;
  /** Formatted time string drawn in the pill. */
  timeText: string;
  /** Whether the badge is shown (locked + laid out + has text). */
  visible: boolean;
}

export const HIDDEN_TIME_BADGE: TimeBadgeLayout = {
  x: -400,
  y: 0,
  w: 0,
  h: 0,
  textX: -400,
  textY: 0,
  timeText: "",
  visible: false,
};

export function computeTimeBadgeLayout(
  locked: boolean,
  lockX: number,
  timeText: string,
  canvasWidth: number,
  /** Baseline y where the x-axis time labels sit (= canvasHeight - padding.bottom
   *  + X_AXIS_LABEL_OFFSET_Y). The pill is vertically centered on this row so it
   *  aligns with the axis values it overlays. */
  labelBaselineY: number,
  font: SkFont,
  padX: number,
  padY: number,
  marginEdge: number,
): TimeBadgeLayout {
  "worklet";
  if (!locked || canvasWidth <= 0 || timeText.length === 0)
    return HIDDEN_TIME_BADGE;

  const pillH = font.getSize() + padY * 2;
  // Snug to the measured text + centered ink (subtract the left side-bearing), the
  // same approach the price pill uses.
  const bounds = font.measureText(timeText);
  const w = bounds.width + padX * 2;

  // Center the pill under the reticle X, clamped into the canvas gutter so it
  // never spills past either edge.
  const minX = marginEdge;
  const maxX = Math.max(minX, canvasWidth - marginEdge - w);
  const x = Math.min(maxX, Math.max(minX, lockX - w / 2));

  // Sit the text on the axis-label baseline (so it lines up with the time values)
  // and center the pill vertically around that text.
  const fm = font.getMetrics();
  const textY = labelBaselineY;
  const cy = labelBaselineY + (fm.ascent + fm.descent) / 2;
  const top = cy - pillH / 2;
  const textX = x + padX - bounds.x;

  return { x, y: top, w, h: pillH, textX, textY, timeText, visible: true };
}

/** Axis-aligned point-in-rect test with an optional touch-target inflation. */
export function pointInRect(
  px: number,
  py: number,
  rect: { x: number; y: number; w: number; h: number },
  slop = 0,
): boolean {
  "worklet";
  return (
    px >= rect.x - slop &&
    px <= rect.x + rect.w + slop &&
    py >= rect.y - slop &&
    py <= rect.y + rect.h + slop
  );
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
  monoCharWidth = 0,
  placement: "side" | "top" | "bottom" = "side",
  showValue = true,
  showTime = true,
  canvasHeight = 0,
  margin = TOOLTIP_TOP_MARGIN,
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
    monoCharWidth,
    placement,
    showValue,
    showTime,
    canvasHeight,
    margin,
  );
}
