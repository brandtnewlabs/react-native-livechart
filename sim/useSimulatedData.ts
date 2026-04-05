import { useEffect, useRef, type RefObject } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import type {
  CandlePoint,
  LiveChartPoint,
  SeriesConfig,
  TradeEvent,
} from "../src/types";
import {
  aggregateCandles,
  bondingTrade,
  createBondingCurve,
  generateHistory,
  generateMultiSeries,
  generateTradeEvents,
  intervalFor,
  stepMultiSeries,
  volatilityFor,
  walkStep,
  type BondingCurveState,
  type VolatilityMode,
} from "./generators";

export type TradeSource = "orderbook" | "bonding-curve";

export interface SimulatedDataOptions {
  volatilityMode?: VolatilityMode;
  tradeSource?: TradeSource;
  startValue?: number;
  candleWidth?: number;
  paused?: boolean;
  maxPoints?: number;
  /** Skip multi-series generation when not displayed (default true). */
  multiSeries?: boolean;
  /** Skip candle aggregation when not displayed (default true). */
  candleAggregation?: boolean;
  /** Skip synthetic trade events when not displayed (default true). */
  tradeStream?: boolean;
  /**
   * When using multi-series, merge `visible` from this ref each tick so `onSeriesToggle`
   * can persist (demo / gallery).
   */
  seriesVisibilityRef?: RefObject<Record<string, boolean>>;
}

export interface SimulatedData {
  data: SharedValue<LiveChartPoint[]>;
  value: SharedValue<number>;
  tradeStream: SharedValue<TradeEvent[]>;
  series: SharedValue<SeriesConfig[]>;
  candles: SharedValue<CandlePoint[]>;
  liveCandle: SharedValue<CandlePoint | null>;
}

/**
 * JS-side mutable buffers for the tick callback to read/modify cheaply.
 * SharedValue .value reads on the JS thread deserialize the entire value
 * from the UI thread — O(n) and grows with the array. Refs are O(1) reads.
 *
 * Pattern: mutate ref → push ref contents to SharedValue (one-way JS → UI).
 * Never read SharedValue.value on the JS thread in a hot path.
 */
interface TickBuffers {
  data: LiveChartPoint[];
  tradeStream: TradeEvent[];
  series: SeriesConfig[];
}

export function useSimulatedData(
  opts: SimulatedDataOptions = {},
): SimulatedData {
  const {
    volatilityMode = "normal",
    tradeSource = "orderbook",
    startValue = 100,
    candleWidth = 60,
    paused = false,
    maxPoints = 2000,
    multiSeries = true,
    candleAggregation = true,
    tradeStream: tradeStreamEnabled = true,
    seriesVisibilityRef,
  } = opts;

  // JS-side buffers — fast O(1) reads in the tick callback
  const buf = useRef<TickBuffers>({
    data: [],
    tradeStream: [],
    series: [],
  });

  // Shared values — one-way push to UI thread for rendering
  const data = useSharedValue<LiveChartPoint[]>([]);
  const value = useSharedValue(startValue);
  const tradeStream = useSharedValue<TradeEvent[]>([]);
  const series = useSharedValue<SeriesConfig[]>([]);
  const candles = useSharedValue<CandlePoint[]>([]);
  const liveCandle = useSharedValue<CandlePoint | null>(null);

  const bondingCurveRef = useRef<BondingCurveState>(
    createBondingCurve({ basePrice: startValue }),
  );

  // Initialize + reset on volatility mode or start value change
  const prevResetKey = useRef<string | null>(null);
  useEffect(() => {
    const key = `${volatilityMode}:${startValue}`;
    if (prevResetKey.current === key) return;
    prevResetKey.current = key;

    // 24h of history at 60s intervals gives enough points for every window
    // (1440 pts total, ~60 visible per 1h, ~288 visible per 24h).
    const history = generateHistory({
      count: 1440,
      interval: 60,
      startValue,
      volatility: volatilityFor(volatilityMode),
    });
    const initialTrades = tradeStreamEnabled
      ? generateTradeEvents(history[history.length - 1].value, 20)
      : [];
    const initialSeries = multiSeries
      ? generateMultiSeries({
          ids: ["yes", "no", "maybe"],
          colors: ["#3b82f6", "#ef4444", "#f59e0b"],
          labels: ["Yes", "No", "Maybe"],
          count: 150,
          sumToHundred: true,
        })
      : [];

    buf.current = {
      data: history,
      tradeStream: initialTrades,
      series: initialSeries,
    };

    data.value = history;
    value.value = history[history.length - 1].value;
    tradeStream.value = initialTrades;
    series.value = initialSeries;
    if (candleAggregation) {
      const c = aggregateCandles(history, candleWidth);
      candles.value = c.candles;
      liveCandle.value = c.liveCandle;
    }
  }, [
    volatilityMode,
    startValue,
    candleWidth,
    multiSeries,
    candleAggregation,
    tradeStreamEnabled,
    data,
    value,
    tradeStream,
    series,
    candles,
    liveCandle,
  ]);

  // Tick loop — reads from refs (O(1)), writes to shared values (one-way push)
  useEffect(() => {
    if (paused) return;

    const ms = intervalFor(volatilityMode);
    const id = setInterval(() => {
      const vol = volatilityFor(volatilityMode);
      const b = buf.current;
      const lastValue =
        b.data.length > 0 ? b.data[b.data.length - 1].value : startValue;
      const newValue = walkStep(lastValue, vol);
      const now = Date.now() / 1000;

      // Data — new array each tick (Reanimated freezes shared value contents)
      b.data = [...b.data, { time: now, value: newValue }];
      if (b.data.length > maxPoints) b.data = b.data.slice(-maxPoints);
      data.value = b.data;
      value.value = newValue;

      // Candles
      if (candleAggregation) {
        const c = aggregateCandles(b.data, candleWidth);
        candles.value = c.candles;
        liveCandle.value = c.liveCandle;
      }

      // Trade stream (optional)
      if (tradeStreamEnabled) {
        if (tradeSource === "bonding-curve") {
          const result = bondingTrade(bondingCurveRef.current);
          bondingCurveRef.current = result.state;
          b.tradeStream = [...b.tradeStream, result.event];
        } else {
          b.tradeStream = [
            ...b.tradeStream,
            ...generateTradeEvents(newValue, 2, vol),
          ];
        }
        if (b.tradeStream.length > 50) b.tradeStream = b.tradeStream.slice(-50);
        tradeStream.value = b.tradeStream;
      } else {
        b.tradeStream = [];
        tradeStream.value = [];
      }

      // Multi-series — skip when not displayed
      if (multiSeries) {
        b.series = b.series.map((s) => {
          const vis = seriesVisibilityRef?.current[s.id];
          return {
            ...s,
            data: [...s.data],
            ...(vis !== undefined ? { visible: vis } : {}),
          };
        });
        stepMultiSeries(b.series, true);
        for (let i = 0; i < b.series.length; i++) {
          if (b.series[i].data.length > maxPoints) {
            b.series[i] = {
              ...b.series[i],
              data: b.series[i].data.slice(-maxPoints),
            };
          }
        }
        series.value = b.series;
      }
    }, ms);

    return () => clearInterval(id);
  }, [
    paused,
    volatilityMode,
    tradeSource,
    startValue,
    maxPoints,
    candleWidth,
    multiSeries,
    candleAggregation,
    tradeStreamEnabled,
    data,
    value,
    tradeStream,
    series,
    candles,
    liveCandle,
  ]);

  return {
    data,
    value,
    tradeStream,
    series,
    candles,
    liveCandle,
  };
}
