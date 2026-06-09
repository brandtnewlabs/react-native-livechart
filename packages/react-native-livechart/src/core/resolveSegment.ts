import type { ChartSegment } from "../types";

/**
 * A {@link ChartSegment} with every styling field resolved to a concrete value.
 * `from`/`to` stay optional — `undefined` means "extend to the plot edge" and is
 * handled by the band projection (see `segmentBandX`).
 */
export interface ResolvedSegment {
  from?: number;
  to?: number;
  recolorLine: boolean;
  /** De-emphasis line color (already defaulted to the chart's muted palette color). */
  mutedColor: string;
  /** Optional ≥2-color gradient for the de-emphasized line; takes precedence over `mutedColor`. */
  mutedColors?: string[];
  active: boolean;
  divider: boolean;
  /** Divider stroke color (already defaulted to the chart's reference-line color). */
  dividerColor: string;
  label?: string;
  /** Label text color (the chart's reference-label palette color). */
  labelColor: string;
  labelPosition: "left" | "right";
}

/**
 * Palette-derived color defaults for a segment, supplied by the chart so segments
 * inherit the chart's color system instead of carrying their own base color.
 */
export interface SegmentColorDefaults {
  /** De-emphasis line color when `mutedColor`/`mutedColors` are unset. */
  muted: string;
  /** Divider stroke color when `dividerColor` is unset. */
  divider: string;
  /** Label text color. */
  label: string;
}

/**
 * Normalize a user-facing {@link ChartSegment} into a fully-resolved segment.
 * Colors fall back to the chart's palette (`defaults`) — a segment never needs its
 * own base color. Pure — called once per segment at render time, not per frame.
 */
export function resolveSegment(
  seg: ChartSegment,
  defaults: SegmentColorDefaults,
): ResolvedSegment {
  return {
    from: seg.from,
    to: seg.to,
    recolorLine: seg.recolorLine ?? true,
    mutedColor: seg.mutedColor ?? defaults.muted,
    mutedColors:
      seg.mutedColors && seg.mutedColors.length >= 2 ? seg.mutedColors : undefined,
    active: seg.active ?? false,
    divider: seg.divider ?? false,
    dividerColor: seg.dividerColor ?? defaults.divider,
    label: seg.label,
    labelColor: defaults.label,
    labelPosition: seg.labelPosition ?? "left",
  };
}
