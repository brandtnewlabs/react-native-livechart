import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { SkFont } from "@shopify/react-native-skia";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import {
  classifyReferenceEdge,
  referenceLineForm,
  resolveReferenceBadge,
} from "../math/referenceLines";
import type { ReferenceLine } from "../types";

/** Screen-space geometry for one reference line / band, recomputed each frame. */
export interface ReferenceLineLayout {
  visible: boolean;
  /** Line y, or band top-edge y. */
  y: number;
  /** Band bottom-edge y (value/time band); equals `y` for a plain line. */
  yBottom: number;
  /** Left x extent of the plot (badge / label / connector anchor). */
  x1: number;
  /** Right x extent of the plot (badge / label / connector anchor). */
  x2: number;
  /**
   * Left x of the **drawn** line / band. Equals {@link x1} normally, or `0`
   * (canvas edge) when the line is full-width. Decoupled from {@link x1} so the
   * line can run through the gutter while the badge/label stays in the plot.
   */
  lineX1: number;
  /** Right x of the drawn line / band: {@link x2} normally, or the canvas width when full-width. */
  lineX2: number;
  /** Stroke the plain horizontal line (true for a plain Form-A line, or a full-width badged line). */
  drawLine: boolean;
  /** Resolved label text (with appended value when `showValue`); "" when hidden. */
  label: string;
  labelX: number;
  labelY: number;
  /** True when a Form-A value is off-screen (badge pinned to the edge + chevron). */
  offAxis: boolean;
  /** Off-axis chevron points up (target above range) vs down (below). */
  chevronUp: boolean;
  /** True when the value renders as a pill badge (icon / text / chevron tag). */
  badge: boolean;
  /** Badge pill rect left x. */
  pillX: number;
  /** Badge pill rect width. */
  pillW: number;
  /** Badge icon glyph x (-1 when no icon). */
  iconX: number;
  /** Badge icon glyph (""/none). */
  icon: string;
  /** Off-axis chevron center x (-1 when no chevron). */
  chevronCx: number;
  /** Connector dashed-line start x (-1 when no connector). */
  connStart: number;
  /** Connector dashed-line end x. */
  connEnd: number;
}

const INVISIBLE: ReferenceLineLayout = {
  visible: false,
  y: -1,
  yBottom: -1,
  x1: 0,
  x2: 0,
  lineX1: 0,
  lineX2: 0,
  drawLine: false,
  label: "",
  labelX: 0,
  labelY: -1,
  offAxis: false,
  chevronUp: false,
  badge: false,
  pillX: 0,
  pillW: 0,
  iconX: -1,
  icon: "",
  chevronCx: -1,
  connStart: -1,
  connEnd: -1,
};

/** Off-axis indicator inset from the nearest plot edge, in px. */
const OFF_AXIS_EDGE_INSET = 12;

// Badge pill geometry (kept in sync with the overlay's pill height).
const BADGE_PAD_X = 6;
const BADGE_GAP = 4;
const BADGE_CHEV_W = 8;
/** Pill inset from the pinned plot edge, in px. */
const BADGE_EDGE_INSET = 2;
/** Vertical padding inside the pill (matches ReferenceLineOverlay's BADGE_PILL_PAD_Y). */
const BADGE_PILL_PAD_Y = 3;

interface BadgeGeometry {
  pillX: number;
  pillW: number;
  iconX: number;
  textX: number;
  chevronCx: number;
  connStart: number;
  connEnd: number;
}

/**
 * Lays out the badge pill at one plot edge: `[chevron?][icon?][text?]` left→right
 * inside the pill, with a dashed connector running to the opposite edge.
 */
function badgeGeometry(
  position: "left" | "right",
  icon: string,
  text: string,
  hasChevron: boolean,
  x1: number,
  x2: number,
  font: SkFont,
): BadgeGeometry {
  "worklet";
  // Measure the icon's visual bounds (not just width): `SkiaText` draws from the
  // pen origin, so the glyph's left side-bearing (`bounds.x`) must be subtracted
  // to land the ink in its slot. Without this an asymmetric glyph (a ▼ triangle,
  // a "+"/"−") sits off-center in an icon-only pill. Mirrors the action-badge
  // price-pill centering in computeActionBadgeLayout.
  const iconBounds = icon ? font.measureText(icon) : null;
  const iconW = iconBounds ? iconBounds.width : 0;
  const textW = text ? measureFontTextWidth(font, text) : 0;

  let contentW = 0;
  let count = 0;
  if (hasChevron) {
    contentW += BADGE_CHEV_W;
    count++;
  }
  if (icon) {
    contentW += iconW;
    count++;
  }
  if (text) {
    contentW += textW;
    count++;
  }
  contentW += BADGE_GAP * Math.max(0, count - 1);

  const pillW = contentW + BADGE_PAD_X * 2;
  const pillX =
    position === "right"
      ? x2 - BADGE_EDGE_INSET - pillW
      : x1 + BADGE_EDGE_INSET;

  let cursor = pillX + BADGE_PAD_X;
  let chevronCx = -1;
  if (hasChevron) {
    chevronCx = cursor + BADGE_CHEV_W / 2;
    cursor += BADGE_CHEV_W + BADGE_GAP;
  }
  let iconX = -1;
  if (icon) {
    // Pen origin compensates the left side-bearing so the ink starts at `cursor`
    // (and is centered in an icon-only pill, whose width is iconW + 2*padX).
    iconX = cursor - (iconBounds ? iconBounds.x : 0);
    cursor += iconW + BADGE_GAP;
  }
  const textX = text ? cursor : -1;

  let connStart = -1;
  let connEnd = -1;
  if (position === "right") {
    const end = pillX - 4;
    if (end > x1) {
      connStart = x1;
      connEnd = end;
    }
  } else {
    const start = pillX + pillW + 4;
    if (start < x2) {
      connStart = start;
      connEnd = x2;
    }
  }

  return { pillX, pillW, iconX, textX, chevronCx, connStart, connEnd };
}

/** Resolved badge text for a Form-A line (in-range tag or off-axis pin). */
function referenceBadgeText(
  line: ReferenceLine,
  badge: ReturnType<typeof resolveReferenceBadge> & object,
  v: number,
  formatValue: (value: number) => string,
  offAxis: boolean,
): string {
  "worklet";
  if (!badge.showText) return "";
  if (offAxis && badge.legacyText) {
    const word = line.offAxisBadgeLabel ?? line.label;
    return word ? `${word}: ${formatValue(v)}` : formatValue(v);
  }
  if (line.showValue && line.label) return `${line.label} ${formatValue(v)}`;
  return line.label ?? formatValue(v);
}

/** Axis-aligned screen rect of a reference-line badge pill (the press hit-target). */
export interface ReferenceBadgeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Screen-space pill rect for a Form-A reference line's **badge**, or `null` when
 * the line has no pressable badge (no `badge`/`offAxisBadge`, not a value line, a
 * legacy off-axis badge while in range, or the canvas isn't laid out / range is
 * degenerate). Shares `badgeGeometry` + the edge classification with
 * {@link useReferenceLine}, so the hit-target tracks the rendered pill exactly.
 * Pure worklet — used by {@link useReferenceLinePress} for tap hit-testing.
 */
export function computeReferenceBadgeRect(
  line: ReferenceLine,
  canvasWidth: number,
  canvasHeight: number,
  padding: ChartPadding,
  dMin: number,
  dMax: number,
  font: SkFont,
  formatValue: (value: number) => string,
): ReferenceBadgeRect | null {
  "worklet";
  const badge = resolveReferenceBadge(line);
  if (!badge) return null;
  if (referenceLineForm(line) !== "line" || line.value === undefined) return null;
  if (canvasWidth === 0 || canvasHeight === 0) return null;

  const chartTop = padding.top;
  const chartBottom = canvasHeight - padding.bottom;
  const chartH = chartBottom - chartTop;
  const valRange = dMax - dMin;
  if (chartH <= 0 || valRange <= 0) return null;

  const x1 = padding.left;
  const x2 = canvasWidth - padding.right;
  const v = line.value;
  const edge = classifyReferenceEdge(v, dMin, dMax);

  let y: number;
  let hasChevron: boolean;
  if (edge !== "in") {
    // Off-screen: pinned to the nearest edge with a chevron.
    hasChevron = true;
    y =
      edge === "above"
        ? chartTop + OFF_AXIS_EDGE_INSET
        : chartBottom - OFF_AXIS_EDGE_INSET;
  } else {
    // In range: a legacy off-axis-only badge shows no pill here → not pressable.
    if (!badge.inRange) return null;
    hasChevron = false;
    y = chartTop + ((dMax - v) / valRange) * chartH;
  }

  const text = referenceBadgeText(line, badge, v, formatValue, edge !== "in");
  const g = badgeGeometry(badge.position, badge.icon, text, hasChevron, x1, x2, font);
  const fm = font.getMetrics();
  const pillH = fm.descent - fm.ascent + BADGE_PILL_PAD_Y * 2;
  // The pill is vertically centered on the line's y (see ReferenceLineOverlay).
  return { x: g.pillX, y: y - pillH / 2, w: g.pillW, h: pillH };
}

/**
 * Derives screen-space layout for a single reference line or band. Supports all
 * three `ReferenceLine` forms (horizontal line, horizontal value band, vertical
 * time band) plus the pill badge for a Form-A value (in-range tag + off-screen
 * chevron pin).
 */
export function useReferenceLine(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  line: ReferenceLine | undefined,
  formatValue: (v: number) => string,
  font: SkFont,
): SharedValue<ReferenceLineLayout> {
  const form = line ? referenceLineForm(line) : "none";
  // Badge presentation depends only on the (stable) line props — resolve once.
  const badge = line ? resolveReferenceBadge(line) : null;

  return useDerivedValue<ReferenceLineLayout>(() => {
    if (!line || form === "none") return INVISIBLE;

    const w = engine.canvasWidth.value;
    const h = engine.canvasHeight.value;
    if (w === 0 || h === 0) return INVISIBLE;

    const chartTop = padding.top;
    const chartBottom = h - padding.bottom;
    const chartH = chartBottom - chartTop;
    const x1 = padding.left;
    const x2 = w - padding.right;
    // Full-width lines/bands run edge-to-edge through the gutters (0..canvas);
    // the badge/label anchor (x1/x2) stays at the plot edges either way.
    const fullWidth = line.fullWidth ?? false;
    const lineX1 = fullWidth ? 0 : x1;
    const lineX2 = fullWidth ? w : x2;

    const fm = font.getMetrics();
    const baselineOffset = (fm.ascent + fm.descent) / 2;

    // ── Form C — vertical time band (independent of the value range) ─────────
    if (form === "time-band") {
      if (line.from === undefined || line.to === undefined) return INVISIBLE;
      const now = engine.timestamp.value;
      const win = engine.displayWindow.value;
      const winStart = now - win;
      const chartW = x2 - x1;
      if (win <= 0 || chartW <= 0) return INVISIBLE;

      let bx1 = x1 + ((line.from - winStart) / win) * chartW;
      let bx2 = x1 + ((line.to - winStart) / win) * chartW;
      if (bx2 < bx1) {
        const t = bx1;
        bx1 = bx2;
        bx2 = t;
      }
      if (bx2 < x1 || bx1 > x2) return INVISIBLE;
      if (bx1 < x1) bx1 = x1;
      if (bx2 > x2) bx2 = x2;

      const label = line.label ?? "";
      const labelX =
        line.labelPosition === "right"
          ? bx2 - 4 - measureFontTextWidth(font, label)
          : bx1 + 4;
      return {
        ...INVISIBLE,
        visible: true,
        y: chartTop,
        yBottom: chartBottom,
        x1: bx1,
        x2: bx2,
        // Time band is vertical and time-bounded — full-width does not apply.
        lineX1: bx1,
        lineX2: bx2,
        label,
        labelX,
        labelY: chartTop - fm.ascent + 2,
      };
    }

    // Forms A / B project values onto y, so they need a non-degenerate range.
    const dMin = engine.displayMin.value;
    const dMax = engine.displayMax.value;
    const valRange = dMax - dMin;
    if (valRange <= 0) return INVISIBLE;
    const toY = (v: number) => chartTop + ((dMax - v) / valRange) * chartH;

    // ── Form B — horizontal value band ───────────────────────────────────────
    if (form === "value-band") {
      if (line.valueFrom === undefined || line.valueTo === undefined) {
        return INVISIBLE;
      }
      let yTop = toY(line.valueTo);
      let yBot = toY(line.valueFrom);
      if (yBot < yTop) {
        const t = yTop;
        yTop = yBot;
        yBot = t;
      }
      if (yBot < chartTop || yTop > chartBottom) return INVISIBLE;
      if (yTop < chartTop) yTop = chartTop;
      if (yBot > chartBottom) yBot = chartBottom;

      const label = line.label ?? "";
      const labelX =
        line.labelPosition === "right"
          ? x2 - 4 - measureFontTextWidth(font, label)
          : x1 + 4;
      return {
        ...INVISIBLE,
        visible: true,
        y: yTop,
        yBottom: yBot,
        x1,
        x2,
        lineX1,
        lineX2,
        label,
        labelX,
        labelY: yTop - fm.ascent + 2,
      };
    }

    // ── Form A — horizontal line (with optional pill badge) ──────────────────
    if (line.value === undefined) return INVISIBLE;
    const v = line.value;
    const edge = classifyReferenceEdge(v, dMin, dMax);

    // Off-screen: pin the badge to the nearest edge with a chevron (when a badge
    // is configured); otherwise cull the off-screen line (legacy behavior).
    if (edge !== "in") {
      if (!badge) return INVISIBLE;
      const above = edge === "above";
      const clampedY = above
        ? chartTop + OFF_AXIS_EDGE_INSET
        : chartBottom - OFF_AXIS_EDGE_INSET;
      const text = referenceBadgeText(line, badge, v, formatValue, true);
      const g = badgeGeometry(badge.position, badge.icon, text, true, x1, x2, font);
      return {
        ...INVISIBLE,
        visible: true,
        y: clampedY,
        yBottom: clampedY,
        x1,
        x2,
        label: text,
        labelX: g.textX,
        labelY: clampedY - baselineOffset,
        offAxis: true,
        chevronUp: above,
        badge: true,
        pillX: g.pillX,
        pillW: g.pillW,
        iconX: g.iconX,
        icon: badge.icon,
        chevronCx: g.chevronCx,
        connStart: g.connStart,
        connEnd: g.connEnd,
      };
    }

    const y = toY(v);

    // In-range pill badge (the `badge` config, not the legacy off-axis-only flag).
    if (badge && badge.inRange) {
      const text = referenceBadgeText(line, badge, v, formatValue, false);
      const g = badgeGeometry(badge.position, badge.icon, text, false, x1, x2, font);
      return {
        ...INVISIBLE,
        visible: true,
        y,
        yBottom: y,
        x1,
        x2,
        lineX1,
        lineX2,
        // Full-width: the edge-to-edge line replaces the dashed connector.
        drawLine: fullWidth,
        label: text,
        labelX: g.textX,
        labelY: y - baselineOffset,
        badge: true,
        pillX: g.pillX,
        pillW: g.pillW,
        iconX: g.iconX,
        icon: badge.icon,
        connStart: fullWidth ? -1 : g.connStart,
        connEnd: fullWidth ? -1 : g.connEnd,
      };
    }

    // Plain gutter label (no badge, or a legacy off-axis badge that's in range).
    let label = line.label ?? formatValue(v);
    if (line.showValue && line.label) label = `${line.label} ${formatValue(v)}`;

    const pos = line.labelPosition ?? "right";
    let labelX: number;
    if (pos === "left") labelX = x1 + 4;
    else if (pos === "center")
      labelX = (x1 + x2) / 2 - measureFontTextWidth(font, label) / 2;
    else labelX = x2 + 4; // "right" — legacy gutter position

    return {
      ...INVISIBLE,
      visible: true,
      y,
      yBottom: y,
      x1,
      x2,
      lineX1,
      lineX2,
      drawLine: true,
      label,
      labelX,
      labelY: y - baselineOffset,
    };
  });
}
