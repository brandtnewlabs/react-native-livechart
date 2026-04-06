import { useRef } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { CandlePoint, LiveChartPoint } from "../types";

/**
 * Data presence for {@link LiveChart}: line mode needs ≥2 points;
 * candle mode needs ≥2 committed candles (`liveCandle` alone does not count).
 *
 * Also returns a one-shot `initialMorphT` for {@link useChartReveal} first paint
 * (reads shared values once on mount — same tradeoff as inline LiveChart).
 */
export function useLiveChartHasData({
  isCandle,
  data,
  candles,
  loading,
}: {
  isCandle: boolean;
  data: SharedValue<LiveChartPoint[]>;
  candles: SharedValue<CandlePoint[]> | undefined;
  loading: boolean;
}): {
  hasData: SharedValue<boolean>;
  initialMorphT: number;
} {
  const hasData = useDerivedValue(() => {
    "worklet";
    if (isCandle) {
      return (candles?.value.length ?? 0) >= 2;
    }
    return data.value.length >= 2;
  });

  const morphInitRef = useRef<number | null>(null);
  if (morphInitRef.current === null) {
    const initialHas = isCandle
      ? (candles?.value.length ?? 0) >= 2
      : data.value.length >= 2;
    morphInitRef.current = loading ? 0 : initialHas ? 1 : 0;
  }

  return { hasData, initialMorphT: morphInitRef.current };
}
