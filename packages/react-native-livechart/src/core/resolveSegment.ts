import type { ChartSegment } from "../types";

/**
 * A {@link ChartSegment} with every styling field resolved to a concrete value.
 * `from`/`to` stay optional — `undefined` means "extend to the plot edge" and is
 * handled by the band projection (see `segmentBandX`).
 */
export interface ResolvedSegment {
  from?: number;
  to?: number;
  color: string;
  opacity: number;
  highlightColor: string;
  highlightOpacity: number;
  recolorLine: boolean;
  /** Solid line-tint color (already defaulted to `color`). */
  lineColor: string;
  /** Optional ≥2-color gradient for the recolored line; takes precedence over `lineColor`. */
  lineColors?: string[];
  active: boolean;
  divider: boolean;
  /** Divider color (already defaulted to `color`). */
  dividerColor: string;
  label?: string;
  labelPosition: "left" | "right";
}

/** Resting band opacity when a segment isn't highlighted. */
const DEFAULT_OPACITY = 0.06;
/** Band opacity when a segment is highlighted (hover or `active`). */
const DEFAULT_HIGHLIGHT_OPACITY = 0.16;

/**
 * Normalize a user-facing {@link ChartSegment} into a fully-resolved segment with
 * defaults filled in. Every color falls back to the band `color`, which itself
 * defaults to the chart accent color. Pure — called once per segment at render
 * time, not per frame.
 */
export function resolveSegment(
  seg: ChartSegment,
  accentColor: string,
): ResolvedSegment {
  const color = seg.color ?? accentColor;
  return {
    from: seg.from,
    to: seg.to,
    color,
    opacity: seg.opacity ?? DEFAULT_OPACITY,
    highlightColor: seg.highlightColor ?? color,
    highlightOpacity: seg.highlightOpacity ?? DEFAULT_HIGHLIGHT_OPACITY,
    recolorLine: seg.recolorLine ?? true,
    lineColor: seg.lineColor ?? color,
    lineColors:
      seg.lineColors && seg.lineColors.length >= 2 ? seg.lineColors : undefined,
    active: seg.active ?? false,
    divider: seg.divider ?? false,
    dividerColor: seg.dividerColor ?? color,
    label: seg.label,
    labelPosition: seg.labelPosition ?? "left",
  };
}
