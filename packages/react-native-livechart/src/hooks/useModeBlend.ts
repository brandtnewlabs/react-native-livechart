import { useEffect } from "react";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

export const MODE_BLEND_DURATION_MS = 300;

export interface ModeBlendState {
  /** 0 = fully line, 1 = fully candle */
  modeBlend: SharedValue<number>;
  /** line opacity = reveal.lineOpacity * (1 - modeBlend) */
  lineGroupOpacity: SharedValue<number>;
  /** candle opacity = reveal.lineOpacity * modeBlend */
  candleGroupOpacity: SharedValue<number>;
}

/**
 * Animated crossfade between line and candle chart layers.
 *
 * `modeBlend` animates 0→1 when `isCandle` becomes true, 1→0 when false.
 * The derived opacities multiply by `lineOpacity` from `useChartReveal`
 * so the reveal and mode-switch animations compose correctly.
 */
export function useModeBlend(
  isCandle: boolean,
  lineOpacity: SharedValue<number>,
  /** Crossfade duration (ms). Default {@link MODE_BLEND_DURATION_MS}; `0` snaps. */
  duration: number = MODE_BLEND_DURATION_MS,
): ModeBlendState {
  const modeBlend = useSharedValue(isCandle ? 1 : 0);

  useEffect(() => {
    modeBlend.set(
      withTiming(isCandle ? 1 : 0, {
        duration,
        easing: Easing.inOut(Easing.ease),
      }),
    );
  }, [isCandle, modeBlend, duration]);

  const lineGroupOpacity = useDerivedValue(
    () => lineOpacity.get() * (1 - modeBlend.get()),
  );

  const candleGroupOpacity = useDerivedValue(
    () => lineOpacity.get() * modeBlend.get(),
  );

  return { modeBlend, lineGroupOpacity, candleGroupOpacity };
}
