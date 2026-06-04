/**
 * Preset history length and target bar spacing for seeded `LiveChartPoint[]`.
 *
 * - `HISTORY_RANGE_SPAN_SECONDS` — how far back the seed extends (wall time).
 * - `HISTORY_RANGE_IDEAL_INTERVAL_SECONDS` — desired step between points before `maxPoints` caps count.
 * - `resolveHistoryParams` — `count = min(maxPoints, ceil(span / ideal))`, then `interval = span / count`
 *   (points span `[0, span]` with that count; `chartSimCore` may re-space so the last point lands on `now`).
 */
const DAY = 86_400;

export type HistoryRange =
  | "1m"
  | "5m"
  | "1h"
  | "6h"
  | "1d"
  | "1w"
  | "1mo"
  | "6mo"
  | "1y";

/** Wall-clock seconds of backfill each preset represents. */
export const HISTORY_RANGE_SPAN_SECONDS: Record<HistoryRange, number> = {
  "1m": 60,
  "5m": 300,
  "1h": 3600,
  "6h": 21_600,
  "1d": DAY,
  "1w": 7 * DAY,
  "1mo": 30 * DAY,
  "6mo": 183 * DAY,
  "1y": 365 * DAY,
};

/** Target seconds between seed points before capping by `maxPoints` (per preset). */
export const HISTORY_RANGE_IDEAL_INTERVAL_SECONDS: Record<
  HistoryRange,
  number
> = {
  "1m": 1,
  "5m": 2,
  "1h": 30,
  "6h": 180,
  "1d": 60,
  "1w": 3600,
  "1mo": 7200,
  "6mo": 43_200,
  "1y": DAY,
};

/** Resolve total span and ideal step (explicit `historySpanSeconds` wins over preset span). */
export function resolveHistorySpanAndIdeal(opts: {
  historyRange?: HistoryRange;
  historySpanSeconds?: number;
}): { spanSeconds: number; idealIntervalSeconds: number } {
  if (
    opts.historySpanSeconds != null &&
    opts.historySpanSeconds > 0 &&
    Number.isFinite(opts.historySpanSeconds)
  ) {
    const span = opts.historySpanSeconds;
    const ideal =
      opts.historyRange != null
        ? HISTORY_RANGE_IDEAL_INTERVAL_SECONDS[opts.historyRange]
        : Math.max(1, span / 500);
    return { spanSeconds: span, idealIntervalSeconds: ideal };
  }
  const range = opts.historyRange ?? "1d";
  return {
    spanSeconds: HISTORY_RANGE_SPAN_SECONDS[range],
    idealIntervalSeconds: HISTORY_RANGE_IDEAL_INTERVAL_SECONDS[range],
  };
}

/**
 * Point count capped by `maxPoints`, uniform spacing so `count * intervalSeconds ≈ spanSeconds`.
 */
export function resolveHistoryParams(opts: {
  historySpanSeconds: number;
  maxPoints: number;
  idealIntervalSeconds: number;
}): { count: number; intervalSeconds: number; spanSeconds: number } {
  const spanSeconds = Math.max(1, opts.historySpanSeconds);
  const maxPoints = Math.max(1, opts.maxPoints);
  const ideal = Math.max(0.25, opts.idealIntervalSeconds);
  let count = Math.min(maxPoints, Math.ceil(spanSeconds / ideal));
  count = Math.max(1, count);
  const intervalSeconds = spanSeconds / count;
  return { count, intervalSeconds, spanSeconds };
}
