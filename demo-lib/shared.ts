import type { VolatilityMode } from "../sim/generators";
import {
  HISTORY_RANGE_SPAN_SECONDS,
  type HistoryRange,
} from "../sim/useSimulatedChartData";

export const ACCENT = "#3323E6";

/** Sim seed span presets (see `useSimulatedChartData` `historyRange`). */
export const HISTORY_RANGE_PRESETS: {
  label: string;
  preset: HistoryRange;
}[] = [
  { label: "1m", preset: "1m" },
  { label: "5m", preset: "5m" },
  { label: "1h", preset: "1h" },
  { label: "6h", preset: "6h" },
  { label: "1d", preset: "1d" },
  { label: "1w", preset: "1w" },
  { label: "1mo", preset: "1mo" },
  { label: "6mo", preset: "6mo" },
  { label: "1y", preset: "1y" },
];

/** Cap visible window so very long spans stay drawable; full history remains in buffer. */
export function viewportSecsForHistoryPreset(preset: HistoryRange): number {
  const span = HISTORY_RANGE_SPAN_SECONDS[preset];
  const cap = 7 * 86400;
  return span > cap ? cap : span;
}

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

export const ACCENT_PRESETS = [
  "#3323E6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#a855f7",
];
