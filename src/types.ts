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
  /** When `false`, particle bursts still run but the chart does not shake. Default `true`. */
  shake?: boolean;
  /** Multiplier on default shake amplitude (`1` matches built-in behavior). */
  shakeIntensity?: number;
  /** How long the shake envelope runs, in seconds. Default `0.45`. */
  shakeDurationSec?: number;
  /** Ring-buffer slots (clamped 4–80). Default `60`. */
  particleSlotCount?: number;
  /** How long each particle stays visible, in seconds. Default `1.0`. */
  particleBurstDurationSec?: number;
  /** Particles spawned per momentum burst (clamped 1–`particleSlotCount`). Default `20`. */
  burstParticleCount?: number;
  /** Velocity drag per frame (0–1, higher = less drag). Default `0.95`. */
  drag?: number;
  /** Minimum particle radius in pixels. Default `1`. */
  particleSizeMin?: number;
  /** Maximum particle radius in pixels. Default `2.2`. */
  particleSizeMax?: number;
  /** Peak particle opacity (0–1). Default `0.55`. */
  particleOpacity?: number;
  /** Angular spread in radians for the burst semicircle. Default `π * 1.2`. */
  spreadAngle?: number;
  /** Horizontal position jitter in pixels (±half). Default `24`. */
  positionJitterX?: number;
  /** Vertical position jitter in pixels (±half). Default `8`. */
  positionJitterY?: number;
  /** Minimum initial speed in px/s. Default `60`. */
  speedMin?: number;
  /** Maximum initial speed in px/s. Default `160`. */
  speedMax?: number;
  /**
   * Particle color(s). A single string or an array of colors.
   * When an array is provided, each particle picks one at random.
   * Default: chart accent / `palette.line`.
   */
  colors?: string | string[];
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
  /**
   * Live trade fills for optional on-chart markers. Read on the UI thread only —
   * pass a `SharedValue` and update from JS via `.value` (same pattern as `data` / `value`).
   */
  tradeStream?: SharedValue<TradeEvent[]>;
  /** Particle burst + chart shake on momentum swings (`true` = defaults, or pass `DegenOptions`). */
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
