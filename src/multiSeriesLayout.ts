import { MAX_MULTI_SERIES } from "./constants";
import { SERIES_COLORS } from "./theme";
import type { SeriesConfig } from "./types";

/** Stable signature when series id/color change (not every data tick). */
export function lineColorsSignatureFromArray(arr: SeriesConfig[]): string {
  "worklet";
  // U+001F (unit separator) and U+001E (record separator) are ASCII control
  // chars that will never appear in series IDs or color strings.
  return arr.map((x) => `${x.id}\x1f${x.color ?? ""}`).join("\x1e");
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
