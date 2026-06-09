import type { ChartSegment } from "../types";

/**
 * A {@link ChartSegment} with every styling field resolved to a concrete value.
 * `from`/`to` stay optional — `undefined` means "extend to the plot edge" and is
 * handled by the band projection (see `segmentBandX`).
 */
export interface ResolvedSegment {
  from?: number;
  to?: number;
  /** Base color — the default for `mutedColor`, `dividerColor`, and the label. */
  color: string;
  recolorLine: boolean;
  /** Solid line-tint color (already defaulted to `color`). */
  mutedColor: string;
  /** Optional ≥2-color gradient for the recolored line; takes precedence over `mutedColor`. */
  mutedColors?: string[];
  active: boolean;
  divider: boolean;
  /** Divider color (already defaulted to `color`). */
  dividerColor: string;
  label?: string;
  labelPosition: "left" | "right";
}

/**
 * Normalize a user-facing {@link ChartSegment} into a fully-resolved segment with
 * defaults filled in. Every color falls back to `color`, which itself defaults to
 * the chart accent color. Pure — called once per segment at render time, not per
 * frame.
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
    recolorLine: seg.recolorLine ?? true,
    mutedColor: seg.mutedColor ?? color,
    mutedColors:
      seg.mutedColors && seg.mutedColors.length >= 2 ? seg.mutedColors : undefined,
    active: seg.active ?? false,
    divider: seg.divider ?? false,
    dividerColor: seg.dividerColor ?? color,
    label: seg.label,
    labelPosition: seg.labelPosition ?? "left",
  };
}
