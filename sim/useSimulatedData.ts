import { useEffect, useRef } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import type {
  CandlePoint,
  LivelinePoint,
  LivelineSeries,
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
}

export interface SimulatedData {
  data: SharedValue<LivelinePoint[]>;
  value: SharedValue<number>;
  tradeEvents: SharedValue<TradeEvent[]>;
  series: SharedValue<LivelineSeries[]>;
  candles: SharedValue<CandlePoint[]>;
  liveCandle: SharedValue<CandlePoint>;
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
  data: LivelinePoint[];
  tradeEvents: TradeEvent[];
  series: LivelineSeries[];
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
  } = opts;

  // JS-side buffers — fast O(1) reads in the tick callback
  const buf = useRef<TickBuffers>({
    data: [],
    tradeEvents: [],
    series: [],
  });

  // Shared values — one-way push to UI thread for rendering
  const data = useSharedValue<LivelinePoint[]>([]);
  const value = useSharedValue(startValue);
  const tradeEvents = useSharedValue<TradeEvent[]>([]);
  const series = useSharedValue<LivelineSeries[]>([]);
  const candles = useSharedValue<CandlePoint[]>([]);
  const liveCandle = useSharedValue<CandlePoint>({
    time: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
  });

  const bondingCurveRef = useRef<BondingCurveState>(
    createBondingCurve({ basePrice: startValue }),
  );

  // Initialize + reset on volatility mode change
  const prevModeRef = useRef<VolatilityMode | null>(null);
  useEffect(() => {
    if (prevModeRef.current === volatilityMode) return;
    prevModeRef.current = volatilityMode;

    const history = generateHistory({
      count: 150,
      interval: 0.2,
      startValue,
      volatility: volatilityFor(volatilityMode),
    });
    const initialTrades = generateTradeEvents(
      history[history.length - 1].value,
      20,
    );
    const initialSeries = generateMultiSeries({
      ids: ["yes", "no", "maybe"],
      colors: ["#3b82f6", "#ef4444", "#f59e0b"],
      labels: ["Yes", "No", "Maybe"],
      count: 150,
      sumToHundred: true,
    });

    buf.current = {
      data: history,
      tradeEvents: initialTrades,
      series: initialSeries,
    };

    data.value = history;
    value.value = history[history.length - 1].value;
    tradeEvents.value = initialTrades;
    series.value = initialSeries;
    const c = aggregateCandles(history, candleWidth);
    candles.value = c.candles;
    liveCandle.value = c.liveCandle;
  }, [
    volatilityMode,
    startValue,
    candleWidth,
    data,
    value,
    tradeEvents,
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
      const c = aggregateCandles(b.data, candleWidth);
      candles.value = c.candles;
      liveCandle.value = c.liveCandle;

      // Trade events
      if (tradeSource === "bonding-curve") {
        const result = bondingTrade(bondingCurveRef.current);
        bondingCurveRef.current = result.state;
        b.tradeEvents = [...b.tradeEvents, result.event];
      } else {
        b.tradeEvents = [
          ...b.tradeEvents,
          ...generateTradeEvents(newValue, 2, vol),
        ];
      }
      if (b.tradeEvents.length > 50) b.tradeEvents = b.tradeEvents.slice(-50);
      tradeEvents.value = b.tradeEvents;

      // Multi-series — clone before mutating since previous array is frozen
      b.series = b.series.map((s) => ({ ...s, data: [...s.data] }));
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
    }, ms);

    return () => clearInterval(id);
  }, [
    paused,
    volatilityMode,
    tradeSource,
    startValue,
    maxPoints,
    candleWidth,
    data,
    value,
    tradeEvents,
    series,
    candles,
    liveCandle,
  ]);

  return {
    data,
    value,
    tradeEvents,
    series,
    candles,
    liveCandle,
  };
}
