/**
 * Stateless sim helpers: seed layout (via `historyRange`), single live-trade generation,
 * jittered scheduling, and FIFO tape trimming. Used by `useSimulatedChartData`.
 */
import type { LiveChartPoint, TradeEvent } from "react-native-livechart";
import { generateHistory, type HistoryOptions } from "./generators";
import {
  HISTORY_RANGE_SPAN_SECONDS,
  resolveHistoryParams as resolveHistoryParamsIdeal,
  resolveHistorySpanAndIdeal,
  type HistoryRange,
} from "./historyRange";

export type { HistoryRange } from "./historyRange";
export { HISTORY_RANGE_SPAN_SECONDS };

/** Seeded series shape after capping: `intervalSec * (count - 1) === spanSeconds` (last sample at `now`). */
export interface ResolvedHistoryParams {
  count: number;
  intervalSec: number;
  spanSeconds: number;
}

/**
 * Combines `historyRange` / `historySpanSeconds` with `maxPoints`: uses `historyRange.ts` for span + ideal
 * step, then converts to `(count, intervalSec)` so the walk ends at `now` with even spacing.
 */
export function resolveSeededHistoryParams(
  opts: { historyRange?: HistoryRange; historySpanSeconds?: number },
  maxPoints: number,
): ResolvedHistoryParams {
  const { spanSeconds, idealIntervalSeconds } =
    resolveHistorySpanAndIdeal(opts);
  const r = resolveHistoryParamsIdeal({
    historySpanSeconds: spanSeconds,
    maxPoints,
    idealIntervalSeconds,
  });
  const count = r.count;
  const intervalSec = count >= 2 ? r.spanSeconds / (count - 1) : r.spanSeconds;
  return {
    count,
    intervalSec,
    spanSeconds: r.spanSeconds,
  };
}

/** Effective seed span in seconds (explicit `historySpanSeconds` overrides preset). */
export function resolveHistorySpanSeconds(
  historyRange: HistoryRange | undefined,
  historySpanSeconds: number | undefined,
): number {
  return resolveHistorySpanAndIdeal({
    historyRange,
    historySpanSeconds,
  }).spanSeconds;
}

/**
 * One synthetic fill at `timeSec`; execution `price` becomes the next chart value.
 * `spread` scales bid/ask dispersion (same role as `generateTradeEvents` spread).
 */
export function generateLiveMidTrade(
  midPrice: number,
  spread: number,
  timeSec: number,
  random01: () => number,
  symbol?: string,
): TradeEvent {
  const isBuy = random01() > 0.5;
  const offset = random01() * spread * midPrice;
  const price = isBuy ? midPrice + offset : midPrice - offset;
  const size = Math.pow(random01(), 3) * 10 + 0.01;
  const event: TradeEvent = {
    side: isBuy ? "buy" : "sell",
    price,
    size: Math.round(size * 100) / 100,
    time: timeSec,
  };
  if (symbol) event.symbol = symbol;
  return event;
}

export interface SeededHistoryResult {
  points: LiveChartPoint[];
  params: ResolvedHistoryParams;
}

/**
 * Gaussian walk from `startTime` to `now` with `count` points spaced by `intervalSec`
 * (derived from preset + `maxPoints` via `resolveSeededHistoryParams`).
 */
export function buildSeededHistory(
  rangeOpts: { historyRange?: HistoryRange; historySpanSeconds?: number },
  maxPoints: number,
  startValue: number,
  volatility: number,
  random01: () => number,
  nowSec?: number,
): SeededHistoryResult {
  const params = resolveSeededHistoryParams(rangeOpts, maxPoints);
  const now = nowSec ?? Date.now() / 1000;
  const startTime = now - (params.count - 1) * params.intervalSec;
  const opts: HistoryOptions = {
    count: params.count,
    interval: params.intervalSec,
    startValue,
    volatility,
    startTime,
    random01,
  };
  const points = generateHistory(opts);
  return { points, params };
}

/**
 * Next delay for live scheduler with arrival jitter (0 = none).
 * `delayMs = baseMs * (1 + (2*rng - 1) * jitter)`, clamped to [minMs, maxMs].
 */
export function nextJitteredDelayMs(
  baseMs: number,
  jitter: number,
  random01: () => number,
): number {
  if (jitter <= 0) return baseMs;
  const t = random01() * 2 - 1;
  const raw = baseMs * (1 + t * jitter);
  const minMs = Math.max(8, baseMs * Math.max(0.05, 1 - jitter));
  const maxMs = Math.min(60_000, baseMs * (1 + jitter));
  return Math.min(maxMs, Math.max(minMs, raw));
}

/** Clamp TPS to a sane range; returns mean period in ms. */
export function baseIntervalMsForTps(tradesPerSecond: number): number {
  const tps = Math.min(100, Math.max(0.001, tradesPerSecond));
  return 1000 / tps;
}

/** FIFO cap: drop oldest when over max. */
export function pushFifo<T>(arr: T[], item: T, maxLen: number): T[] {
  const next = [...arr, item];
  if (next.length <= maxLen) return next;
  return next.slice(-maxLen);
}
