import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { CandlePoint, LiveChartPoint } from "../types";

/**
 * Data presence for {@link LiveChart}: line mode needs ≥2 points;
 * candle mode needs ≥2 committed candles (`liveCandle` alone does not count).
 *
 * {@link useChartReveal} seeds its first-paint state off `hasData` directly (in a
 * layout effect), so no JS-thread snapshot is read during render here.
 */
export function useLiveChartHasData({
  isCandle,
  data,
  candles,
}: {
  isCandle: boolean;
  data: SharedValue<LiveChartPoint[]>;
  candles: SharedValue<CandlePoint[]> | undefined;
}): {
  hasData: SharedValue<boolean>;
} {
  const hasData = useDerivedValue(() => {
    "worklet";
    if (isCandle) {
      return (candles?.value.length ?? 0) >= 2;
    }
    return data.value.length >= 2;
  });

  return { hasData };
}
