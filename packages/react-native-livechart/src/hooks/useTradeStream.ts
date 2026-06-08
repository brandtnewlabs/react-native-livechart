import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { MS_PER_FRAME_60FPS } from "../constants";
import type { SingleEngineState } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import {
  createTradeStreamState,
  projectLabels,
  tickTradeStream,
  type TradeMarker,
  type TradeStreamState,
} from "../draw/trade";
import type { TradeEvent } from "../types";

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
  /** Static charts run no loops: register without starting. Default `true`. */
  autostart = true,
): SharedValue<TradeMarker[]> {
  const markers = useSharedValue<TradeMarker[]>([]);
  const state = useSharedValue<TradeStreamState>(createTradeStreamState());

  useFrameCallback(
    /* istanbul ignore next -- worklet runs on UI thread, not in Jest */ (
      frameInfo,
    ) => {
      "worklet";
      if (!active) {
        if (markers.get().length > 0) markers.set([]);
        return;
      }

      const dt = frameInfo.timeSincePreviousFrame ?? MS_PER_FRAME_60FPS;
      const h = engine.canvasHeight.get();
      const chartTop = padding.top;
      const LABEL_CLEARANCE = 6;
      const chartBottom = h - padding.bottom - LABEL_CLEARANCE;

      if (chartBottom <= chartTop) return;

      const s = state.get();
      tickTradeStream(s, tradeStream.get(), dt, chartTop, chartBottom);

      // Idle tape: nothing to draw and nothing already drawn. Skip the projection
      // and SharedValue write so the TapeLabel derived values don't re-run and we
      // don't allocate a fresh marker array every frame.
      if (s.labels.length === 0 && markers.get().length === 0) return;

      const chartH = chartBottom - chartTop;
      markers.set(projectLabels(s, chartTop, chartH));
    },
    autostart,
  );

  return markers;
}
