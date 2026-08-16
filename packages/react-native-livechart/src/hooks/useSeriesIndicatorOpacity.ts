import {
  Easing,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/** Short independent fade used when replacement data dims the plotted series. */
export const SERIES_INDICATOR_FADE_MS = 180;

/** Treat tiny animation residue at the top end as fully restored. */
const SERIES_OPACITY_VISIBLE_EPSILON = 0.001;

/** Worklet-safe target for live dots and their pulse rings. */
export function seriesIndicatorOpacityTarget(seriesOpacity: number): 0 | 1 {
  "worklet";
  return seriesOpacity >= 1 - SERIES_OPACITY_VISIBLE_EPSILON ? 1 : 0;
}

/**
 * Fades live dots and pulse rings away while `seriesOpacity` dims replacement
 * data, then restores them once the plotted series is fully opaque again.
 * Keeping this as a separate opacity avoids compositing a translucent dot over
 * its own line, where the stroke would otherwise shine through.
 */
export function useSeriesIndicatorOpacity(
  seriesOpacity: SharedValue<number>,
  duration: number = SERIES_INDICATOR_FADE_MS,
): SharedValue<number> {
  // Fully visible is the common mount state. The reaction snaps an initially
  // dimmed series to 0 on its first UI-thread run so it never flashes a dot.
  const opacity = useSharedValue(1);

  useAnimatedReaction(
    () => seriesIndicatorOpacityTarget(seriesOpacity.get()),
    (target, previous) => {
      "worklet";
      if (previous === null || previous === undefined || duration === 0) {
        opacity.set(target);
        return;
      }
      if (target !== previous) {
        opacity.set(
          withTiming(target, {
            duration,
            easing: Easing.inOut(Easing.ease),
          }),
        );
      }
    },
    [seriesOpacity, duration],
  );

  return opacity;
}
