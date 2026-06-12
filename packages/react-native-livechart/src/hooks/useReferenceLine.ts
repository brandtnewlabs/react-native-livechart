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
  /** Left x extent. */
  x1: number;
  /** Right x extent. */
  x2: number;
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
  const iconW = icon ? measureFontTextWidth(font, icon) : 0;
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
    iconX = cursor;
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
      let text = "";
      if (badge.showText) {
        if (badge.legacyText) {
          const word = line.offAxisBadgeLabel ?? line.label;
          text = word ? `${word}: ${formatValue(v)}` : formatValue(v);
        } else {
          text = line.label ?? formatValue(v);
          if (line.showValue && line.label) {
            text = `${line.label} ${formatValue(v)}`;
          }
        }
      }
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
      let text = "";
      if (badge.showText) {
        text = line.label ?? formatValue(v);
        if (line.showValue && line.label) {
          text = `${line.label} ${formatValue(v)}`;
        }
      }
      const g = badgeGeometry(badge.position, badge.icon, text, false, x1, x2, font);
      return {
        ...INVISIBLE,
        visible: true,
        y,
        yBottom: y,
        x1,
        x2,
        label: text,
        labelX: g.textX,
        labelY: y - baselineOffset,
        badge: true,
        pillX: g.pillX,
        pillW: g.pillW,
        iconX: g.iconX,
        icon: badge.icon,
        connStart: g.connStart,
        connEnd: g.connEnd,
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
      label,
      labelX,
      labelY: y - baselineOffset,
    };
  });
}
