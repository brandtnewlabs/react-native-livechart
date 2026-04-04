import type { SharedValue } from "react-native-reanimated";
import type { ViewStyle } from "react-native";

export interface LivelinePoint {
  time: number; // unix seconds
  value: number;
}

export type Momentum = "up" | "down" | "flat";
export type ThemeMode = "light" | "dark";
export type WindowStyle = "default" | "rounded" | "text";
export type BadgeVariant = "default" | "minimal";

export interface ReferenceLine {
  value: number;
  label?: string;
}

export interface ScrubPoint {
  time: number;
  /** Interpolated line value at the scrub position. */
  value: number;
  /** Screen X coordinate of the crosshair. */
  x: number;
  /** Screen Y coordinate of the value on the chart. */
  y: number;
  /** OHLC candle at the scrub time, present when `mode="candle"` (Phase 10). */
  candle?: CandlePoint;
}

/** @deprecated Use ScrubPoint */
export type HoverPoint = ScrubPoint;

export interface Padding {
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
  bids: [number, number][]; // [price, size][]
  asks: [number, number][]; // [price, size][]
}

export interface TradeEvent {
  side: "buy" | "sell";
  price: number;
  size: number;
  time: number;
}

export interface DegenOptions {
  /** Multiplier for particle count and size (default 1) */
  scale?: number;
  /** Show particles on down-momentum swings (default false) */
  downMomentum?: boolean;
}

export interface LivelineSeries {
  id: string;
  data: LivelinePoint[];
  value: number;
  color: string;
  label?: string;
}

export interface CandlePoint {
  time: number; // unix seconds — candle open time
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LivelineProps {
  data: SharedValue<LivelinePoint[]>;
  value: SharedValue<number>;

  series?: LivelineSeries[];

  theme?: ThemeMode;
  color?: string;

  window?: number;

  grid?: boolean;
  /** Minimum pixel gap between Y-axis grid lines (default 36). Higher = fewer labels. */
  gridMinGap?: number;
  badge?: boolean;
  /**
   * Tint live dot glow and badge from price direction (`true` = auto, `false` = neutral, or force `'up'|'down'|'flat'`).
   */
  momentum?: boolean | Momentum;
  fill?: boolean;
  loading?: boolean;
  paused?: boolean;
  emptyText?: string;
  scrub?: boolean;
  /** Show the value+time tooltip pill when scrubbing. Defaults to true. */
  scrubTooltip?: boolean;
  /** Show a dashed horizontal line tracking the live value, aligned with the badge. */
  valueLine?: boolean;
  exaggerate?: boolean;
  showValue?: boolean;
  valueMomentumColor?: boolean;
  degen?: boolean | DegenOptions;
  badgeTail?: boolean;

  windows?: WindowOption[];
  onWindowChange?: (secs: number) => void;
  windowStyle?: WindowStyle;

  badgeVariant?: BadgeVariant;

  tooltipY?: number;
  tooltipOutline?: boolean;

  orderbook?: OrderbookData;
  tradeEvents?: TradeEvent[];

  backgroundColor?: string;
  referenceLine?: ReferenceLine;
  /** Must include 'worklet' directive — called on the UI thread */
  formatValue?: (v: number) => string;
  /** Must include 'worklet' directive — called on the UI thread */
  formatTime?: (t: number) => string;
  lerpSpeed?: number;
  padding?: Padding;
  onScrub?: (point: ScrubPoint | null) => void;
  pulse?: boolean;
  lineWidth?: number;

  mode?: "line" | "candle";
  candles?: CandlePoint[];
  candleWidth?: number;
  liveCandle?: CandlePoint;
  lineMode?: boolean;
  lineData?: LivelinePoint[];
  lineValue?: number;
  onModeChange?: (mode: "line" | "candle") => void;
  onSeriesToggle?: (id: string, visible: boolean) => void;
  seriesToggleCompact?: boolean;

  style?: ViewStyle;
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
  pad: Required<Padding>;
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
