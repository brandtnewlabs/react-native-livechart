import type { SharedValue } from "react-native-reanimated";
import type { ViewStyle } from "react-native";

export interface LivelinePoint {
  time: number; // unix seconds
  value: number;
}

export type Momentum = "up" | "down" | "flat";

/** Font weight values accepted by Skia's matchFont (subset of RN's TextStyle.fontWeight). */
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
  /** Stroke width of the dashed line (default 1). */
  strokeWidth?: number;
  /** Dash on/off intervals in pixels (default [4, 4]). */
  intervals?: [number, number];
  /** Line and label color — overrides the palette default. */
  color?: string;
}

export interface ValueLineConfig {
  /** Stroke width of the dashed line (default 1). */
  strokeWidth?: number;
  /** Dash on/off intervals in pixels (default [4, 4]). */
  intervals?: [number, number];
  /** Line color — overrides palette.dashLine. */
  color?: string;
}

export interface LineConfig {
  /** Stroke width in pixels (default 2). */
  width?: number;
  /**
   * Override the line color independently of accentColor.
   * When unset, the line uses accentColor.
   */
  color?: string;
}

export interface GradientConfig {
  /**
   * Opacity of accentColor at the top of the gradient.
   * When unset, uses the theme default (0.12 dark / 0.08 light).
   */
  topOpacity?: number;
  /** Opacity of accentColor at the bottom of the gradient (default 0). */
  bottomOpacity?: number;
}

export interface BadgeConfig {
  /** Visual style of the badge pill (default "default"). */
  variant?: BadgeVariant;
  /**
   * Show the pointed tail connecting the pill to the live dot (default true).
   * Only applies when position is "right"; ignored for "left".
   */
  tail?: boolean;
  /** Pin the badge background to a fixed color — disables momentum tinting when set. */
  background?: string;
  /**
   * Which gutter the badge renders in (default "right").
   *
   * "right": pill sits in the right gutter, connected to the live dot by a tail.
   *          padding.right auto-sizes to fit it.
   *
   * "left":  pill renders as a standalone price-label in the LEFT gutter,
   *          tracking the same Y as the live price. No tail.
   *          padding.left auto-sizes; padding.right shrinks to grid-label width
   *          (or 12 px if grid is also off), allowing the chart line to fill the
   *          right edge.
   */
  position?: "right" | "left";
}

export interface YAxisConfig {
  /** Minimum pixel gap between Y-axis grid lines (default 36). Higher = fewer labels. */
  minGap?: number;
}

export interface XAxisConfig {
  /** Minimum pixel gap between time labels (default 60). */
  minGap?: number;
}

export interface ScrubConfig {
  /** Show the value+time tooltip pill when scrubbing (default true). */
  tooltip?: boolean;
}

export interface PulseConfig {
  /** Time between pulse rings in milliseconds (default 1500). */
  interval?: number;
  /** How long each ring takes to expand and fade in milliseconds (default 900). */
  duration?: number;
  /** Maximum radius the ring expands to in pixels (default 21). */
  maxRadius?: number;
  /** Peak opacity of the ring at the start of each pulse (default 0.35). */
  opacity?: number;
  /** Stroke width of the ring in pixels (default 1.5). */
  strokeWidth?: number;
}

export interface FontConfig {
  /**
   * Font family for all chart labels — grid, time axis, badge, tooltip.
   * Defaults to `"Menlo"` on iOS and `"monospace"` on Android/web.
   */
  fontFamily?: string;
  /** Label font size in pixels (default 11). */
  fontSize?: number;
  /** Font weight passed to Skia's matchFont (default "500"). */
  fontWeight?: FontWeight;
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

/** Insets reserved around the chart drawing area for labels and overlays. */
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
  // ── Data ─────────────────────────────────────────────────────────────────
  /** Reanimated shared value containing the historical data points. Updated from your data source on every tick. */
  data: SharedValue<LivelinePoint[]>;
  /** Reanimated shared value for the current live price. Drives the animated tip of the chart line. */
  value: SharedValue<number>;

  // ── Appearance ───────────────────────────────────────────────────────────
  /** Color scheme applied to grid, badge, crosshair and background (default `"dark"`). */
  theme?: ThemeMode;
  /** The accent color driving the line, gradient fill, badge and dot glow (default `"#3b82f6"`). */
  accentColor?: string;
  /** Area gradient fill under the line. `true` = on with defaults, or pass `GradientConfig` to customise opacities. */
  gradient?: boolean | GradientConfig;
  /** Chart line appearance. Pass `LineConfig` to override stroke width or color independently of `accentColor`. */
  line?: LineConfig;
  /** Customise the label font used throughout the chart — grid, time axis, badge and tooltip. */
  font?: FontConfig;
  /**
   * Override chart insets (space reserved for axis labels and overlays). Auto-sized by default.
   * Only needed when the auto-sizing doesn't fit your layout — e.g. to pin the right gutter
   * width for external label alignment.
   */
  insets?: ChartInsets;
  /**
   * Style applied to the outer View container. Use `style.backgroundColor` to override the
   * theme-derived chart background — it takes priority via React Native's style-array merge.
   */
  style?: ViewStyle;

  // ── Behaviour ────────────────────────────────────────────────────────────
  /** Time range displayed in seconds (default `30`). Controls how much history is visible. */
  timeWindow?: number;
  /** Freeze the chart in place — stops the timestamp from advancing (default `false`). */
  paused?: boolean;
  /** Show the loading/empty state — breathing squiggly morphs to real data on reveal (default `false`). */
  loading?: boolean;
  /**
   * Animation smoothing factor — controls how quickly displayed values lerp toward their targets
   * (default `0.08`). Lower = smoother but laggier; higher = snappier but less fluid.
   */
  smoothing?: number;
  /**
   * Tighten the Y-axis range so even small price moves fill the full chart height (default `false`).
   * Useful for assets with low absolute volatility.
   */
  exaggerate?: boolean;
  /** Text shown when `loading` is true and no data has arrived yet (default `"No data"`). */
  emptyText?: string;
  /**
   * Custom value formatter for grid labels, badge and tooltip.
   * Must include the `'worklet'` directive — it is called on the UI thread.
   */
  formatValue?: (v: number) => string;
  /**
   * Custom time formatter for the time axis and scrub tooltip.
   * Must include the `'worklet'` directive — it is called on the UI thread.
   */
  formatTime?: (t: number) => string;

  // ── Overlays ─────────────────────────────────────────────────────────────
  /** Y-axis grid lines and labels. `true` = on with defaults, or pass `YAxisConfig` to customise label density. */
  yAxis?: boolean | YAxisConfig;
  /** X-axis time labels along the bottom. `true` = on with defaults, or pass `XAxisConfig` to customise. */
  xAxis?: boolean | XAxisConfig;
  /**
   * Live-value badge pill tracking the current price on the Y-axis.
   * `true` = on with defaults, or pass `BadgeConfig` to set variant, tail, position or a fixed background color.
   */
  badge?: boolean | BadgeConfig;
  /**
   * Tint live dot glow and badge from price direction.
   * `true` = auto-detect, `false` = neutral (accent color), or force `'up'|'down'|'flat'`.
   */
  momentum?: boolean | Momentum;
  /** Expanding pulse ring around the live dot. `true` = on with defaults, or pass `PulseConfig` to customise timing and size. */
  pulse?: boolean | PulseConfig;
  /** Dashed horizontal line tracking the live value, aligned with the badge. `true` = on with defaults, or pass `ValueLineConfig` to customise. */
  valueLine?: boolean | ValueLineConfig;
  /** Fixed horizontal reference line at a specific value with an optional label. */
  referenceLine?: ReferenceLine;
  /** Touch-and-drag crosshair for scrubbing historical values. `true` = on with defaults, or pass `ScrubConfig` to customise. */
  scrub?: boolean | ScrubConfig;

  // ── Callbacks ────────────────────────────────────────────────────────────
  /** Called on the JS thread when the scrub position changes. Receives `null` when scrubbing ends. */
  onScrub?: (point: ScrubPoint | null) => void;

  // ── Future phases (not yet implemented) ──────────────────────────────────
  /** @remarks Phase 7 — time window selector UI */
  windows?: WindowOption[];
  /** @remarks Phase 7 */
  windowStyle?: WindowStyle;
  /** @remarks Phase 7 */
  onWindowChange?: (secs: number) => void;
  /** @remarks Phase 9 — multi-series */
  series?: LivelineSeries[];
  /** @remarks Phase 9 */
  onSeriesToggle?: (id: string, visible: boolean) => void;
  /** @remarks Phase 9 */
  seriesToggleCompact?: boolean;
  /** @remarks Phase 10 — candlestick mode */
  mode?: "line" | "candle";
  /** @remarks Phase 10 */
  candles?: CandlePoint[];
  /** @remarks Phase 10 */
  candleWidth?: number;
  /** @remarks Phase 10 */
  liveCandle?: CandlePoint;
  /** @remarks Phase 10 */
  lineMode?: boolean;
  /** @remarks Phase 10 */
  lineData?: LivelinePoint[];
  /** @remarks Phase 10 */
  lineValue?: number;
  /** @remarks Phase 10 */
  onModeChange?: (mode: "line" | "candle") => void;
  /** @remarks Phase 11 — trade stream */
  orderbook?: OrderbookData;
  /** @remarks Phase 11 */
  tradeEvents?: TradeEvent[];
  /** @remarks Phase 11 — degen effects */
  degen?: boolean | DegenOptions;
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
