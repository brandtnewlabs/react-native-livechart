import { MAX_MULTI_SERIES } from "../constants";
import { SERIES_COLORS } from "../theme";
import type { SeriesConfig } from "../types";

/** Stable signature when series id/color change (not every data tick). */
export function lineColorsSignatureFromArray(arr: SeriesConfig[]): string {
  "worklet";
  // U+001F (unit separator) and U+001E (record separator) are ASCII control
  // chars that will never appear in series IDs or color strings.
  // No Array#map — iterator callbacks are not worklets on the UI runtime.
  let out = "";
  for (let i = 0; i < arr.length; i++) {
    if (i > 0) out += "\x1e";
    const x = arr[i];
    out += `${x.id}\x1f${x.color ?? ""}`;
  }
  return out;
}

/** Per-slot stroke colors for chips + Skia (empty slots → white). */
export function resolveMultiSeriesLineColorsSnapshot(
  arr: SeriesConfig[],
  maxSlots = MAX_MULTI_SERIES,
): string[] {
  return Array.from({ length: maxSlots }, (_, i) =>
    i < arr.length
      ? (arr[i].color ?? SERIES_COLORS[i % SERIES_COLORS.length])
      : "#ffffff",
  );
}

/** Per-series visual stroke style resolved for one render slot. */
export interface SeriesLineStyle {
  /** Per-series stroke width override, or `undefined` to use the chart default. */
  strokeWidth: number | undefined;
  dashed: boolean;
  intervals: [number, number];
  glow: boolean;
}

const DEFAULT_LINE_STYLE: SeriesLineStyle = {
  strokeWidth: undefined,
  dashed: false,
  intervals: [6, 4],
  glow: false,
};

/**
 * Stable signature over the per-series style fields (style / intervals /
 * strokeWidth / glow), so a snapshot re-sync fires when styling changes but not
 * on every data tick.
 */
export function lineStyleSignatureFromArray(arr: SeriesConfig[]): string {
  "worklet";
  let out = "";
  for (let i = 0; i < arr.length; i++) {
    if (i > 0) out += "\x1e";
    const x = arr[i];
    const iv = x.intervals ? `${x.intervals[0]},${x.intervals[1]}` : "";
    out += `${x.id}\x1f${x.style ?? ""}\x1f${x.strokeWidth ?? ""}\x1f${x.glow ? 1 : 0}\x1f${iv}`;
  }
  return out;
}

/** Per-slot resolved stroke style for Skia (empty slots → defaults). */
export function resolveMultiSeriesLineStylesSnapshot(
  arr: SeriesConfig[],
  maxSlots = MAX_MULTI_SERIES,
): SeriesLineStyle[] {
  return Array.from({ length: maxSlots }, (_, i) => {
    const s = arr[i];
    if (!s) return DEFAULT_LINE_STYLE;
    return {
      strokeWidth: s.strokeWidth,
      dashed: s.style === "dashed",
      intervals: s.intervals ?? DEFAULT_LINE_STYLE.intervals,
      glow: s.glow ?? false,
    };
  });
}
