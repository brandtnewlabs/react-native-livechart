import type { ViewStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import type {
  DataSourceParam,
  SkFontMgr,
  SkImage,
} from "@shopify/react-native-skia";

/** A single data point on the chart timeline. */
export interface LiveChartPoint {
  /** Unix timestamp in seconds. */
  time: number;
  /** Numeric value at this point in time. */
  value: number;
}

/** Direction of recent price movement, used for dot/badge coloring and degen effects. */
export type Momentum = "up" | "down" | "flat";

/** Fine-tune auto-detected momentum sensitivity. */
export interface MomentumConfig {
  /** Fraction of the lookback range the tail delta must exceed to register as directional. Default `0.12`. */
  threshold?: number;
  /** Number of recent data points used for range calculation. Default `20`. */
  lookback?: number;
}

/** Font weight values matching React Native's supported set. */
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

/** Color scheme for the chart background, grid, and derived palette colors. */
export type ThemeMode = "light" | "dark";

/**
 * Badge pill style.
 * - `"default"` — accent-colored background with white text.
 * - `"minimal"` — white/grey background with subdued text.
 */
export type BadgeVariant = "default" | "minimal";

/**
 * A reference line or band drawn into the chart. Three mutually-exclusive forms,
 * with precedence A > B > C when fields from more than one are present:
 * - **Form A** — horizontal line at `value`.
 * - **Form B** — horizontal band between `valueFrom` and `valueTo`.
 * - **Form C** — vertical time band between `from` and `to` (unix seconds).
 */
export interface ReferenceLine {
  /** Form A — the Y-axis value where the horizontal line is drawn. */
  value?: number;
  /** Form B — horizontal band lower Y bound (paired with `valueTo`). */
  valueFrom?: number;
  /** Form B — horizontal band upper Y bound (paired with `valueFrom`). */
  valueTo?: number;
  /** Form C — vertical time-band start, unix seconds (paired with `to`). */
  from?: number;
  /** Form C — vertical time-band end, unix seconds (paired with `from`). */
  to?: number;
  /** Optional right-gutter label (e.g. `"Entry"`). */
  label?: string;
  /**
   * Stroke thickness in pixels. For a line it's the line width (default `1`).
   * For a band, setting this also renders a dashed border along the band edges
   * (top/bottom for value bands, left/right for time bands); omit for no border.
   */
  strokeWidth?: number;
  /** Dash pattern as `[dashLength, gapLength]` in pixels (line stroke + band border). */
  intervals?: [number, number];
  /** Line / band color override. Defaults to palette `refLine`. */
  color?: string;
  /** Fill opacity for a value / time band (0–1). Default `0.16`. */
  fillOpacity?: number;
  /** Label text color. Defaults to `color`, then palette `refLabel`. */
  labelColor?: string;
  /**
   * Horizontal label placement. For a Form-A line: `"left" | "center" | "right"`
   * (default `"right"`, the legacy gutter position). For a band: `"left" | "right"`
   * (default `"left"`).
   */
  labelPosition?: "left" | "center" | "right";
  /** Append the formatted `value` to the label (Form A only). Default `false`. */
  showValue?: boolean;
  /**
   * Exclude this line's value(s) from the Y-axis range computation, so it may sit
   * off-axis instead of forcing the axis to expand. Per-line; other lines are
   * unaffected. Default `false`.
   */
  excludeFromRange?: boolean;
  /**
   * When a Form-A `value` falls outside the visible plot, render a pinned edge
   * badge with a directional chevron instead of culling the off-screen line.
   * Typically paired with `excludeFromRange`. Default `false`.
   */
  offAxisBadge?: boolean;
  /** Localized word shown in the off-axis badge (e.g. "Target"). Falls back to `label`. */
  offAxisBadgeLabel?: string;
  /** Off-axis badge pill background. Default: theme `tooltipBg`. */
  badgeBackground?: string;
  /** Off-axis badge pill border color. Default: the line `color`. */
  badgeBorderColor?: string;
  /** Off-axis badge pill corner radius in pixels. Default `5`. */
  badgeRadius?: number;
}

/** Per-instance grid-line styling for the horizontal value-axis grid. */
export interface GridStyleConfig {
  /** Stroke color. Defaults to palette `gridLine`. */
  color?: string;
  /** Stroke width in pixels. Default `1`. */
  strokeWidth?: number;
  /** Dash pattern as `[dash, gap, …]`. Default `[1, 3]` (dotted). Pass `[]` for solid. */
  intervals?: number[];
  /** Global alpha multiplier (0–1). Default `1`. */
  opacity?: number;
}

/** Configuration for the horizontal dashed line at the current live value. */
export interface ValueLineConfig {
  /** Line thickness in pixels. Default `1`. */
  strokeWidth?: number;
  /** Dash pattern as `[dashLength, gapLength]` in pixels. */
  intervals?: [number, number];
  /** Line color override. Defaults to palette `dashLine`. */
  color?: string;
}

/** Main chart line styling. */
export interface LineConfig {
  /** Stroke width of the main line in pixels. Default `2`. */
  width?: number;
  /** Line color override. Defaults to palette-derived accent. */
  color?: string;
}

/** Area fill gradient beneath the chart line. */
export interface GradientConfig {
  /** Opacity at the top of the gradient (near the line). Default `0.35`. */
  topOpacity?: number;
  /** Opacity at the bottom of the gradient. Default `0`. */
  bottomOpacity?: number;
}

/** Value badge pill configuration. */
export interface BadgeConfig {
  /** Visual style of the badge pill. Default `"default"`. */
  variant?: BadgeVariant;
  /** Show the pointed tail toward the live dot. Default `true`. */
  tail?: boolean;
  /** Badge background color override. */
  background?: string;
  /** Which side of the chart the badge appears on. Default `"right"`. */
  position?: "right" | "left";
}

/** Y-axis grid configuration. */
export interface YAxisConfig {
  /** Minimum pixel gap between grid lines. Default `36`. */
  minGap?: number;
}

/** X-axis (time) configuration. */
export interface XAxisConfig {
  /** Minimum pixel gap between time labels. Default `60`. */
  minGap?: number;
}

/** Crosshair scrub configuration. */
export interface ScrubConfig {
  /** Show the value/time tooltip pill while scrubbing. Default `true`. */
  tooltip?: boolean;
  /** Vertical crosshair line stroke. Omit to use theme `crosshairLine`. */
  crosshairLineColor?: string;
  /** Dimmed region fill to the right of the crosshair. Omit to use theme `crosshairDim`. */
  crosshairDimColor?: string;
}

/** Left-edge fade — soft erase so the chart blends into the left gutter (web liveline parity). */
export interface LeftEdgeFadeConfig {
  /**
   * Horizontal fade band in pixels; gradient runs from the chart inner edge (`padding.left`)
   * across this width. Default `40` (same as liveline).
   */
  width?: number;
  /**
   * Gradient color at the left (canvas edge side). With default `dstOut` blending, **alpha**
   * controls how strongly content is erased (opaque = full fade). When omitted, defaults match
   * the chart background RGB (`palette.bgRgb`) at alpha 1.
   */
  startColor?: string;
  /**
   * Gradient color at the right (chart side). When omitted, defaults to the same RGB as the
   * chart background at alpha 0 (no erase).
   */
  endColor?: string;
}

/** Pulsing ring animation on the live dot. */
export interface PulseConfig {
  /** Time between pulse starts in milliseconds. Default `2400`. */
  interval?: number;
  /** Duration of each pulse expansion in milliseconds. Default `1600`. */
  duration?: number;
  /** Maximum radius the pulse ring expands to in pixels. Default `20`. */
  maxRadius?: number;
  /** Peak opacity of the pulse ring (0–1). Default `0.4`. */
  opacity?: number;
  /** Stroke width of the pulse ring in pixels. Default `1.5`. */
  strokeWidth?: number;
}

/** Font configuration for chart labels, badges, and axis text. */
export interface FontConfig {
  /** Font family name. Default `"Menlo"`. */
  fontFamily?: string;
  /** Base font size in pixels. Default `11`. */
  fontSize?: number;
  /** Font weight. Default `"normal"`. */
  fontWeight?: FontWeight;
  /**
   * Load this typeface from a Metro asset or URI (`require("./Font.ttf")`, path string, or
   * `Uint8Array`). When set, Skia uses `useFont` for that file; `fontWeight` does not alter the
   * outlines (use a bold file or `fontManager` for multiple weights). While the asset loads,
   * the chart falls back to `matchFont` with `fontFamily` / defaults. Prefer either this or
   * `fontManager`, not both, unless you intentionally want a registered family as fallback.
   */
  typeface?: DataSourceParam;
  /**
   * Custom Skia font manager from `useFonts` (e.g. bundled `.ttf` files registered under family
   * names). Passed as the second argument to `matchFont`. When `null` or omitted, the system
   * font manager is used.
   */
  fontManager?: SkFontMgr | null;
}

/** Padding insets for the chart drawing area. */
export interface ChartInsets {
  /** Top padding in pixels. Default `12`. */
  top?: number;
  /** Right padding in pixels. Auto-calculated based on badge/grid presence. */
  right?: number;
  /** Bottom padding in pixels. Default `28`. */
  bottom?: number;
  /** Left padding in pixels. Default `12`. */
  left?: number;
}

/** A single trade fill event for on-chart markers. */
export interface TradeEvent {
  /** Trade direction. */
  side: "buy" | "sell";
  /** Execution price. */
  price: number;
  /** Trade size / quantity. */
  size: number;
  /** Unix timestamp in seconds. */
  time: number;
  /** Optional ticker symbol for simulated / custom feeds. */
  symbol?: string;
}

/** Built-in marker glyph kinds drawn into the chart canvas. */
export type MarkerKind = "trade" | "boost" | "graduation" | "winner" | "clawback";

/**
 * A marker rendered into the chart at `(time, y)`. Exactly one of `seriesId`
 * (anchor y to a series line at the marker's time, multi-series only) or
 * `value` (absolute y in data space) should be provided.
 */
export interface Marker {
  /** Stable identifier. */
  id: string;
  /** Unix timestamp in seconds. */
  time: number;
  /** Glyph kind. */
  kind: MarkerKind;
  /** Anchor y to this series' line at `time` (multi-series). */
  seriesId?: string;
  /** Absolute y value in data space (takes precedence over `seriesId`). */
  value?: number;
  /** Glyph color override. Defaults to a kind-specific palette accent. */
  color?: string;
  /**
   * Text / emoji glyph drawn centered at the marker, overriding the built-in
   * `kind` shape. Rendered with the chart font, so pass an emoji-capable font
   * (via `font`) if you use emoji.
   */
  icon?: string;
  /**
   * Image icon drawn centered at the marker (e.g. from Skia `useImage`). Takes
   * precedence over `icon` and the built-in `kind` shape.
   */
  image?: SkImage;
  /** Icon / image box size in px (icon font size or image width+height). Default `16`. */
  size?: number;
  /** Pass-through payload surfaced on `onMarkerHover`. */
  data?: unknown;
}

/** Payload for `onMarkerHover` — the marker and its screen position. */
export interface MarkerHoverEvent {
  marker: Marker;
  point: { x: number; y: number };
}

/** Particle burst + screen shake on momentum swings ("degen mode"). */
export interface DegenOptions {
  /** Scale multiplier for particle size and speed. Default `1`. */
  scale?: number;
  /** Also trigger on downward momentum (not just upward). Default `false`. */
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

/** Payload for {@link LiveChartProps.onDegenShake}. */
export interface DegenShakePayload {
  direction: "up" | "down";
}

/** Live dot configuration for multi-series charts. */
export interface MultiSeriesDotConfig {
  /** Dot radius in pixels. Default `3.5`. */
  radius?: number;
  /** Pulsing ring animation on each series dot. `true` = defaults, or pass `PulseConfig`. Default `true`. */
  pulse?: boolean | PulseConfig;
  /** Horizontal dashed line at each series' live value. `true` = defaults, or pass `ValueLineConfig`. Default `false`. */
  valueLine?: boolean | ValueLineConfig;
  /** Show series label (e.g. "Yes", "No") to the right of each dot. Default `true`. */
  valueLabel?: boolean;
}

/** Visual style overrides for the legend (toggle chips). All fields optional. */
export interface LegendStyle {
  /** Font size for chip labels (px). Default `13` (`11` when compact). */
  fontSize?: number;
  /** Chip corner radius (px). Default `8`. */
  borderRadius?: number;
  /** Colored swatch diameter (px). Default `8`. */
  dotSize?: number;
  /** Chip background when the series is visible. */
  activeBackground?: string;
  /** Chip background when the series is hidden. */
  hiddenBackground?: string;
  /** Label color when the series is visible. */
  activeColor?: string;
  /** Label color when the series is hidden. */
  hiddenColor?: string;
}

/** Legend (toggle chips) configuration for multi-series charts. */
export interface LegendConfig {
  /** Show the legend. Default `true`. */
  visible?: boolean;
  /** Show only colored dots in toggle chips (no text labels). Default `false`. */
  compact?: boolean;
  /** Position of the legend relative to the chart. Default `"top"`. */
  position?: "top" | "bottom";
  /** Visual style overrides for the chip row. */
  style?: LegendStyle;
}

/** Configuration for a single series in a multi-series chart. */
export interface SeriesConfig {
  /** Unique identifier for this series. */
  id: string;
  /** Array of data points for this series. */
  data: LiveChartPoint[];
  /** Latest (live) value for smooth interpolation. */
  value: number;
  /** Line color. Defaults to the built-in series color palette. */
  color?: string;
  /** Display label shown in toggle chips. */
  label?: string;
  /** Whether this series is visible. Default `true`. */
  visible?: boolean;
  /** Stroke style. `"dashed"` applies `intervals`. Default `"solid"`. */
  style?: "solid" | "dashed";
  /** Dash pattern as `[dashLength, gapLength]` when `style` is `"dashed"`. Default `[6, 4]`. */
  intervals?: [number, number];
  /** Per-series stroke width override (px). Falls back to the chart line width. */
  strokeWidth?: number;
  /** Render a soft glow behind this series' line. Default `false`. */
  glow?: boolean;
  /**
   * Semantic role. `"derived"` series (e.g. a conviction trajectory) render a
   * subdued / dashed legend chip. Default `"outcome"`.
   */
  kind?: "outcome" | "derived";
  /** Value text shown next to the label inside the legend chip. */
  valueLabel?: string;
}

/** Per-series value at a scrub position, used in the multi-series `onScrub` callback. */
export interface ScrubSeriesValue {
  /** Series identifier matching `SeriesConfig.id`. */
  id: string;
  /** Series label, if provided. */
  label?: string;
  /** Interpolated value at the scrub time for this series. */
  value: number;
}

/** Base fields shared by single and multi-series scrub callback payloads. */
export interface ScrubPointCore {
  /** Unix timestamp in seconds at the scrub position. */
  time: number;
  /** Interpolated value at the scrub position. */
  value: number;
  /** Canvas X coordinate of the crosshair. */
  x: number;
  /** Canvas Y coordinate of the interpolated value. */
  y: number;
}

/** Scrub callback payload for single-series charts. */
export interface ScrubPoint extends ScrubPointCore {
  /** In candle mode, the OHLC data of the candle under the crosshair. */
  candle?: CandlePoint;
}

/** Scrub callback payload for multi-series charts. */
export interface ScrubPointMulti extends ScrubPointCore {
  /** Interpolated values for each visible series at the scrub time. */
  seriesValues: ScrubSeriesValue[];
}

/** OHLC candlestick data for a single time bucket. */
export interface CandlePoint {
  /** Bucket start time as Unix timestamp in seconds. */
  time: number;
  /** Opening price. */
  open: number;
  /** Highest price during the bucket. */
  high: number;
  /** Lowest price during the bucket. */
  low: number;
  /** Closing price. */
  close: number;
}

// ── Component Props ──────────────────────────────────────────────────────────

/** Props shared between `LiveChart` and `LiveChartSeries`. */
export interface LiveChartCoreProps {
  /** Color scheme. Default `"dark"`. */
  theme?: ThemeMode;
  /** Primary accent color — the full palette is derived from this. Default `"#3b82f6"`. */
  accentColor?: string;
  /** Font configuration for all chart text (axes, badges, tooltips). */
  font?: FontConfig;
  /** Padding overrides for the chart drawing area. */
  insets?: ChartInsets;
  /** Container View style. */
  style?: ViewStyle;
  /** Visible time window in seconds. Default `30`. */
  timeWindow?: number;
  /** Freeze chart scrolling. Resume catches up to real time. Default `false`. */
  paused?: boolean;
  /**
   * Breathing-line loading shell. When this becomes `false`, the chart reveals
   * only if there is data (≥2 line points or ≥2 committed candles).
   */
  loading?: boolean;
  /**
   * Value-lerp speed — how quickly the drawn value, time window, and Y-range chase
   * their targets each frame (0 = frozen, 1 = instant). Equivalent to liveline's
   * `lerpSpeed`. Default `0.08`.
   */
  smoothing?: number;
  /** Tight Y-axis — small value moves fill the full chart height. Default `false`. */
  exaggerate?: boolean;
  /**
   * Clamp the Y-axis lower bound at 0 (prices, market caps, volumes) so the axis
   * never shows negative ticks when data collapses toward zero. Default `false`.
   */
  nonNegative?: boolean;
  /**
   * Hard upper bound for the Y-axis range. Use for axes with a ceiling (e.g. market
   * share ≤ `1`); the margin added above the data is capped here. Omit for unbounded
   * axes (prices, market caps).
   */
  maxValue?: number;
  /**
   * Label in the empty state when `loading` is false and there are fewer than
   * two samples (line points or committed candles). Default `"No data"`.
   */
  emptyText?: string;
  /** Custom formatter for value labels (axes, badge, tooltips). Default `v => v.toFixed(2)`. */
  formatValue?: (v: number) => string;
  /** Custom formatter for time labels. Default renders `HH:MM:SS`. */
  formatTime?: (t: number) => string;
  /** Y-axis grid lines + labels. `true` = defaults, `false` = hidden, or pass `YAxisConfig`. Default `true`. */
  yAxis?: boolean | YAxisConfig;
  /** X-axis time labels. `true` = defaults, `false` = hidden, or pass `XAxisConfig`. Default `true`. */
  xAxis?: boolean | XAxisConfig;
  /**
   * Single horizontal reference line at a fixed value.
   * @deprecated Use `referenceLines` (supports multiple lines and bands). When both
   * are set, this line is merged into the `referenceLines` array.
   */
  referenceLine?: ReferenceLine;
  /** Reference lines / bands drawn into the chart. Supports all three `ReferenceLine` forms. */
  referenceLines?: ReferenceLine[];
  /** Per-instance grid-line styling. Pass an object to override color / width / dash / opacity. */
  gridStyle?: GridStyleConfig;
  /**
   * Markers drawn into the chart canvas. Read on the UI thread — pass a
   * `SharedValue` and update via `.value` (same pattern as `data`).
   */
  markers?: SharedValue<Marker[]>;
  /** Fires when a marker is tapped; `null` when a tap misses every marker. */
  onMarkerHover?: (event: MarkerHoverEvent | null) => void;
  /** Tap hit-test radius in px. Default `16` (≈ 44px touch target with the glyph). */
  markerHitRadius?: number;
  /**
   * Override individual resolved-palette keys on top of the palette derived from
   * `accentColor` + `theme`. Only the keys you set are replaced.
   */
  palette?: Partial<LiveChartPalette>;
  /** Crosshair scrubbing on hover/drag. `true` = defaults, `false` = disabled, or pass `ScrubConfig`. Default `true`. */
  scrub?: boolean | ScrubConfig;
  /**
   * Fade out chart content on the left (destination-out style). `true` = defaults, `false` = off,
   * or pass `LeftEdgeFadeConfig`. Default `true`.
   */
  leftEdgeFade?: boolean | LeftEdgeFadeConfig;
  /** Main chart line styling. */
  line?: LineConfig;
}

/** Props for the single-series `LiveChart` component. */
export interface LiveChartProps extends LiveChartCoreProps {
  /** Area gradient fill under the line. `true` = defaults, or pass `GradientConfig`. Default `true`. */
  gradient?: boolean | GradientConfig;
  /** Value badge pill at the chart tip. `true` = defaults, or pass `BadgeConfig`. Default `true`. */
  badge?: boolean | BadgeConfig;
  /**
   * Momentum-based dot/badge coloring.
   * - `true` — auto-detect from data (default).
   * - `false` — disabled, always flat.
   * - `"up"` / `"down"` / `"flat"` — forced value.
   * - `MomentumConfig` — auto-detect with custom sensitivity.
   */
  momentum?: boolean | Momentum | MomentumConfig;
  /** Pulsing ring animation on the live dot. `true` = defaults, or pass `PulseConfig`. Default `true`. */
  pulse?: boolean | PulseConfig;
  /** Horizontal dashed line at the current live value. `true` = defaults, or pass `ValueLineConfig`. */
  valueLine?: boolean | ValueLineConfig;

  // ── Candlestick mode ──────────────────────────────────────────────────
  /** Chart display mode (default `"line"`). `"candle"` renders OHLC bars. */
  mode?: "line" | "candle";
  /** Committed OHLC bars, sorted by `time`. Must be a SharedValue for UI-thread reads. */
  candles?: SharedValue<CandlePoint[]>;
  /** Seconds per candle bucket (e.g. 60 for 1-minute bars). */
  candleWidth?: number;
  /** In-progress candle updated each tick. Must be a SharedValue for UI-thread reads. */
  liveCandle?: SharedValue<CandlePoint | null>;
  /**
   * Live trade fills for optional on-chart markers. Read on the UI thread only —
   * pass a `SharedValue` and update from JS via `.value` (same pattern as `data` / `value`).
   */
  tradeStream?: SharedValue<TradeEvent[]>;
  /** Particle burst + chart shake on momentum swings (`true` = defaults, or pass `DegenOptions`). */
  degen?: boolean | DegenOptions;

  // ── Data ───────────────────────────────────────────────────────────────
  /** Growing array of data points. Must be a SharedValue for UI-thread reads. */
  data: SharedValue<LiveChartPoint[]>;
  /** Latest live value for smooth interpolation between data updates. */
  value: SharedValue<number>;
  /** Called when the user scrubs the crosshair. `null` when scrub ends. */
  onScrub?: (point: ScrubPoint | null) => void;
  /**
   * Called on the JS thread when degen chart shake starts (momentum swing with shake enabled).
   * Not called when `degen` is off or `DegenOptions.shake` is `false`.
   */
  onDegenShake?: (payload: DegenShakePayload) => void;
}

/** Props for the multi-series `LiveChartSeries` component. */
export interface LiveChartSeriesProps extends LiveChartCoreProps {
  /** Array of series definitions. Must be a SharedValue for UI-thread reads. */
  series: SharedValue<SeriesConfig[]>;
  /** Called when a series toggle chip is tapped. */
  onSeriesToggle?: (id: string, visible: boolean) => void;
  /**
   * Show only colored dots in toggle chips (no text labels). Default `false`.
   * @deprecated Use `legend={{ compact: true }}` instead.
   */
  seriesToggleCompact?: boolean;
  /** Live dot configuration (radius, pulse, value line, inline labels). */
  dot?: MultiSeriesDotConfig;
  /** Legend (toggle chips) configuration. `true` = defaults, `false` = hidden, or pass `LegendConfig`. Default `true`. */
  legend?: boolean | LegendConfig;
  /**
   * Degen mode — chart shake + a spark burst off the leading series' dot on an
   * upward momentum swing. `true` = defaults, or pass `DegenOptions`. Default off.
   */
  degen?: boolean | DegenOptions;
  /** Called on the JS thread when a degen chart shake starts. */
  onDegenShake?: (payload: DegenShakePayload) => void;
  /**
   * Worklet callback fired on the UI thread each frame while scrubbing.
   * `null` when scrub ends. Update shared values directly — no bridge overhead.
   *
   * ```ts
   * const scrubData = useSharedValue<ScrubPointMulti | null>(null);
   * <LiveChartSeries
   *   scrub
   *   onScrub={(point) => {
   *     "worklet";
   *     scrubData.value = point;
   *   }}
   * />
   * ```
   */
  onScrub?: (point: ScrubPointMulti | null) => void;
}

// ── Internal / Theme ─────────────────────────────────────────────────────────

/**
 * Full resolved color palette derived from `accentColor` + `theme`.
 * Exposed for advanced theming — most users do not need this directly.
 */
export interface LiveChartPalette {
  /** Main chart line color. */
  line: string;
  /** Chart line stroke width. */
  lineWidth: number;

  /** Gradient fill top color (with opacity). */
  fillTop: string;
  /** Gradient fill bottom color (with opacity). */
  fillBottom: string;

  /** Grid line color. */
  gridLine: string;
  /** Grid / axis label color. */
  gridLabel: string;

  /** Live dot color when momentum is up. */
  dotUp: string;
  /** Live dot color when momentum is down. */
  dotDown: string;
  /** Live dot color when momentum is flat. */
  dotFlat: string;
  /** Dot glow color when momentum is up. */
  glowUp: string;
  /** Dot glow color when momentum is down. */
  glowDown: string;
  /** Dot glow color when momentum is flat. */
  glowFlat: string;

  /** Badge outer background (ring behind the pill). */
  badgeOuterBg: string;
  /** Badge outer shadow color. */
  badgeOuterShadow: string;
  /** Badge pill background color. */
  badgeBg: string;
  /** Badge text color. */
  badgeText: string;

  /** Bullish candle body color. */
  candleUp: string;
  /** Bearish candle body color. */
  candleDown: string;
  /** Bullish wick color. */
  wickUp: string;
  /** Bearish wick color. */
  wickDown: string;

  /** Value line (dashed) color. */
  dashLine: string;

  /** Reference line color. */
  refLine: string;
  /** Reference line label color. */
  refLabel: string;

  /** X-axis time label color. */
  timeLabel: string;

  /** Crosshair vertical line color. */
  crosshairLine: string;
  /** Dimmed overlay to the right of the crosshair while scrubbing. */
  crosshairDim: string;
  /** Tooltip pill background color. */
  tooltipBg: string;
  /** Tooltip text color. */
  tooltipText: string;
  /** Tooltip border/outline color. */
  tooltipBorder: string;

  /** Chart background as RGB triple (for color mixing). */
  bgRgb: [number, number, number];

  /** Font size for axis labels. */
  labelFontSize: number;
  /** Font size for the large value overlay. */
  valueFontSize: number;
  /** Font size for badge text. */
  badgeFontSize: number;
}
