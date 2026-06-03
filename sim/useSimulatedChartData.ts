/**
 * React hook: synthetic `LiveChart` feeds (line, candles, optional trade tape, optional multi-series).
 *
 * Model — After mount or option change, a **seed** fills history; then a **single live clock** runs at
 * `tradesPerSecond` (mean). Each tick emits one fill whose **execution price** becomes the next
 * `LiveChartPoint` (and OHLC buckets if enabled). Tape and chart stay in lockstep.
 *
 * Performance — The full point arrays live inside the `data`/`series` SharedValues (UI side). Each tick
 * computes only the tiny per-tick delta (the new point(s)) on the JS thread and appends it **in place**
 * via `SharedValue.modify(...)`, so Reanimated never deep-clones the whole (growing) array across the
 * thread boundary every tick. Reassigning the full array each tick was the source of an iOS memory climb
 * that scaled with series count (~0.25 MB/s for 3 series). The chart still re-renders every frame because
 * the engine bumps a `timestamp` SharedValue in `useFrameCallback` and the path-building `useDerivedValue`s
 * read both `timestamp` and `data.value`/`series.value`, so in-place mutations are picked up without a
 * fresh top-level reference.
 *
 * Small JS-thread state (`lastMid`, per-series `values`, bonding-curve state, trade tape) is kept in `buf`
 * to generate the next delta; the candle path additionally keeps a JS-side `data` mirror because OHLC
 * re-aggregation needs the full tick array (single-series candle charts are memory-flat — one array).
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
  stepMultiSeriesValues,
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

export interface SimulatedData {
  data: SharedValue<LiveChartPoint[]>;
  value: SharedValue<number>;
  tradeStream: SharedValue<TradeEvent[]>;
  series: SharedValue<SeriesConfig[]>;
  candles: SharedValue<CandlePoint[]>;
  liveCandle: SharedValue<CandlePoint | null>;
}

/**
 * Small JS-thread state read/written in timers to generate the next per-tick delta.
 *
 * The full point arrays live in the `data`/`series` SharedValues (UI side) and are mutated in place via
 * `.modify`; we deliberately do NOT mirror them here for the multi-series path (that mirror is what leaked).
 *
 * - `lastMid`: last single-series price, to seed the next live-mid trade.
 * - `seriesValues`: last value per series (scalars), to compute the next per-series values.
 * - `seriesIds`: series ids (parallel to `seriesValues`), to map visibility overrides without reading
 *   the (large) `series` SharedValue on the JS thread.
 * - `candleData`: full single-series tick array, kept ONLY for OHLC re-aggregation (memory-flat: one array).
 * - `tradeStream`: FIFO tape buffer (small, capped by `maxTradeStreamLength`).
 */
interface TickBuffers {
  lastMid: number;
  seriesValues: number[];
  seriesIds: string[];
  candleData: LiveChartPoint[];
  tradeStream: TradeEvent[];
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

interface SeedResult {
  history: LiveChartPoint[];
  candleData: LiveChartPoint[];
  initialTrades: TradeEvent[];
  initialSeries: SeriesConfig[];
  seriesValues: number[];
  seriesIds: string[];
  candles: CandlePoint[];
  liveCandle: CandlePoint | null;
  lastMid: number;
}

/**
 * Pure seed computation: history, optional tape bootstrap, multi-series baseline,
 * and the initial OHLC buckets. Kept out of the seeding effect so the effect only
 * *syncs* the result into refs/SharedValues — it never transforms prop-derived
 * data inline (which `no-event-handler` / `no-pass-data-to-parent` flag).
 */
function computeSeed(params: {
  volatilityMode: VolatilityMode;
  historyRange: HistoryRange;
  historySpanSeconds?: number;
  maxPoints: number;
  startValue: number;
  candleWidth: number;
  multiSeries: boolean;
  candleAggregation: boolean;
  tradeStreamEnabled: boolean;
  tokenSymbol?: string;
  rng: () => number;
}): SeedResult {
  const {
    volatilityMode,
    historyRange,
    historySpanSeconds,
    maxPoints,
    startValue,
    candleWidth,
    multiSeries,
    candleAggregation,
    tradeStreamEnabled,
    tokenSymbol,
    rng,
  } = params;

  const vol = volatilityFor(volatilityMode);
  const { points: history } = buildSeededHistory(
    { historyRange, historySpanSeconds },
    maxPoints,
    startValue,
    vol,
    rng,
  );

  const lastMid = history[history.length - 1]?.value ?? startValue;
  const initialTrades = tradeStreamEnabled
    ? seedTradeTapeFromMid(lastMid, INITIAL_TAPE_EVENTS, vol, rng, tokenSymbol)
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

  const { candles, liveCandle } = candleAggregation
    ? aggregateCandles(history, candleWidth)
    : { candles: [] as CandlePoint[], liveCandle: null };

  return {
    history,
    // Mirror history JS-side only when OHLC re-aggregation needs it. This copy is
    // load-bearing: on the web/test mutable path `data.set` does not clone, so the
    // mirror must be an independent array from the one handed to `data`.
    candleData: candleAggregation ? history.slice() : [],
    initialTrades,
    initialSeries,
    seriesValues: initialSeries.map((s) => s.value),
    seriesIds: initialSeries.map((s) => s.id),
    candles,
    liveCandle,
    lastMid,
  };
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
  useEffect(() => {
    random01Ref.current = random01Opt ?? Math.random;
  });

  const buf = useRef<TickBuffers>({
    lastMid: startValue,
    seriesValues: [],
    seriesIds: [],
    candleData: [],
    tradeStream: [],
  });

  const data = useSharedValue<LiveChartPoint[]>([]);
  const value = useSharedValue(startValue);
  const tradeStream = useSharedValue<TradeEvent[]>([]);
  const series = useSharedValue<SeriesConfig[]>([]);
  const candles = useSharedValue<CandlePoint[]>([]);
  const liveCandle = useSharedValue<CandlePoint | null>(null);

  const bondingCurveRef = useRef<BondingCurveState | null>(null);
  if (bondingCurveRef.current === null) {
    bondingCurveRef.current = createBondingCurve({ basePrice: startValue });
  }

  // Full reseed: history, optional tape bootstrap, multi-series baseline, bonding
  // state. The data is built by the pure `computeSeed` helper; this effect only
  // syncs that result into the JS-side ref and the SharedValues (no prop-derived
  // data is transformed inline here).
  useEffect(() => {
    const seed = computeSeed({
      volatilityMode,
      historyRange,
      historySpanSeconds: historySpanSecondsOpt,
      maxPoints,
      startValue,
      candleWidth,
      multiSeries,
      candleAggregation,
      tradeStreamEnabled,
      tokenSymbol,
      rng: random01Ref.current,
    });

    bondingCurveRef.current = createBondingCurve({ basePrice: startValue });

    buf.current = {
      lastMid: seed.lastMid,
      seriesValues: seed.seriesValues,
      seriesIds: seed.seriesIds,
      candleData: seed.candleData,
      tradeStream: seed.initialTrades,
    };

    // Seed assigns the full arrays once (a single clone at seed time is fine);
    // the live loop then appends in place via `.modify`.
    data.set(seed.history);
    value.set(seed.lastMid);
    tradeStream.set(seed.initialTrades);
    series.set(seed.initialSeries);
    candles.set(seed.candles);
    liveCandle.set(seed.liveCandle);
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

  // Re-bucket OHLC when `candleWidth` / aggregation toggles without throwing away
  // tick history. Computed unconditionally (empty when aggregation is off) and
  // synced — no prop-derived `if` branch. The only guard is a ref check (skip
  // until the tick mirror has been seeded), which isn't an event-handler shape.
  useEffect(() => {
    if (candleAggregation && buf.current.candleData.length === 0) return;
    const { candles: nextCandles, liveCandle: nextLiveCandle } =
      candleAggregation
        ? aggregateCandles(buf.current.candleData, candleWidth)
        : { candles: [] as CandlePoint[], liveCandle: null };
    candles.set(nextCandles);
    liveCandle.set(nextLiveCandle);
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
      const lastMid = b.lastMid;

      let trade: TradeEvent;

      if (tradeSource === "bonding-curve") {
        const result = bondingTrade(bondingCurveRef.current!, rng);
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
      const newPoint: LiveChartPoint = { time: now, value: newValue };

      // Append the single new point IN PLACE on the UI thread. Only `newPoint`
      // and `maxPoints` cross the thread boundary (tiny payload) — the full
      // (growing) array is never re-cloned JS→UI.
      data.modify((arr) => {
        "worklet";
        arr.push(newPoint);
        if (arr.length > maxPoints) arr.shift();
        return arr;
      });
      // Scalar — fine to assign directly (no array clone).
      value.set(newValue);
      b.lastMid = newValue;

      if (candleAggregation) {
        // OHLC re-aggregation needs the full tick array; keep the JS-side mirror
        // (memory-flat: one array) and re-bucket from it.
        b.candleData.push(newPoint);
        if (b.candleData.length > maxPoints) b.candleData.shift();
        const c = aggregateCandles(b.candleData, candleWidth);
        candles.set(c.candles);
        liveCandle.set(c.liveCandle);
      }

      if (tradeStreamEnabled) {
        b.tradeStream = pushFifo(b.tradeStream, trade, maxTradeStreamLength);
        tradeStream.set(b.tradeStream);
      } else {
        // Tape off: still advance price series; keep SharedValue empty for LiveChart overlay.
        b.tradeStream = [];
        tradeStream.set([]);
      }

      if (multiSeries) {
        // Compute next per-series values from scalars on the JS thread (cheap),
        // then append the new point(s) IN PLACE inside the `.modify` worklet so
        // the full series array is never re-cloned to the UI thread each tick.
        const nextValues = stepMultiSeriesValues(b.seriesValues, true);
        b.seriesValues = nextValues;

        // Snapshot visibility overrides as a plain array (indexed by series) on
        // the JS thread — avoids reading the JS-thread ref inside the worklet and
        // avoids reading the (large) `series` SharedValue on the hot path.
        const visibility: (boolean | undefined)[] | undefined =
          seriesVisibilityRef
            ? b.seriesIds.map((id) => seriesVisibilityRef.current[id])
            : undefined;

        series.modify((s) => {
          "worklet";
          for (let i = 0; i < s.length; i++) {
            s[i].data.push({ time: now, value: nextValues[i] });
            if (s[i].data.length > maxPoints) s[i].data.shift();
            s[i].value = nextValues[i];
            if (visibility !== undefined && visibility[i] !== undefined) {
              s[i].visible = visibility[i];
            }
          }
          return s;
        });
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
