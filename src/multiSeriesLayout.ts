import type { LivelineSeries } from "./types";
import { MAX_MULTI_SERIES } from "./constants";
import { SERIES_COLORS } from "./theme";

/** Stable signature when series id/color change (not every data tick). */
export function lineColorsSignatureFromArray(arr: LivelineSeries[]): string {
  "worklet";
  return arr.map((x) => `${x.id}\x1f${x.color ?? ""}`).join("\x1e");
}

/** Per-slot stroke colors for chips + Skia (empty slots → white). */
export function resolveMultiSeriesLineColorsSnapshot(
  arr: LivelineSeries[],
  maxSlots = MAX_MULTI_SERIES,
): string[] {
  return Array.from({ length: maxSlots }, (_, i) =>
    i < arr.length
      ? (arr[i].color ?? SERIES_COLORS[i % SERIES_COLORS.length])
      : "#ffffff",
  );
}
