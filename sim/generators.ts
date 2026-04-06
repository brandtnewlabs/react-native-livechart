import type {
  CandlePoint,
  LiveChartPoint,
  SeriesConfig,
  TradeEvent,
} from "../src/types";

// ─── Random walk ───────────────────────────────────────────────────────────────

/** Box-Muller transform — returns a standard normal variate. */
function gaussianRandom(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export interface HistoryOptions {
  count?: number;
  interval?: number; // seconds between points
  startValue?: number;
  volatility?: number; // step size as fraction of value
  startTime?: number; // unix seconds, defaults to now - count*interval
}

/**
 * Generate a backfill of LiveChartPoint[] using a Gaussian random walk.
 */
export function generateHistory(opts: HistoryOptions = {}): LiveChartPoint[] {
  const count = opts.count ?? 150;
  const interval = opts.interval ?? 0.2;
  const volatility = opts.volatility ?? 0.003;
  let value = opts.startValue ?? 100;
  const startTime = opts.startTime ?? Date.now() / 1000 - count * interval;

  const points: LiveChartPoint[] = [];
  for (let i = 0; i < count; i++) {
    const time = startTime + i * interval;
    points.push({ time, value });
    value += value * volatility * gaussianRandom();
    if (value < 0.01) value = 0.01;
  }
  return points;
}

/**
 * Advance a random walk by one step. Returns the new value.
 */
export function walkStep(currentValue: number, volatility: number): number {
  const step = currentValue * volatility * gaussianRandom();
  const next = currentValue + step;
  return Math.max(0.01, next);
}

// ─── Volatility presets ────────────────────────────────────────────────────────

export type VolatilityMode = "calm" | "normal" | "volatile" | "chaotic";

export function volatilityFor(mode: VolatilityMode): number {
  switch (mode) {
    case "calm":
      return 0.0008;
    case "normal":
      return 0.003;
    case "volatile":
      return 0.012;
    case "chaotic":
      return 0.035;
  }
}

export function intervalFor(mode: VolatilityMode): number {
  switch (mode) {
    case "calm":
      return 300;
    case "normal":
      return 200;
    case "volatile":
      return 100;
    case "chaotic":
      return 60;
  }
}

// ─── Candle aggregation ────────────────────────────────────────────────────────

export interface CandleResult {
  candles: CandlePoint[];
  liveCandle: CandlePoint;
}

/**
 * Bucket tick data into OHLC candles.
 * Returns completed candles + the in-progress live candle.
 */
export function aggregateCandles(
  ticks: LiveChartPoint[],
  candleWidth: number,
): CandleResult {
  if (ticks.length === 0) {
    const now = Date.now() / 1000;
    return {
      candles: [],
      liveCandle: { time: now, open: 0, high: 0, low: 0, close: 0 },
    };
  }

  const buckets = new Map<number, CandlePoint>();

  for (const tick of ticks) {
    const bucketTime = Math.floor(tick.time / candleWidth) * candleWidth;
    const existing = buckets.get(bucketTime);
    if (existing) {
      if (tick.value > existing.high) existing.high = tick.value;
      if (tick.value < existing.low) existing.low = tick.value;
      existing.close = tick.value;
    } else {
      buckets.set(bucketTime, {
        time: bucketTime,
        open: tick.value,
        high: tick.value,
        low: tick.value,
        close: tick.value,
      });
    }
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => a.time - b.time);

  if (sorted.length <= 1) {
    return {
      candles: [],
      liveCandle: sorted[0] ?? {
        time: Date.now() / 1000,
        open: 0,
        high: 0,
        low: 0,
        close: 0,
      },
    };
  }

  return {
    candles: sorted.slice(0, -1),
    liveCandle: sorted[sorted.length - 1],
  };
}

// ─── Trade events ──────────────────────────────────────────────────────────────

/**
 * Generate a batch of synthetic trade events around the current price.
 * Works for both orderbook-style and bonding-curve-style generation.
 */
export function generateTradeEvents(
  price: number,
  count: number,
  spread = 0.002,
): TradeEvent[] {
  const now = Date.now() / 1000;
  const events: TradeEvent[] = [];
  for (let i = 0; i < count; i++) {
    const isBuy = Math.random() > 0.5;
    const offset = Math.random() * spread * price;
    const eventPrice = isBuy ? price + offset : price - offset;
    // Power-law distributed size: many small, few large
    const size = Math.pow(Math.random(), 3) * 10 + 0.01;
    events.push({
      side: isBuy ? "buy" : "sell",
      price: eventPrice,
      size: Math.round(size * 100) / 100,
      time: now - (count - i) * 0.05,
    });
  }
  return events;
}

// ─── Bonding curve ─────────────────────────────────────────────────────────────

export interface BondingCurveState {
  supply: number;
  basePrice: number;
  initialSupply: number;
  exponent: number;
}

export function createBondingCurve(
  opts: Partial<BondingCurveState> = {},
): BondingCurveState {
  return {
    supply: opts.supply ?? 1000,
    basePrice: opts.basePrice ?? 100,
    initialSupply: opts.initialSupply ?? 1000,
    exponent: opts.exponent ?? 2,
  };
}

/** Price at current supply: basePrice * (supply / initialSupply) ^ exponent */
export function bondingPrice(state: BondingCurveState): number {
  return (
    state.basePrice *
    Math.pow(state.supply / state.initialSupply, state.exponent)
  );
}

/**
 * Simulate a buy or sell on the bonding curve.
 * Returns the updated state and a TradeEvent.
 */
export function bondingTrade(state: BondingCurveState): {
  state: BondingCurveState;
  event: TradeEvent;
} {
  const isBuy = Math.random() > 0.45; // slight buy bias for upward trend
  const amount = Math.pow(Math.random(), 2) * 20 + 1;
  const newSupply = isBuy
    ? state.supply + amount
    : Math.max(1, state.supply - amount);

  const newState = { ...state, supply: newSupply };
  const price = bondingPrice(newState);

  return {
    state: newState,
    event: {
      side: isBuy ? "buy" : "sell",
      price,
      size: Math.round(amount * 100) / 100,
      time: Date.now() / 1000,
    },
  };
}

// ─── Multi-series ──────────────────────────────────────────────────────────────

export interface MultiSeriesOptions {
  ids: string[];
  colors: string[];
  labels?: string[];
  count?: number;
  interval?: number;
  /** If true, values are constrained to sum to 100 (prediction market style) */
  sumToHundred?: boolean;
}

/**
 * Generate correlated random walks for multiple series.
 */
export function generateMultiSeries(
  opts: MultiSeriesOptions,
): SeriesConfig[] {
  const {
    ids,
    colors,
    labels,
    count = 150,
    interval = 0.2,
    sumToHundred = false,
  } = opts;
  const n = ids.length;
  const startTime = Date.now() / 1000 - count * interval;

  // Initialize starting values
  let values = sumToHundred
    ? Array(n).fill(100 / n)
    : Array.from({ length: n }, () => 30 + Math.random() * 40);

  const allData: LiveChartPoint[][] = ids.map(() => []);

  for (let t = 0; t < count; t++) {
    const time = startTime + t * interval;

    // Random walk each value
    const rawValues = values.map((v) => v + v * 0.004 * gaussianRandom());

    if (sumToHundred) {
      // Normalize to sum to 100, clamp to [0.5, 99]
      const sum = rawValues.reduce((a, b) => a + Math.max(0.5, b), 0);
      values = rawValues.map((v) => {
        const clamped = Math.max(0.5, v);
        return (clamped / sum) * 100;
      });
    } else {
      values = rawValues.map((v) => Math.max(0.01, v));
    }

    for (let i = 0; i < n; i++) {
      allData[i].push({ time, value: values[i] });
    }
  }

  return ids.map((id, i) => ({
    id,
    data: allData[i],
    value: values[i],
    color: colors[i],
    label: labels?.[i],
  }));
}

/**
 * Advance all series by one step. Mutates the series data arrays in place.
 */
export function stepMultiSeries(
  series: SeriesConfig[],
  sumToHundred = false,
): void {
  const now = Date.now() / 1000;
  const rawValues = series.map(
    (s) => s.value + s.value * 0.004 * gaussianRandom(),
  );

  let values: number[];
  if (sumToHundred) {
    const sum = rawValues.reduce((a, b) => a + Math.max(0.5, b), 0);
    values = rawValues.map((v) => (Math.max(0.5, v) / sum) * 100);
  } else {
    values = rawValues.map((v) => Math.max(0.01, v));
  }

  for (let i = 0; i < series.length; i++) {
    series[i].value = values[i];
    series[i].data = [...series[i].data, { time: now, value: values[i] }];
  }
}
