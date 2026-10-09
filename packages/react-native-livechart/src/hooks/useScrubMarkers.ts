import {
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import type { ResolvedScrubConfig } from "../core/resolveConfig";
import { matchScrubMarkers, scrubMarkerRange } from "../math/scrubMarkers";
import type { CandlePoint, ChartGap, Marker } from "../types";

export interface ScrubMarkerOptions {
  markers: SharedValue<Marker[]>;
  radius: number;
}

/** Adapt resolved config for both crosshair hooks. */
export function resolveScrubMarkerOptions(
  config: ResolvedScrubConfig | null,
  markers: SharedValue<Marker[]>,
): ScrubMarkerOptions | undefined {
  if (!config?.markers) return undefined;
  return { markers, radius: config.markers.radius };
}

/** Selection changes notify tooltip consumers; movement within a match does not. */
export function useScrubMarkers(
  options: ScrubMarkerOptions | undefined,
  active: SharedValue<boolean>,
  time: SharedValue<number>,
  now: SharedValue<number>,
  window: SharedValue<number>,
  canvasWidth: SharedValue<number>,
  horizontalPadding: number,
  candleMode = false,
  candle?: SharedValue<CandlePoint | null>,
  candleWidth = 60,
  gap?: SharedValue<ChartGap | null>,
): SharedValue<Marker[]> {
  const source = useSharedValue<Marker[]>([]);
  const selected = useSharedValue<Marker[]>([]);
  // A fresh shallow snapshot also detects .modify() edits where the caller
  // retains the input array/objects. No metadata serialization or frame loop.
  useAnimatedReaction(
    () => options?.markers.get(),
    (markers) => {
      source.set(markers ? markers.slice() : []);
    },
  );
  useAnimatedReaction(
    () => {
      if (!options || !active.get() || gap?.get()) return null;
      return {
        markers: source.get(),
        range: scrubMarkerRange(
          time.get(),
          now.get(),
          window.get(),
          canvasWidth.get() - horizontalPadding,
          options.radius,
          candleMode,
          candle?.get()?.time ?? null,
          candleWidth,
        ),
      };
    },
    (input, previous) => {
      const next = input ? matchScrubMarkers(input.markers, input.range) : [];
      const current = selected.get();
      // Refresh metadata when the input changes, but retain the result array
      // through chart ticks / movement that select the same markers.
      if (
        next.length === current.length &&
        (next.length === 0 || input?.markers === previous?.markers) &&
        next.every((marker, index) => marker === current[index])
      ) return;
      selected.set(next);
    },
  );
  return selected;
}
