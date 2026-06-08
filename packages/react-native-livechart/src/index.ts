/**
 * Public API — stable exports for `react-native-livechart` consumers.
 *
 * @remarks Conceptually inspired by [liveline](https://github.com/benjitaylor/liveline)
 * (Benji Taylor) — live charts for React. This package is a separate React Native
 * implementation on Skia and Reanimated, not a fork of the web library.
 */

// ── Components ───────────────────────────────────────────────────────────────

import { LiveChart } from "./components/LiveChart";
import { LiveChartSeries } from "./components/LiveChartSeries";
import { LiveChartTransition } from "./components/LiveChartTransition";

export { LiveChart, LiveChartSeries, LiveChartTransition };
export type { LiveChartTransitionProps } from "./components/LiveChartTransition";

// ── Utilities ────────────────────────────────────────────────────────────────

export { formatTime, formatValue } from "./lib/format";
export { MONO_FONT_FAMILY } from "./lib/monoFontFamily";

// ── Optional hooks (degen / trade markers — see README) ───────────────────────

export { useDegen } from "./hooks/useDegen";
export { useTradeStream } from "./hooks/useTradeStream";

// ── Types ────────────────────────────────────────────────────────────────────

export type {
  BadgeConfig,
  BadgeMetrics,
  BadgeVariant,
  CandleMetrics,
  CandlePoint,
  ChartInsets,
  DegenOptions,
  DegenShakePayload,
  EmptyStateMetrics,
  FontConfig,
  FontWeight,
  GradientConfig,
  GridMetrics,
  GridStyleConfig,
  LeftEdgeFadeConfig,
  LegendConfig,
  LegendStyle,
  LineConfig,
  LiveChartCoreProps,
  LiveChartMetrics,
  LiveChartMetricsOverride,
  LiveChartPalette,
  LiveChartPoint,
  LiveChartProps,
  LiveChartSeriesProps,
  Marker,
  MarkerHoverEvent,
  MarkerKind,
  Momentum,
  MomentumConfig,
  MotionMetrics,
  MultiSeriesDotConfig,
  PulseConfig,
  ReferenceLine,
  ScrubConfig,
  ScrubPoint,
  ScrubPointCore,
  ScrubPointMulti,
  ScrubSeriesValue,
  SelectionDotConfig,
  SelectionDotProps,
  SelectionDotRingConfig,
  SeriesConfig,
  ThemeMode,
  TradeEvent,
  ValueLineConfig,
  XAxisConfig,
  YAxisConfig,
} from "./types";
