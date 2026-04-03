import { useCallback, useEffect, useRef, useState } from "react";
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
  type VolatilityMode
} from "./generators";

export type TradeSource = "orderbook" | "bonding-curve";

export interface SimulatedDataOptions {
  volatilityMode?: VolatilityMode;
  tradeSource?: TradeSource;
  startValue?: number;
  candleWidth?: number;
  paused?: boolean;
  /** Max data points to keep in memory */
  maxPoints?: number;
}

export interface SimulatedData {
  data: LivelinePoint[];
  value: number;
  candles: CandlePoint[];
  liveCandle: CandlePoint;
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

  const [data, setData] = useState<LivelinePoint[]>(() =>
    generateHistory({
      count: 150,
      interval: 0.2,
      startValue,
      volatility: volatilityFor(volatilityMode),
    }),
  );

  const [value, setValue] = useState(() =>
    data.length > 0 ? data[data.length - 1].value : startValue,
  );

  const [tradeEvents, setTradeEvents] = useState<TradeEvent[]>(() =>
    generateTradeEvents(value, 20),
  );

  const [series, setSeries] = useState<LivelineSeries[]>(() =>
    generateMultiSeries({
      ids: ["yes", "no", "maybe"],
      colors: ["#3b82f6", "#ef4444", "#f59e0b"],
      labels: ["Yes", "No", "Maybe"],
      count: 150,
      sumToHundred: true,
    }),
  );

  const bondingCurveRef = useRef<BondingCurveState>(
    createBondingCurve({ basePrice: startValue }),
  );

  const volatilityModeRef = useRef(volatilityMode);
  const tradeSourceRef = useRef(tradeSource);

  useEffect(() => {
    volatilityModeRef.current = volatilityMode;
  }, [volatilityMode]);

  useEffect(() => {
    tradeSourceRef.current = tradeSource;
  }, [tradeSource]);

  // Reset data when volatility mode changes
  const prevModeRef = useRef(volatilityMode);
  useEffect(() => {
    if (prevModeRef.current !== volatilityMode) {
      prevModeRef.current = volatilityMode;
      const newData = generateHistory({
        count: 150,
        interval: 0.2,
        startValue,
        volatility: volatilityFor(volatilityMode),
      });
      setData(newData);
      setValue(newData[newData.length - 1].value);
    }
  }, [volatilityMode, startValue]);

  const tick = useCallback(() => {
    const mode = volatilityModeRef.current;
    const source = tradeSourceRef.current;
    const vol = volatilityFor(mode);

    setData((prev) => {
      const lastValue =
        prev.length > 0 ? prev[prev.length - 1].value : startValue;
      const newValue = walkStep(lastValue, vol);
      const now = Date.now() / 1000;
      const newPoint: LivelinePoint = { time: now, value: newValue };
      const updated = [...prev, newPoint];
      const trimmed =
        updated.length > maxPoints
          ? updated.slice(updated.length - maxPoints)
          : updated;

      // Side-effect: update value
      setValue(newValue);

      // Side-effect: update trade events
      if (source === "bonding-curve") {
        const result = bondingTrade(bondingCurveRef.current);
        bondingCurveRef.current = result.state;
        setTradeEvents((prevEvents) => {
          const next = [...prevEvents, result.event];
          return next.length > 50 ? next.slice(-50) : next;
        });
      } else {
        setTradeEvents((prevEvents) => {
          const newEvents = generateTradeEvents(newValue, 2, vol);
          const next = [...prevEvents, ...newEvents];
          return next.length > 50 ? next.slice(-50) : next;
        });
      }

      // Side-effect: step multi-series
      setSeries((prev) => {
        const cloned = prev.map((s) => ({
          ...s,
          data: [...s.data],
        }));
        stepMultiSeries(cloned, true);
        return cloned.map((s) => ({
          ...s,
          data:
            s.data.length > maxPoints
              ? s.data.slice(s.data.length - maxPoints)
              : s.data,
        }));
      });

      return trimmed;
    });
  }, [startValue, maxPoints]);

  useEffect(() => {
    if (paused) return;
    const ms = intervalFor(volatilityModeRef.current);
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [paused, tick, volatilityMode]);

  const { candles, liveCandle } = aggregateCandles(data, candleWidth);

  return {
    data,
    value,
    candles,
    liveCandle,
    tradeEvents,
    series,
  };
}
