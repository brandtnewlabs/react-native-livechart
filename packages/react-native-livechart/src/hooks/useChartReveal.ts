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
  /** Static charts skip the entry ramp: morphT snaps to its target, no `withTiming`. */
  isStatic = false,
  /** Reveal/collapse duration (ms). Default {@link CHART_REVEAL_DURATION_MS}; `0` snaps. */
  revealDuration: number = CHART_REVEAL_DURATION_MS,
): ChartRevealState {
  // Best-guess initial so the common case — a live chart that already has data
  // and isn't loading — paints fully revealed with no flash. The reaction below
  // snaps it to the exact state on its first run.
  const morphT = useSharedValue(loading ? 0 : 1);
  const isLoading = useSharedValue(loading);

  useLayoutEffect(() => {
    isLoading.set(loading);
  }, [loading, isLoading]);

  // The reaction reads presence/loading on the UI thread (a worklet, never during
  // render — so no Reanimated "reading `value` during render" warning), seeds the
  // exact reveal state on its first run, then animates on later changes. Static
  // charts always snap (no `withTiming` ramp) so no entry animation ever runs.
  useAnimatedReaction(
    () => !isLoading.get() && hasData.get(),
    (chartVisible, prev) => {
      "worklet";
      if (isStatic || prev === null || prev === undefined) {
        // Static, or first run: snap to the correct reveal state (no animation).
        morphT.set(chartVisible ? 1 : 0);
        return;
      }
      if (prev !== chartVisible) {
        // 0ms → withTiming resolves on the next frame (effectively a snap), so an
        // explicit `transitions={{ reveal: 0 }}` / `transitions={false}` removes
        // the grow-in without a special-case branch.
        morphT.set(
          withTiming(chartVisible ? 1 : 0, {
            duration: revealDuration,
            easing: Easing.out(Easing.cubic),
          }),
        );
      }
    },
    [hasData, isStatic, revealDuration],
  );

  const isEmpty = useDerivedValue(() => !isLoading.get() && !hasData.get());

  const yAxisOpacity = useDerivedValue(() =>
    revealRamp(morphT.get(), DELAY.yAxis),
  );
  const fillOpacity = useDerivedValue(() =>
    revealRamp(morphT.get(), DELAY.fill),
  );
  const lineOpacity = useDerivedValue(() =>
    revealRamp(morphT.get(), DELAY.line),
  );
  const dotOpacity = useDerivedValue(() => revealRamp(morphT.get(), DELAY.dot));
  const badgeOpacity = useDerivedValue(() =>
    revealRamp(morphT.get(), DELAY.badge),
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
