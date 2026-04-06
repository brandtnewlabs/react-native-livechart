import { useLayoutEffect } from "react";
import {
  Easing,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { smoothstep } from "../math/squiggly";

/** Duration for chart reveal (loading/empty → live) and collapse (live → empty). */
export const CHART_REVEAL_DURATION_MS = 600;

/**
 * Per-overlay reveal delay (fraction of morphT at which the overlay starts
 * fading in). Earlier delays = earlier appearance.
 */
const DELAY = {
  fill: 0.05,
  yAxis: 0.15,
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
  /** 0 = loading/empty shell, 1 = fully live chart (matches web chartReveal). */
  morphT: SharedValue<number>;
  /** True while loading=true */
  isLoading: SharedValue<boolean>;
  /** True when not loading and fewer than two samples. */
  isEmpty: SharedValue<boolean>;
  yAxisOpacity: SharedValue<number>;
  fillOpacity: SharedValue<number>;
  lineOpacity: SharedValue<number>;
  dotOpacity: SharedValue<number>;
  badgeOpacity: SharedValue<number>;
}

/**
 * Drives loading / empty / live visibility.
 *
 * Chart is fully revealed only when `!loading && hasData`. `morphT` animates
 * between 0 and 1 when that condition changes. `isEmpty` is derived as
 * `!loading && !hasData` for the empty overlay label.
 */
export function useChartReveal(
  loading: boolean,
  hasData: SharedValue<boolean>,
  initialMorphT: number,
): ChartRevealState {
  const morphT = useSharedValue(initialMorphT);
  const isLoading = useSharedValue(loading);

  useLayoutEffect(() => {
    isLoading.value = loading;
  }, [loading, isLoading]);

  useAnimatedReaction(
    () => !isLoading.value && hasData.value,
    (chartVisible, prev) => {
      "worklet";
      if (prev === undefined) {
        return;
      }
      if (prev !== chartVisible) {
        morphT.value = withTiming(chartVisible ? 1 : 0, {
          duration: CHART_REVEAL_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
    },
    [hasData],
  );

  const isEmpty = useDerivedValue(() => !isLoading.value && !hasData.value);

  const yAxisOpacity = useDerivedValue(() =>
    revealRamp(morphT.value, DELAY.yAxis),
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
    // useDerivedValue is SharedValue-compatible for `.value` reads in Skia.
    isEmpty: isEmpty as unknown as SharedValue<boolean>,
    yAxisOpacity,
    fillOpacity,
    lineOpacity,
    dotOpacity,
    badgeOpacity,
  };
}
