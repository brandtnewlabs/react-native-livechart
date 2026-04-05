import type { ViewStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";

export interface LivelinePoint {
  time: number;
  value: number;
}

export type Momentum = "up" | "down" | "flat";

export type FontWeight =
  | "normal"
  | "bold"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900";
export type ThemeMode = "light" | "dark";
export type WindowStyle = "default" | "rounded" | "text";
export type BadgeVariant = "default" | "minimal";

export interface ReferenceLine {
  value: number;
  label?: string;
  strokeWidth?: number;
  intervals?: [number, number];
  color?: string;
}

export interface ValueLineConfig {
  strokeWidth?: number;
  intervals?: [number, number];
  color?: string;
}

export interface LineConfig {
  width?: number;
  color?: string;
}

export interface GradientConfig {
  topOpacity?: number;
  bottomOpacity?: number;
}

export interface BadgeConfig {
  variant?: BadgeVariant;
  tail?: boolean;
  background?: string;
  position?: "right" | "left";
}

export interface YAxisConfig {
  minGap?: number;
}

export interface XAxisConfig {
  minGap?: number;
}

export interface ScrubConfig {
  tooltip?: boolean;
}

export interface PulseConfig {
  interval?: number;
  duration?: number;
  maxRadius?: number;
  opacity?: number;
  strokeWidth?: number;
}

export interface FontConfig {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: FontWeight;
}

export interface ChartInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface WindowOption {
  label: string;
  secs: number;
}

export interface OrderbookData {
  bids: [number, number][];
  asks: [number, number][];
}

export interface TradeEvent {
  side: "buy" | "sell";
  price: number;
  size: number;
  time: number;
}

export interface DegenOptions {
  scale?: number;
  downMomentum?: boolean;
}

export interface LivelineSeries {
  id: string;
  data: LivelinePoint[];
  value: number;
  color?: string;
  label?: string;
  visible?: boolean;
}

export interface ScrubSeriesValue {
  id: string;
  label?: string;
  value: number;
}

export interface ScrubPointCore {
  time: number;
  value: number;
  x: number;
  y: number;
}

export interface ScrubPoint extends ScrubPointCore {
  candle?: CandlePoint;
}

export interface ScrubPointMulti extends ScrubPointCore {
  seriesValues: ScrubSeriesValue[];
}

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LivelineCoreProps {
  theme?: ThemeMode;
  accentColor?: string;
  font?: FontConfig;
  insets?: ChartInsets;
  style?: ViewStyle;
  timeWindow?: number;
  paused?: boolean;
  loading?: boolean;
  smoothing?: number;
  exaggerate?: boolean;
  emptyText?: string;
  formatValue?: (v: number) => string;
  formatTime?: (t: number) => string;
  yAxis?: boolean | YAxisConfig;
  xAxis?: boolean | XAxisConfig;
  referenceLine?: ReferenceLine;
  scrub?: boolean | ScrubConfig;
  line?: LineConfig;
}

export interface LivelineSingleProps extends LivelineCoreProps {
  gradient?: boolean | GradientConfig;
  badge?: boolean | BadgeConfig;
  momentum?: boolean | Momentum;
  pulse?: boolean | PulseConfig;
  valueLine?: boolean | ValueLineConfig;
  windows?: WindowOption[];
  windowStyle?: WindowStyle;
  onWindowChange?: (secs: number) => void;

  // ── Candlestick mode ──────────────────────────────────────────────────
  /** Chart display mode (default `"line"`). `"candle"` renders OHLC bars. */
  mode?: "line" | "candle";
  /** Committed OHLC bars, sorted by `time`. Must be a SharedValue for UI-thread reads. */
  candles?: SharedValue<CandlePoint[]>;
  /** Seconds per candle bucket (e.g. 60 for 1-minute bars). */
  candleWidth?: number;
  /** In-progress candle updated each tick. Must be a SharedValue for UI-thread reads. */
  liveCandle?: SharedValue<CandlePoint | null>;
  /** Morph candles into a line display (future — not wired in Phase 10). */
  lineMode?: boolean;
  /** Tick-level data for line-mode density during morph (future — not wired in Phase 10). */
  lineData?: LivelinePoint[];
  /** Current tick value for line-mode morph (future — not wired in Phase 10). */
  lineValue?: number;
  /** Callback when the built-in line/candle toggle fires (future — no built-in UI in Phase 10). */
  onModeChange?: (mode: "line" | "candle") => void;

  orderbook?: OrderbookData;
  tradeEvents?: TradeEvent[];
  degen?: boolean | DegenOptions;
  data: SharedValue<LivelinePoint[]>;
  value: SharedValue<number>;
  onScrub?: (point: ScrubPoint | null) => void;
}

export interface LivelineMultiProps extends LivelineCoreProps {
  series: SharedValue<LivelineSeries[]>;
  onSeriesToggle?: (id: string, visible: boolean) => void;
  seriesToggleCompact?: boolean;
  onScrub?: (point: ScrubPointMulti | null) => void;
}

export interface LivelinePalette {
  line: string;
  lineWidth: number;

  fillTop: string;
  fillBottom: string;

  gridLine: string;
  gridLabel: string;

  dotUp: string;
  dotDown: string;
  dotFlat: string;
  glowUp: string;
  glowDown: string;
  glowFlat: string;

  badgeOuterBg: string;
  badgeOuterShadow: string;
  badgeBg: string;
  badgeText: string;

  candleUp: string;
  candleDown: string;
  wickUp: string;
  wickDown: string;

  dashLine: string;

  refLine: string;
  refLabel: string;

  timeLabel: string;

  crosshairLine: string;
  tooltipBg: string;
  tooltipText: string;
  tooltipBorder: string;

  bgRgb: [number, number, number];

  labelFontSize: number;
  valueFontSize: number;
  badgeFontSize: number;
}

export interface ChartLayout {
  w: number;
  h: number;
  pad: Required<ChartInsets>;
  chartW: number;
  chartH: number;
  leftEdge: number;
  rightEdge: number;
  minVal: number;
  maxVal: number;
  valRange: number;
  toX: (t: number) => number;
  toY: (v: number) => number;
}
