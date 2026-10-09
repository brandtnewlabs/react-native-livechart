import type { Marker } from "../types";

export interface ScrubMarkerRange {
  from: number;
  to: number;
  /** Candle buckets are [start, end); line proximity includes both edges. */
  exclusiveEnd: boolean;
}

/** Timestamp matching deliberately ignores glyph offsets, Y, and clustering. */
export function matchScrubMarkers(
  markers: Marker[],
  range: ScrubMarkerRange | null,
): Marker[] {
  "worklet";
  if (!range) return [];
  return markers.filter(
    (marker) => marker.time >= range.from &&
      (range.exclusiveEnd ? marker.time < range.to : marker.time <= range.to),
  );
}

/** Convert a horizontal touch tolerance to time using the drawn viewport. */
export function scrubMarkerRange(
  time: number,
  now: number,
  window: number,
  plotWidth: number,
  radius: number,
  candleMode: boolean,
  candleTime: number | null,
  candleWidth: number,
): ScrubMarkerRange | null {
  "worklet";
  if (
    !Number.isFinite(time) || time < 0 || !Number.isFinite(now) ||
    !Number.isFinite(window) || window <= 0 ||
    !Number.isFinite(plotWidth) || plotWidth <= 0
  ) return null;
  if (candleMode) {
    if (
      candleTime === null || !Number.isFinite(candleTime) ||
      !Number.isFinite(candleWidth) || candleWidth <= 0
    ) return null;
    return { from: candleTime, to: candleTime + candleWidth, exclusiveEnd: true };
  }
  const start = now - window;
  if (time < start || time > now) return null;
  const tolerance = radius * window / plotWidth;
  return {
    from: Math.max(start, time - tolerance),
    to: Math.min(now, time + tolerance),
    exclusiveEnd: false,
  };
}
