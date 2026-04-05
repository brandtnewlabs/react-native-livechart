import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { MS_PER_FRAME_60FPS } from "../constants";
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

/**
 * Process live trade events into projected on-chart markers.
 * Runs a frame callback that ticks the trade-stream state and produces
 * `TradeMarker[]` positioned within the chart area.
 */
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

      const dt = frameInfo.timeSincePreviousFrame ?? MS_PER_FRAME_60FPS;
      const h = engine.canvasHeight.value;
      const chartTop = padding.top;
      const LABEL_CLEARANCE = 6;
      const chartBottom = h - padding.bottom - LABEL_CLEARANCE;

      if (chartBottom <= chartTop) return;

      const s = state.value;
      tickTradeStream(s, tradeStream.value, dt, chartTop, chartBottom);

      const chartH = chartBottom - chartTop;
      markers.value = projectLabels(s, chartTop, chartH);
    },
  );

  return markers;
}
