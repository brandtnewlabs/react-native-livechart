import type { ComponentType } from "react";
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
  /**
   * Opacity of the chart content to the *right* of the crosshair (the "future")
   * while scrubbing — `0` fully fades it out, `1` disables the dim. Implemented
   * by erasing the content's alpha (`dstOut`), so it reveals the real background
   * and works on any background color. Default `0.3`. Ignored when
   * `crosshairDimColor` is set (that uses the legacy colored mask instead).
   */
  dimOpacity?: number;
  /** Vertical crosshair line stroke. Omit to use theme `crosshairLine`. */
  crosshairLineColor?: string;
  /**
   * Legacy: fill the region right of the crosshair with this solid (usually
   * semi-transparent) color — a mask painted *over* the chart, so it only looks
   * right when it matches the background. Prefer `dimOpacity`. When set, it
   * overrides the `dimOpacity` fade.
   */
  crosshairDimColor?: string;
  /** Tooltip pill background. Omit to use theme `tooltipBg`. */
  tooltipBackground?: string;
  /** Tooltip text color. Omit to use theme `tooltipText`. */
  tooltipColor?: string;
  /** Tooltip pill border color. Omit to use theme `tooltipBorder`. */
  tooltipBorderColor?: string;
  /**
   * Press-and-hold delay in milliseconds before scrubbing activates — think of
   * it as "press and hold to scrub." During the delay the pan is not captured,
   * so a quick horizontal swipe falls through to a parent gesture (e.g. a
   * navigator's swipe-back-to-previous-route). `0` = scrub immediately on drag.
   * Default `0`.
   */
  panGestureDelay?: number;
}

/**
 * Props passed to a custom {@link SelectionDotConfig.component} — the dot drawn
 * at the scrub intersection while scrubbing. All positional inputs are
 * SharedValues so the dot animates on the UI thread without re-renders.
 */
export interface SelectionDotProps {
  /** Scrub X in canvas px. */
  x: SharedValue<number>;
  /** Scrub Y in canvas px (the line/value intersection). */
  y: SharedValue<number>;
  /** Whether scrubbing is active. */
  active: SharedValue<boolean>;
  /** Crosshair fade opacity (0..1), already ramped. */
  opacity: SharedValue<number>;
  /** Resolved dot color (accent/series color). */
  color: string;
  /** Suggested dot radius in px. */
  size: number;
}

/** Outer ring drawn around the built-in selection dot (the subtle halo). */
export interface SelectionDotRingConfig {
  /** Ring color. Defaults to the dot color. */
  color?: string;
  /** Ring thickness in pixels — how far the halo extends past the dot. Default `2`. */
  width?: number;
}

/**
 * Selection-dot styling — the dot drawn at the scrub intersection while
 * scrubbing. Pass `selectionDot={false}` to hide it, an object to configure the
 * built-in dot, or `{ component }` to supply a fully custom Skia dot.
 */
export interface SelectionDotConfig {
  /** Dot radius in px. Default `4`. */
  size?: number;
  /** Dot color. Defaults to the line / leading-series color. */
  color?: string;
  /**
   * Outer ring around the dot. `true`/config = on, `false` = off. Default on.
   */
  ring?: boolean | SelectionDotRingConfig;
  /**
   * Fully custom Skia dot — receives the scrub position as SharedValues. When
   * set, the `size` / `color` / `ring` knobs are ignored.
   */
  component?: ComponentType<SelectionDotProps>;
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
  /**
   * Absolute y value in data space. Takes precedence over `seriesId`. Omit it on
   * a single-series chart to anchor the marker to the line at `time`
   * (interpolated from the chart's `data`) — so the glyph always sits on the line.
   */
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
  /**
   * Draw the `icon` inside a filled circular badge in the marker `color` (icon
   * rendered in white) — e.g. a green `+` buy / red `−` sell tag. Requires
   * `icon`; ignored without it. The badge sizes itself to the icon glyph.
   */
  pill?: boolean;
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

/** Contrasting outer ring drawn behind each series dot — the "haloed" look the
 *  single-series live dot has, so dots stand out against the lines and one
 *  another. */
export interface DotRingConfig {
  /** Ring color. Default: theme `badgeOuterBg` (a near-background halo). */
  color?: string;
  /** Ring thickness in pixels — how far the halo extends past the dot. Default `2.5`. */
  width?: number;
}

/**
 * Shared live-dot styling, used by both `LiveChart` (`dot`) and
 * `LiveChartSeries` (`dot`, which extends this). A dot is a color-filled circle
 * of `radius` with an optional contrasting outer `ring` (halo).
 */
export interface DotConfig {
  /** Radius of the (color-filled) dot in pixels. Default `3.5`. */
  radius?: number;
  /**
   * Contrasting outer ring (halo) behind the dot, so it reads clearly against
   * the line(s). `true` = defaults, `false` = a flat circle, or pass
   * `DotRingConfig`. Default `true`.
   */
  ring?: boolean | DotRingConfig;
  /**
   * Show the dot. `false` hides it (line, badge, and labels still render). Default `true`.
   *
   * @deprecated Pass `dot={false}` to hide the dot — the uniform `boolean | Config`
   * convention. `show` still works and is equivalent to `dot={{ show: false }}`.
   */
  show?: boolean;
  /** Dot fill color. Defaults to the chart line color (per series for multi-series). */
  color?: string;
}

/** Live dot configuration for multi-series charts (extends the shared {@link DotConfig}). */
export interface MultiSeriesDotConfig extends DotConfig {
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
  /** Use a smaller, denser chip layout (tighter padding + font). Default `false`. */
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

// ── Metrics (sizing & motion tokens) ─────────────────────────────────────────

/**
 * Spatial sizing & motion tokens — the geometry/timing analogue of
 * {@link LiveChartPalette}. Where `palette` controls *color*, `metrics` controls
 * *shape* (badge geometry, candle bounds) and *feel* (fade/lerp speeds). Override
 * via the `metrics` prop; only the namespaces/keys you set are replaced.
 */
export interface LiveChartMetrics {
  /** Value-badge pill geometry. */
  badge: BadgeMetrics;
  /** Candlestick body/wick geometry. */
  candle: CandleMetrics;
  /** Grid + axis-label fade animation. */
  grid: GridMetrics;
  /** Per-frame lerp speeds for value/color transitions. */
  motion: MotionMetrics;
  /** Empty-state (no-data) layout. */
  emptyState: EmptyStateMetrics;
}

/** Value-badge pill geometry (the "metrics" analogue of badge colors). */
export interface BadgeMetrics {
  /** Horizontal padding inside the pill, each side of the label. Default `10`. */
  padX: number;
  /** Vertical padding above and below the label. Default `3`. */
  padY: number;
  /** Length of the pointed tail toward the live dot. Default `5`. */
  tailLength: number;
  /** Gap between the pill's outer edge and the canvas edge. Default `4`. */
  marginEdge: number;
  /** Gap between the live dot and the badge tail tip. Default `12`. */
  dotGap: number;
  /** Vertical spread of the tail curve's control points. Default `2.5`. */
  tailSpread: number;
}

/** Candlestick body/wick geometry. */
export interface CandleMetrics {
  /** Minimum candle body height in pixels (so dojis stay visible). Default `1`. */
  minBodyPx: number;
  /** Maximum candle body width in pixels. Default `40`. */
  maxBodyPx: number;
  /** Body width as a fraction of the per-candle slot width (0–1). Default `0.8`. */
  bodyWidthRatio: number;
}

/** Grid-line and axis-label fade animation speeds. */
export interface GridMetrics {
  /** Per-frame alpha lerp speed when a grid line / label fades in. Default `0.18`. */
  fadeInSpeed: number;
  /** Per-frame alpha lerp speed when a grid line / label fades out. Default `0.12`. */
  fadeOutSpeed: number;
}

/** Per-frame lerp speeds for value/color transitions. */
export interface MotionMetrics {
  /** Per-frame lerp speed for the badge background color transition. Default `0.08`. */
  badgeColorSpeed: number;
  /** Extra catch-up speed added to `smoothing` when the live value lags its target. Default `0.12`. */
  adaptiveSpeedBoost: number;
}

/** Empty-state (no-data) layout. */
export interface EmptyStateMetrics {
  /** Opacity of the empty-state label. Default `0.35`. */
  labelOpacity: number;
  /** Half-padding (px) around the empty text for the squiggle "gap" erase band. Default `20`. */
  gapPad: number;
  /** Horizontal fade width (px) on each side of the empty-text gap. Default `30`. */
  gapFadeWidth: number;
}

/**
 * Caller-supplied `metrics` override — every namespace and field is optional, and
 * only the keys you set replace the resolved default (per-namespace shallow merge,
 * same model as `palette`).
 */
export interface LiveChartMetricsOverride {
  badge?: Partial<BadgeMetrics>;
  candle?: Partial<CandleMetrics>;
  grid?: Partial<GridMetrics>;
  motion?: Partial<MotionMetrics>;
  emptyState?: Partial<EmptyStateMetrics>;
}

// ── Component Props ──────────────────────────────────────────────────────────

/** Props shared between `LiveChart` and `LiveChartSeries`. */
export interface LiveChartCoreProps {
  /** Color scheme. Default `"dark"`. */
  theme?: ThemeMode;
  /** Primary accent color — the full palette is derived from this. Default `"#3323E6"`. */
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
  /**
   * Override sizing & motion tokens — the geometry/feel analogue of `palette`.
   * Namespaced (`badge`, `candle`, `grid`, `motion`, `emptyState`); only the keys
   * you set are replaced. See {@link LiveChartMetrics}.
   */
  metrics?: LiveChartMetricsOverride;
  /**
   * Right-edge buffer as a fraction of `timeWindow`. Pushes the live edge past the
   * current time so the latest point has breathing room; pass `0` to land the latest
   * point exactly at the right edge. Default `0`.
   */
  windowBuffer?: number;
  /**
   * Override the engine's "now" (unix seconds). Pass the latest data timestamp to
   * treat the most recent point as the current time — combine with `windowBuffer={0}`
   * and `timeWindow = maxT - minT` to fill the canvas edge-to-edge with historical data.
   */
  nowOverride?: number;
  /** Accessibility label for the chart container. */
  accessibilityLabel?: string;
  /** Accessibility role for the chart container. Default `"image"`. */
  accessibilityRole?: "image" | "none" | "adjustable" | "summary";
  /** Crosshair scrubbing on hover/drag. `true` = defaults, `false` = disabled, or pass `ScrubConfig`. Default `true`. */
  scrub?: boolean | ScrubConfig;
  /**
   * Selection dot drawn at the scrub intersection while scrubbing. `true`/omitted
   * = built-in dot, `false` = hidden, or pass `SelectionDotConfig` (`size`,
   * `color`, `ring`, or a custom `component`). Default `true`.
   */
  selectionDot?: boolean | SelectionDotConfig;
  /** Called once when the user starts scrubbing/panning the chart. */
  onGestureStart?: () => void;
  /** Called once when the user stops scrubbing/panning the chart. */
  onGestureEnd?: () => void;
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
  /**
   * Live dot styling. `true`/omitted = shown defaults, `false` = hidden, or pass
   * `DotConfig` (`radius`, `ring` halo, `color`). See {@link DotConfig}. Default `true`.
   */
  dot?: boolean | DotConfig;
  /** Horizontal dashed line at the current live value. `true` = defaults, or pass `ValueLineConfig`. */
  valueLine?: boolean | ValueLineConfig;
  /** Render the live value as a large text overlay in the top-left. Default `false`. */
  showValue?: boolean;
  /** Tint the `showValue` text by momentum (green up / red down). Default `false`. */
  valueMomentumColor?: boolean;

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
   * Per-series live dot configuration. `true`/omitted = shown defaults, `false` =
   * hidden, or pass `MultiSeriesDotConfig` (radius, pulse, value line, inline
   * labels). Default `true`.
   */
  dot?: boolean | MultiSeriesDotConfig;
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
