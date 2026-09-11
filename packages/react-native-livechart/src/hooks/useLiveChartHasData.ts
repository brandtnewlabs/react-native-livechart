import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import {
  hasCandleChartData,
  hasLineChartData,
} from "../core/chartDataPresence";
import type { CandlePoint, LiveChartPoint } from "../types";

/**
 * Data presence for {@link LiveChart}: line mode needs ≥1 point;
 * candle mode needs ≥1 committed candle (`liveCandle` alone does not count).
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
      return hasCandleChartData(candles?.value);
    }
    return hasLineChartData(data.value);
  });

  return { hasData };
}
