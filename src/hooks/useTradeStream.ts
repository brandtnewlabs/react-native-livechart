import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import type { ChartPadding } from "../draw/line";
import {
  createTradeStreamState,
  projectLabels,
  tickTradeStream,
  type TradeMarker,
  type TradeStreamState,
} from "../draw/trade";
import type { TradeEvent } from "../types";
import type { SingleEngineState } from "../useLiveChartEngine";

export function useTradeStream(
  engine: SingleEngineState,
  tradeStream: SharedValue<TradeEvent[]>,
  padding: ChartPadding,
  active: boolean,
): SharedValue<TradeMarker[]> {
  const markers = useSharedValue<TradeMarker[]>([]);
  const state = useSharedValue<TradeStreamState>(createTradeStreamState());

  useFrameCallback(
    /* istanbul ignore next -- worklet runs on UI thread, not in Jest */ (
      frameInfo,
    ) => {
      "worklet";
      if (!active) {
        if (markers.value.length > 0) markers.value = [];
        return;
      }

      const dt = frameInfo.timeSincePreviousFrame ?? 16.67;
      const h = engine.canvasHeight.value;
      const chartTop = padding.top;
      const chartBottom = h - padding.bottom - 6;

      if (chartBottom <= chartTop) return;

      const s = state.value;
      tickTradeStream(s, tradeStream.value, dt, chartTop, chartBottom);

      const chartH = chartBottom - chartTop;
      markers.value = projectLabels(s, chartTop, chartH);
    },
  );

  return markers;
}
