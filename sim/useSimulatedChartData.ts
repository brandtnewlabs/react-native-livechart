/**
 * React hook: synthetic `LiveChart` feeds (line, candles, optional trade tape, optional multi-series).
 *
 * Model — After mount or option change, a **seed** fills history; then a **single live clock** runs at
 * `tradesPerSecond` (mean). Each tick emits one fill whose **execution price** becomes the next
 * `LiveChartPoint` (and OHLC buckets if enabled). Tape and chart stay in lockstep.
 *
 * Performance — Hot path mutates `buf` refs, then assigns `SharedValue.value` once per tick (avoid reading
 * large SharedValues on the JS thread during pulses).
 */
import { useEffect, useRef, type RefObject } from "react";
import type {
  CandlePoint,
  LiveChartPoint,
  SeriesConfig,
  TradeEvent,
} from "react-native-livechart";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import {
  baseIntervalMsForTps,
  buildSeededHistory,
  generateLiveMidTrade,
  nextJitteredDelayMs,
  pushFifo,
} from "./chartSimCore";
import {
  aggregateCandles,
  bondingTrade,
  createBondingCurve,
  generateMultiSeries,
  stepMultiSeries,
  volatilityFor,
  type BondingCurveState,
  type VolatilityMode,
} from "./generators";
import type { HistoryRange } from "./historyRange";

/** Default live TPS when `tradesPerSecond` is omitted (keeps older demos feeling similar per volatility). */
function defaultTradesPerSecond(mode: VolatilityMode): number {
  switch (mode) {
    case "calm":
      return 2;
    case "normal":
      return 5;
    case "volatile":
      return 10;
    case "chaotic":
      return 16;
  }
}

export { HISTORY_RANGE_SPAN_SECONDS } from "./chartSimCore";
export type { HistoryRange } from "./historyRange";

export type TradeSource = "orderbook" | "bonding-curve";

export interface SimulatedChartOptions {
  volatilityMode?: VolatilityMode;
  tradeSource?: TradeSource;
  startValue?: number;
  candleWidth?: number;
  paused?: boolean;
  maxPoints?: number;
  multiSeries?: boolean;
  candleAggregation?: boolean;
  /** When false, live still steps the chart but the tape stays empty. */
  tradeStream?: boolean;
  /** Merged into series each live tick so toggle chips can override `visible` without reseeding. */
  seriesVisibilityRef?: RefObject<Record<string, boolean>>;
  /**
   * Preset span for seeded history. Ignored if `historySpanSeconds` is set.
   * @default '1d'
   */
  historyRange?: HistoryRange;
  /** Overrides `historyRange` when > 0 (seconds of seeded history). */
  historySpanSeconds?: number;
  /**
   * Mean synthetic fills per second; drives live line/candles and tape together.
   * When omitted, scales with `volatilityMode` (calm→2 … chaotic→16) so older demos keep similar cadence.
   */
  tradesPerSecond?: number;
  /**
   * 0 = steady `setInterval`; &gt;0 = randomized gaps with same mean rate (clamped 0–1).
   * @default 0
   */
  tradeArrivalJitter?: number;
  /** FIFO cap for tape; drops oldest. @default 50 */
  maxTradeStreamLength?: number;
  /** Optional `TradeEvent.symbol` on synthetic fills. */
  tokenSymbol?: string;
  /** Bump to force full history regen without changing other inputs. */
  resetNonce?: number;
  /** Uniform [0,1) — tests only; default `Math.random`. */
  random01?: () => number;
}

/** @deprecated Use `SimulatedChartOptions`. */
export type SimulatedDataOptions = SimulatedChartOptions;

export interface SimulatedData {
  data: SharedValue<LiveChartPoint[]>;
  value: SharedValue<number>;
  tradeStream: SharedValue<TradeEvent[]>;
  series: SharedValue<SeriesConfig[]>;
  candles: SharedValue<CandlePoint[]>;
  liveCandle: SharedValue<CandlePoint | null>;
}

/** JS-thread buffers read/written in timers; SharedValues mirror these for the UI thread. */
interface TickBuffers {
  data: LiveChartPoint[];
  tradeStream: TradeEvent[];
  series: SeriesConfig[];
}

const INITIAL_TAPE_EVENTS = 20;

/** Staggered timestamps so the initial tape has depth (same mid as last seed point). */
function seedTradeTapeFromMid(
  midPrice: number,
  eventCount: number,
  spread: number,
  random01: () => number,
  symbol?: string,
): TradeEvent[] {
  const now = Date.now() / 1000;
  const out: TradeEvent[] = [];
  for (let i = 0; i < eventCount; i++) {
    out.push(
      generateLiveMidTrade(
        midPrice,
        spread,
        now - (eventCount - i) * 0.05,
        random01,
        symbol,
      ),
    );
  }
  return out;
}

/** @see module docstring for architecture (seed + TPS-driven live loop). */
export function useSimulatedChartData(
  opts: SimulatedChartOptions = {},
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
    historyRange = "1d",
    historySpanSeconds: historySpanSecondsOpt,
    tradesPerSecond: tradesPerSecondOpt,
    tradeArrivalJitter: tradeArrivalJitterRaw = 0,
    maxTradeStreamLength = 50,
    tokenSymbol,
    resetNonce = 0,
    random01: random01Opt,
  } = opts;

  const tradeArrivalJitter = Math.min(1, Math.max(0, tradeArrivalJitterRaw));
  const tradesPerSecond =
    tradesPerSecondOpt ?? defaultTradesPerSecond(volatilityMode);
  const random01Ref = useRef(random01Opt ?? Math.random);
  random01Ref.current = random01Opt ?? Math.random;

  const buf = useRef<TickBuffers>({
    data: [],
    tradeStream: [],
    series: [],
  });

  const data = useSharedValue<LiveChartPoint[]>([]);
  const value = useSharedValue(startValue);
  const tradeStream = useSharedValue<TradeEvent[]>([]);
  const series = useSharedValue<SeriesConfig[]>([]);
  const candles = useSharedValue<CandlePoint[]>([]);
  const liveCandle = useSharedValue<CandlePoint | null>(null);

  const bondingCurveRef = useRef<BondingCurveState>(
    createBondingCurve({ basePrice: startValue }),
  );

  // Full reseed: history, optional tape bootstrap, multi-series baseline, bonding state.
  useEffect(() => {
    const rng = random01Ref.current;
    const vol = volatilityFor(volatilityMode);
    const { points: history } = buildSeededHistory(
      {
        historyRange,
        historySpanSeconds: historySpanSecondsOpt,
      },
      maxPoints,
      startValue,
      vol,
      rng,
    );

    bondingCurveRef.current = createBondingCurve({ basePrice: startValue });

    const lastMid = history[history.length - 1]?.value ?? startValue;
    const initialTrades = tradeStreamEnabled
      ? seedTradeTapeFromMid(
          lastMid,
          INITIAL_TAPE_EVENTS,
          vol,
          rng,
          tokenSymbol,
        )
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
    value.value = lastMid;
    tradeStream.value = initialTrades;
    series.value = initialSeries;
    if (candleAggregation) {
      const c = aggregateCandles(history, candleWidth);
      candles.value = c.candles;
      liveCandle.value = c.liveCandle;
    } else {
      candles.value = [];
      liveCandle.value = null;
    }
  }, [
    volatilityMode,
    historyRange,
    historySpanSecondsOpt,
    maxPoints,
    startValue,
    candleWidth,
    multiSeries,
    candleAggregation,
    tradeStreamEnabled,
    tokenSymbol,
    tradeSource,
    resetNonce,
    data,
    value,
    tradeStream,
    series,
    candles,
    liveCandle,
  ]);

  // Re-bucket OHLC when `candleWidth` / aggregation toggles without throwing away tick history.
  useEffect(() => {
    if (!candleAggregation) {
      candles.value = [];
      liveCandle.value = null;
      return;
    }
    if (buf.current.data.length === 0) return;
    const c = aggregateCandles(buf.current.data, candleWidth);
    candles.value = c.candles;
    liveCandle.value = c.liveCandle;
  }, [candleWidth, candleAggregation, candles, liveCandle]);

  // Live: setInterval (jitter 0) or chained setTimeout (jitter > 0). Cleanup clears all timers.
  useEffect(() => {
    // No catch-up burst on resume; effect re-runs when TPS/jitter change and replaces the timer.
    if (paused || tradesPerSecond <= 0) {
      return;
    }

    const rng = random01Ref.current;
    const baseMs = baseIntervalMsForTps(tradesPerSecond);

    const pulse = () => {
      const b = buf.current;
      const spread = volatilityFor(volatilityMode);
      const now = Date.now() / 1000;
      const lastMid =
        b.data.length > 0 ? b.data[b.data.length - 1].value : startValue;

      let trade: TradeEvent;

      if (tradeSource === "bonding-curve") {
        const result = bondingTrade(bondingCurveRef.current, rng);
        bondingCurveRef.current = result.state;
        trade = {
          ...result.event,
          time: now,
          ...(tokenSymbol ? { symbol: tokenSymbol } : {}),
        };
      } else {
        trade = generateLiveMidTrade(lastMid, spread, now, rng, tokenSymbol);
      }

      const newValue = trade.price;

      b.data = [...b.data, { time: now, value: newValue }];
      if (b.data.length > maxPoints) b.data = b.data.slice(-maxPoints);
      data.value = b.data;
      value.value = newValue;

      if (candleAggregation) {
        const c = aggregateCandles(b.data, candleWidth);
        candles.value = c.candles;
        liveCandle.value = c.liveCandle;
      }

      if (tradeStreamEnabled) {
        b.tradeStream = pushFifo(b.tradeStream, trade, maxTradeStreamLength);
        tradeStream.value = b.tradeStream;
      } else {
        // Tape off: still advance price series; keep SharedValue empty for LiveChart overlay.
        b.tradeStream = [];
        tradeStream.value = [];
      }

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
    };

    let intervalId: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (tradeArrivalJitter <= 0) {
      intervalId = setInterval(pulse, baseMs);
    } else {
      const scheduleNext = () => {
        const delay = nextJitteredDelayMs(baseMs, tradeArrivalJitter, rng);
        timeoutId = setTimeout(() => {
          pulse();
          scheduleNext();
        }, delay);
      };
      scheduleNext();
    }

    return () => {
      if (intervalId !== undefined) clearInterval(intervalId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [
    paused,
    tradesPerSecond,
    tradeArrivalJitter,
    volatilityMode,
    tradeSource,
    startValue,
    maxPoints,
    candleWidth,
    candleAggregation,
    tradeStreamEnabled,
    maxTradeStreamLength,
    tokenSymbol,
    multiSeries,
    data,
    value,
    tradeStream,
    series,
    candles,
    liveCandle,
    seriesVisibilityRef,
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
