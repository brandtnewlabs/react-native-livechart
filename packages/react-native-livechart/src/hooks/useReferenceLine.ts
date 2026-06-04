import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { SkFont } from "@shopify/react-native-skia";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import {
  classifyReferenceEdge,
  referenceLineForm,
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
  /** Resolved label text (with appended value when `showValue`). */
  label: string;
  labelX: number;
  labelY: number;
  /** True when a Form-A line is off-screen and its off-axis badge is showing. */
  offAxis: boolean;
  /** Off-axis chevron points up (target above range) vs down (below). */
  chevronUp: boolean;
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
};

/** Off-axis indicator inset from the nearest plot edge, in px. */
const OFF_AXIS_EDGE_INSET = 12;

/**
 * Derives screen-space layout for a single reference line or band. Supports all
 * three `ReferenceLine` forms (horizontal line, horizontal value band, vertical
 * time band) plus the off-axis badge for an off-screen Form-A value.
 */
export function useReferenceLine(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  line: ReferenceLine | undefined,
  formatValue: (v: number) => string,
  font: SkFont,
): SharedValue<ReferenceLineLayout> {
  const form = line ? referenceLineForm(line) : "none";

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
        visible: true,
        y: chartTop,
        yBottom: chartBottom,
        x1: bx1,
        x2: bx2,
        label,
        labelX,
        labelY: chartTop - fm.ascent + 2,
        offAxis: false,
        chevronUp: false,
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
        visible: true,
        y: yTop,
        yBottom: yBot,
        x1,
        x2,
        label,
        labelX,
        labelY: yTop - fm.ascent + 2,
        offAxis: false,
        chevronUp: false,
      };
    }

    // ── Form A — horizontal line (with optional off-axis badge) ──────────────
    if (line.value === undefined) return INVISIBLE;
    const v = line.value;
    const edge = classifyReferenceEdge(v, dMin, dMax);

    if (edge !== "in") {
      if (!line.offAxisBadge) return INVISIBLE; // legacy: cull off-screen line
      const above = edge === "above";
      const clampedY = above
        ? chartTop + OFF_AXIS_EDGE_INSET
        : chartBottom - OFF_AXIS_EDGE_INSET;
      const word = line.offAxisBadgeLabel ?? line.label;
      const text = word ? `${word}: ${formatValue(v)}` : formatValue(v);
      return {
        visible: true,
        y: clampedY,
        yBottom: clampedY,
        x1,
        x2,
        label: text,
        labelX: x1 + 16,
        labelY: clampedY - baselineOffset,
        offAxis: true,
        chevronUp: above,
      };
    }

    const y = toY(v);
    let label = line.label ?? formatValue(v);
    if (line.showValue && line.label) label = `${line.label} ${formatValue(v)}`;

    const pos = line.labelPosition ?? "right";
    let labelX: number;
    if (pos === "left") labelX = x1 + 4;
    else if (pos === "center")
      labelX = (x1 + x2) / 2 - measureFontTextWidth(font, label) / 2;
    else labelX = x2 + 4; // "right" — legacy gutter position

    return {
      visible: true,
      y,
      yBottom: y,
      x1,
      x2,
      label,
      labelX,
      labelY: y - baselineOffset,
      offAxis: false,
      chevronUp: false,
    };
  });
}
