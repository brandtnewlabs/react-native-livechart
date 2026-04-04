import { useEffect } from "react";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { smoothstep } from "../math/squiggly";

const REVEAL_DURATION_MS = 600;

/**
 * Per-overlay reveal delay (fraction of morphT at which the overlay starts
 * fading in). Earlier delays = earlier appearance.
 */
const DELAY = {
  fill: 0.05,
  grid: 0.15,
  line: 0.0,
  dot: 0.4,
  badge: 0.55,
} as const;

/**
 * Maps a [0,1] morphT to a [0,1] opacity, starting at `delay` and reaching
 * 1 at morphT=1. Uses smoothstep for a polished ease-in/out.
 */
export function revealRamp(morphT: number, delay: number): number {
  "worklet";
  if (delay >= 1) return 0;
  return smoothstep((morphT - delay) / (1 - delay));
}

export interface ChartRevealState {
  /** 0 = fully squiggly (loading), 1 = fully live chart */
  morphT: SharedValue<number>;
  /** True while loading=true */
  isLoading: SharedValue<boolean>;
  /** True when loading=false but no data (set externally via isEmpty.value) */
  isEmpty: SharedValue<boolean>;
  gridOpacity: SharedValue<number>;
  fillOpacity: SharedValue<number>;
  lineOpacity: SharedValue<number>;
  dotOpacity: SharedValue<number>;
  badgeOpacity: SharedValue<number>;
}

/**
 * Drives the loading → reveal → live state machine.
 *
 * - When `loading` is true: morphT=0, overlays hidden, LoadingOverlay visible.
 * - When `loading` becomes false: animate morphT 0→1 over 600ms; each overlay
 *   fades in staggered via revealRamp.
 * - When `loading` was never true (default): morphT starts at 1, no animation.
 *
 * NOTE: The empty state (isEmpty) is NOT auto-detected from data length here,
 * because SharedValue changes do not trigger React re-renders. Instead, set
 * isEmpty.value directly from a useAnimatedReaction in the parent, or simply
 * pass loading=true until data is ready.
 */
export function useChartReveal(loading: boolean): ChartRevealState {
  // Start fully revealed if loading was never requested
  const morphT = useSharedValue(loading ? 0 : 1);
  const isLoading = useSharedValue(loading);
  const isEmpty = useSharedValue(false);

  useEffect(() => {
    if (loading) {
      morphT.value = 0;
      isLoading.value = true;
      isEmpty.value = false;
    } else {
      isLoading.value = false;
      // Animate reveal only if we were in loading state (morphT < 1)
      if (morphT.value < 1) {
        morphT.value = withTiming(1, {
          duration: REVEAL_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const gridOpacity = useDerivedValue(() =>
    revealRamp(morphT.value, DELAY.grid),
  );
  const fillOpacity = useDerivedValue(() =>
    revealRamp(morphT.value, DELAY.fill),
  );
  const lineOpacity = useDerivedValue(() =>
    revealRamp(morphT.value, DELAY.line),
  );
  const dotOpacity = useDerivedValue(() => revealRamp(morphT.value, DELAY.dot));
  const badgeOpacity = useDerivedValue(() =>
    revealRamp(morphT.value, DELAY.badge),
  );

  return {
    morphT,
    isLoading,
    isEmpty,
    gridOpacity,
    fillOpacity,
    lineOpacity,
    dotOpacity,
    badgeOpacity,
  };
}
