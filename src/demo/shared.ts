import type { VolatilityMode } from "../../sim/generators";
import type { TradeSource } from "../../sim/useSimulatedData";

export const ACCENT = "#3b82f6";

export const TIME_WINDOWS: { label: string; secs: number }[] = [
  { label: "30s", secs: 30 },
  { label: "1m", secs: 60 },
  { label: "5m", secs: 300 },
  { label: "1h", secs: 3_600 },
  { label: "24h", secs: 86_400 },
];

export const VOLATILITY_MODES: VolatilityMode[] = [
  "calm",
  "normal",
  "volatile",
  "chaotic",
];

export const TRADE_SOURCES: TradeSource[] = ["orderbook", "bonding-curve"];

export const PRICE_RANGES: { label: string; value: number }[] = [
  { label: "0.001", value: 0.001 },
  { label: "0.5", value: 0.5 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "1K", value: 1_000 },
  { label: "10K", value: 10_000 },
  { label: "67.5K", value: 67_500 },
  { label: "100K", value: 100_000 },
  { label: "1M", value: 1_000_000 },
  { label: "10M", value: 10_000_000 },
  { label: "100M", value: 100_000_000 },
];

export const SMOOTHING_PRESETS: { label: string; value: number }[] = [
  { label: "Sharp", value: 0 },
  { label: "Default", value: 0.08 },
  { label: "Smooth", value: 0.5 },
];

export const ACCENT_PRESETS = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#a855f7",
];
