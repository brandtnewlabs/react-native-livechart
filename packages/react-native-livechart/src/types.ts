import type { ComponentType, ReactElement } from "react";
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
   * Render the Form-A value as a **pill badge** — an icon and/or text tag pinned
   * to a plot edge at the line's value, with a dashed connector running to the
   * opposite edge (instead of a plain gutter label that collides with the Y-axis
   * ticks). Auto-pins to the nearest edge with a directional chevron once the
   * value scrolls off-screen. Ideal for working orders, price alerts, and targets.
   *
   * `true` = defaults (left-pinned, the line's label/value), or a
   * {@link ReferenceLineBadgeConfig} for an `icon`, `text` toggle (icon-only), and
   * `position`. Supersedes the legacy `offAxisBadge`. Default off.
   */
  badge?: boolean | ReferenceLineBadgeConfig;
  /**
   * Legacy: when a Form-A `value` falls outside the visible plot, render a pinned
   * edge badge with a directional chevron instead of culling the off-screen line.
   * Prefer {@link badge} (which also shows the tag in-range and supports an icon).
   * Typically paired with `excludeFromRange`. Default `false`.
   */
  offAxisBadge?: boolean;
  /** Localized word shown in the legacy off-axis badge (e.g. "Target"). Falls back to `label`. */
  offAxisBadgeLabel?: string;
  /** Badge pill background. Default: theme `tooltipBg`. (Fallback for `badge.background`.) */
  badgeBackground?: string;
  /** Badge pill border color. Default: the line `color`. (Fallback for `badge.borderColor`.) */
  badgeBorderColor?: string;
  /** Badge pill corner radius in pixels. Default `5`. (Fallback for `badge.radius`.) */
  badgeRadius?: number;
}

/**
 * Pill-badge presentation for a Form-A {@link ReferenceLine} — a working order,
 * price alert, or target tag. The badge sits at the line's value (pinned to
 * `position`) with a dashed connector to the opposite edge, and pins to the
 * nearest edge with a chevron once the value scrolls off-screen.
 */
export interface ReferenceLineBadgeConfig {
  /** Which plot edge the badge pins to. Default `"left"`. */
  position?: "left" | "right";
  /**
   * Leading glyph drawn in the badge — rendered with the chart font, so pass an
   * emoji-capable font (via the chart `font` prop) for emoji. Like `Marker.icon`.
   */
  icon?: string;
  /**
   * Show the text label (the line's `label`, plus the value when `showValue`).
   * Default `true`. Set `false` for an **icon-only** badge.
   */
  text?: boolean;
  /** Pill background. Falls back to `badgeBackground`, then theme `tooltipBg`. */
  background?: string;
  /** Pill border color. Falls back to `badgeBorderColor`, then the line `color`. */
  borderColor?: string;
  /** Pill corner radius in pixels. Falls back to `badgeRadius`, then `5`. */
  radius?: number;
}

/**
 * A time-range segment of the chart — e.g. a pre-market / regular / after-hours
 * session — distinguished with a **scrub-focus** interaction (Robinhood-style
 * extended-hours segmentation). At rest the whole line is one uniform color;
 * while the user scrubs (or when a segment is `active`) the focused segment keeps
 * the base color and every other segment is de-emphasized by recoloring the line
 * stroke itself (no overlay). An optional dashed `divider` + `label` mark a
 * segment's leading edge.
 */
export interface ChartSegment {
  /** Segment start, unix seconds. Omit to extend to the chart's left edge. */
  from?: number;
  /** Segment end, unix seconds. Omit to extend to the live edge (now). */
  to?: number;

  /**
   * Participate in scrub-focus line styling. At rest the line is one uniform
   * color; while scrubbing (or when a segment is `active`), the focused segment
   * keeps the base line color and every OTHER `recolorLine` segment is
   * de-emphasized with `mutedColor` / `mutedColors`. Default `true`.
   */
  recolorLine?: boolean;
  /** De-emphasis line color, used when this segment is NOT the focused one. An
   *  alpha-reduced color (e.g. `"rgba(154,160,166,0.4)"`) fades the line — it
   *  paints the stroke directly, not a layer on top. Defaults to the chart's muted
   *  palette color (`palette.gridLabel`). */
  mutedColor?: string;
  /**
   * Two or more CSS colors → horizontal gradient across the segment's sub-range
   * (left → right) for the de-emphasized state, mirroring `LineConfig.colors`.
   * Takes precedence over `mutedColor` when set.
   */
  mutedColors?: string[];

  /** Force this segment to be the focused one without scrubbing — it stays full
   *  while the others are de-emphasized (e.g. the session is currently after-hours). */
  active?: boolean;

  /** Draw a vertical dashed divider at the `from` edge (market-close marker). Default `false`. */
  divider?: boolean;
  /** Divider color. Defaults to the chart's reference-line color (`palette.refLine`). */
  dividerColor?: string;

  /** Optional label captioning the divider at the top of the segment. Shown only
   *  when `divider` is set; drawn in the chart's reference-label color
   *  (`palette.refLabel`). */
  label?: string;
  /** Label horizontal anchor within the segment. Default `"left"`. */
  labelPosition?: "left" | "right";
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

/**
 * Shared styling for a simple straight line — color, thickness, and an optional
 * dash. The common shape behind the chart's secondary lines (the `valueLine`,
 * the extrema-label `connector`, etc.), so they configure the same way.
 */
export interface LineStyleConfig {
  /** Line color. Defaults per usage (e.g. the connector uses the label color). */
  color?: string;
  /** Line thickness in pixels. Default `1`. */
  strokeWidth?: number;
  /** Dash pattern as `[dashLength, gapLength]` in pixels. Omit for a solid line. */
  intervals?: [number, number];
}

/** Main chart line styling. */
export interface LineConfig {
  /** Stroke width of the main line in pixels. Default `2`. */
  width?: number;
  /**
   * Interpolation between points. `"monotone"` (default) draws a smooth monotone
   * cubic; `"linear"` draws straight segments for an angular, hard-edged line —
   * pair with `join: "miter"` + `cap: "butt"` for true sharp corners (no rounding).
   */
  curve?: "monotone" | "linear";
  /** Line color override. Defaults to palette-derived accent. */
  color?: string;
  /**
   * Two or more CSS color strings → horizontal gradient along the stroke
   * (left → right). Takes precedence over `color` when set.
   */
  colors?: string[];
  /**
   * Stroke line-join — how corners between segments render. `"round"` (default)
   * softens every peak; `"miter"` gives sharp, angular ("edgy") peaks; `"bevel"`
   * flattens them.
   */
  join?: "round" | "miter" | "bevel";
  /**
   * Stroke line-cap at the path's start/end. `"round"` (default) | `"butt"` |
   * `"square"`. Pair `"butt"` with `join: "miter"` for a fully hard-edged line.
   */
  cap?: "round" | "butt" | "square";
}

/**
 * Color the line above vs. below a live threshold value — green above, red below
 * by default. The threshold is **always** a `SharedValue` so it can track a live
 * benchmark (break-even / average cost, VWAP, previous close, a peg) on the UI
 * thread without re-rendering. Drives a hard-split line stroke and, optionally, a
 * tinted profit/loss fill band and a dashed marker line at the threshold.
 *
 * The split stroke supersedes `LineConfig.color`/`colors` and segment recoloring
 * for the main line while a threshold is set.
 */
export interface ThresholdConfig {
  /**
   * The split value, in Y-axis (price) units. A `SharedValue` — update it with
   * `.set()` and the split tracks live on the UI thread (break-even, VWAP, the
   * previous close, a peg, …).
   */
  value: SharedValue<number>;
  /** Stroke color where the line is at/above `value`. Default: palette up-green (`candleUp`). */
  aboveColor?: string;
  /** Stroke color where the line is below `value`. Default: palette down-red (`candleDown`). */
  belowColor?: string;
  /**
   * Tint the area between the line and `value` (the profit/loss band) toward the
   * above/below colors. Independent of the baseline `gradient` fill — set
   * `gradient={false}` for the threshold band alone. Default `false`.
   */
  fill?: boolean;
  /**
   * Dashed marker line + optional gutter label at the threshold. `true` → a dashed
   * line in the palette reference color; object → styled; omit/`false` → none.
   * Default off.
   */
  line?: boolean | ThresholdLineConfig;
}

/** Dashed marker line drawn at a {@link ThresholdConfig} value. */
export interface ThresholdLineConfig {
  /** Label text, e.g. `"Break-even"`. */
  label?: string;
  /**
   * Label side. `"left"` sits just inside the plot at the line's left edge —
   * clear of the y-axis labels and the live badge; `"right"` uses the right
   * gutter like a legacy reference line (may overlap y-axis labels). Default `"left"`.
   */
  labelPosition?: "left" | "right";
  /** Line + label color. Defaults to palette `refLine` / `refLabel`. */
  color?: string;
  /** Dash pattern `[dashLength, gapLength]` in pixels. Default `[4, 4]`. */
  intervals?: [number, number];
  /** Line thickness in pixels. Default `1`. */
  strokeWidth?: number;
  /** Append the formatted threshold value to the label. Default `false`. */
  showValue?: boolean;
}

/** Area fill gradient beneath the chart line. */
export interface GradientConfig {
  /** Opacity at the top of the gradient (near the line). Default `0.35`. */
  topOpacity?: number;
  /** Opacity at the bottom of the gradient. Default `0`. */
  bottomOpacity?: number;
  /** Explicit gradient color stops (top → bottom) for the area fill. Overrides
   *  topOpacity/bottomOpacity when provided. Must have at least 2 entries. */
  colors?: string[];
  /** Optional stop positions (0..1, ascending) matching `colors` length. */
  positions?: number[];
}

/**
 * Dot-lattice fill of the area beneath the line — a screen-fixed grid of dots
 * clipped to the region between the line and the baseline. Composes with
 * `gradient` (both paint), or use it alone with `gradient={false}`.
 */
export interface AreaDotsConfig {
  /** Lattice pitch (px) between dots, both axes. Default `12`. */
  spacing?: number;
  /** Dot diameter (px). Default `1.6`. */
  size?: number;
  /** Dot color. Omit to derive a faint tint from the line/accent color. */
  color?: string;
  /** Overall opacity (0..1) applied to the whole field. Default `1`. */
  opacity?: number;
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

/**
 * Axis edge label — the value floated at the plot's top or bottom edge
 * (Robinhood-style high/low). Pass `topLabel`/`bottomLabel` as `true` for the
 * batteries-included value label (the chart's current top/bottom Y-axis bound,
 * updated each frame), an object to configure it, or `{ render }` to float a
 * fully custom element instead.
 */
export interface AxisLabelConfig {
  /** Formatter for the built-in value. Defaults to the chart's `formatValue`. */
  format?: (v: number) => string;
  /** Text color. Defaults to a muted label color (`palette.gridLabel`). */
  color?: string;
  /**
   * Where the label sits.
   * - `"left"` / `"right"` (default `"right"`) — pin to that edge of the plot,
   *   horizontally aligned.
   * - `"extrema"` — float at the **actual data point** where the value occurs
   *   (`topLabel` tracks the highest point, `bottomLabel` the lowest), anchored
   *   over the point with a marker dot, so you can see *when* the high / low
   *   happened. The dot and label track the point on the UI thread.
   * - `"extrema-edge"` — like `"extrema"`, but the value label is pinned to the
   *   **top / bottom edge**, horizontally aligned with the extremum (not floated
   *   over the point). The marker dot still sits on the data point, joined to the
   *   edge label by a {@link AxisLabelConfig.connector} line. Keeps the readout on
   *   a clean rail while still showing where the extremum is.
   */
  position?: "left" | "right" | "extrema" | "extrema-edge";
  /** Built-in value text size in px. Default `11`. */
  fontSize?: number;
  /** Built-in value text weight. Default the platform `<Text>` default. */
  fontWeight?: FontWeight;
  /** Built-in value text font family (e.g. a loaded monospace face). */
  fontFamily?: string;
  /**
   * Extrema modes only — color of the marker dot at the data point. Defaults to
   * `color`. Lets the dot and the value text differ.
   */
  dotColor?: string;
  /** Extrema modes only — marker dot diameter in px. Default `7`. */
  dotSize?: number;
  /**
   * Extrema modes only — draw the marker dot at the data point. Default `true`.
   * Set `false` for a value label with no dot.
   */
  dot?: boolean;
  /**
   * `"extrema-edge"` only — the line joining the marker dot (on the data point)
   * to the edge value label. `true` = a dashed default, `false` = none, or pass a
   * {@link LineStyleConfig} to style it (`color` defaults to the label `color`).
   * Default on (dashed) in `"extrema-edge"` mode.
   */
  connector?: boolean | LineStyleConfig;
  /**
   * Full custom element, floated at the edge (or, in an extrema mode, centered
   * over the extremum point). Overrides the built-in value label (and the
   * `fontSize` / `fontWeight` / `fontFamily` / `dot*` knobs above — you own the
   * styling).
   */
  render?: () => ReactElement | null;
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
   * Dash the vertical crosshair line. `true` → a default `[4, 4]` dash; an array
   * sets explicit Skia dash intervals `[on, off, …]` in px. Omit / `false` → a
   * solid line.
   */
  crosshairDash?: number[] | boolean;
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
  /** Tooltip pill corner radius in px. Default `5`. */
  tooltipBorderRadius?: number;
  /**
   * Where the tooltip pill sits relative to the vertical scrub line.
   * `"side"` (default) offsets it to the right of the line and flips left near
   * the right edge. `"top"` / `"bottom"` center it horizontally over the line,
   * clamped into the plot and pinned to the plot's top or bottom. This also
   * drives a custom {@link LiveChartProps.renderTooltip} so it gets the same
   * placement for free.
   */
  tooltipPlacement?: "side" | "top" | "bottom";
  /**
   * Gap in px between the tooltip and the plot edge it's pinned to — the top for
   * `"side"`/`"top"`, the bottom for `"bottom"`. Applies to the built-in pill and
   * a custom {@link LiveChartProps.renderTooltip}. Default `8`.
   */
  tooltipMargin?: number;
  /** Show the value row in the default tooltip body. Default `true`. */
  tooltipShowValue?: boolean;
  /** Show the time row in the default tooltip body. Default `true`. */
  tooltipShowTime?: boolean;
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
 * Scrub-action ("order ticket") mode for the single-series `LiveChart` (line and
 * candle). Tap to drop a locked crosshair, drag to fine-tune a **price level**,
 * then press the right-gutter action badge to fire {@link LiveChartProps.onScrubAction}.
 *
 * The reported price is the value at the reticle's **Y position** (a free price
 * level you choose — the inverse of the value→pixel mapping), NOT the line/candle
 * value at the reticle's X. That matches how a limit price works (a horizontal
 * level) and the crosshair badge in pro charting tools. Opt-in (default off).
 */
export interface ScrubActionConfig {
  /** Glyph drawn in the action badge (rendered as chart text, like `Marker.icon`). Default `"+"`. */
  icon?: string;
  /** Action-badge background color. Defaults to the accent / badge color. */
  background?: string;
  /** Action-badge icon + price text color. Defaults to the badge text color. */
  iconColor?: string;
  /** Horizontal level-line color. Defaults to `palette.crosshairLine`. */
  lineColor?: string;
  /**
   * Show the price readout inside the action badge. Default `true`. Set `false`
   * for an **icon-only** pill (mirrors {@link ReferenceLineBadgeConfig.text}).
   */
  text?: boolean;
  /**
   * Show a date/time pill where the reticle's vertical line meets the x-axis,
   * formatted by the chart's `formatTime`. Off by default — for order entry the
   * reticle's X (time) is incidental to a price *level*; enable it when the time
   * under the reticle is meaningful (annotations, time-relevant actions, or a full
   * crosshair readout). Reuses `background` / `iconColor`. Default `false`.
   */
  timeBadge?: boolean;
  /**
   * Round the reported price to this increment (e.g. `0.01` for cents, `0.5` for
   * a tick size) so the badge reads round numbers. Omit for the raw value.
   */
  snap?: number;
  /**
   * A tap on empty plot (outside the reticle + action badge) dismisses the lock
   * instead of moving it. Default `false` (an empty-plot tap re-places the reticle).
   */
  dismissOnTapOutside?: boolean;
}

/**
 * Payload for {@link LiveChartProps.onScrubAction} — the chosen price **level**
 * (from the locked reticle's Y), not the line value at that time.
 *
 * The library asserts no buy/sell semantics: derive the side from `price` versus
 * your own current price (`price < last` is the usual buy-below / sell-above
 * convention, but stop orders invert it).
 */
export interface ScrubActionPoint {
  /** Chosen price level — the value at the reticle Y, optionally `snap`-rounded. */
  price: number;
  /** Unix timestamp in seconds at the reticle X. */
  time: number;
  /** Canvas X coordinate of the reticle. */
  x: number;
  /** Canvas Y coordinate of the reticle. */
  y: number;
  /** In candle mode, the OHLC data of the candle under the reticle X (context only). */
  candle?: CandlePoint;
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

/**
 * Context passed to a custom {@link LiveChartProps.renderTooltip}. The element
 * you return is a React Native view that the chart floats over the canvas and
 * positions on the UI thread (per `scrub.tooltipPlacement`) — so movement stays
 * smooth without JS re-renders, unlike rebuilding the tooltip from the JS-thread
 * `onScrub` callback. Bind the SharedValues here to animated text (e.g. an
 * `Animated.createAnimatedComponent(TextInput)` driven by `useAnimatedProps`)
 * for the value/date to update on the UI thread too.
 */
export interface TooltipRenderProps {
  /**
   * Value under the crosshair; `null` when none. In line mode this is the
   * interpolated value at the scrub time; in candle mode it's the scrubbed
   * candle's close (use {@link TooltipRenderProps.candle} for full OHLC).
   */
  value: SharedValue<number | null>;
  /** Window time (unix seconds) under the crosshair. */
  time: SharedValue<number>;
  /**
   * Value formatted with the chart's `formatValue` (computed UI-side). In candle
   * mode this is the formatted close.
   */
  valueStr: SharedValue<string>;
  /** Time formatted with the chart's `formatTime` (computed UI-side). */
  timeStr: SharedValue<string>;
  /** Whether scrubbing is currently active. */
  active: SharedValue<boolean>;
  /**
   * In candle mode, the OHLC candle under the crosshair (`null` when none or
   * while inactive). Always `null` in line mode — bind it to render OHLC in a
   * custom candlestick tooltip. Format the individual prices with your own
   * worklet-safe formatter (e.g. the chart's `formatValue`).
   */
  candle: SharedValue<CandlePoint | null>;
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
  /**
   * Interpolation for this series' line, mirroring {@link LineConfig.curve}.
   * - `"monotone"` (default): Fritsch-Carlson monotone cubic spline.
   * - `"linear"`: straight segments between samples (sharp vertices). Markers
   *   anchored to this series snap to the straight chord to match.
   */
  curve?: "monotone" | "linear";
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

/**
 * Time-scroll activation (see {@link LiveChartCoreProps.timeScroll}).
 *
 * @experimental Prototype — gesture model and API may change.
 */
export interface TimeScrollConfig {
  /**
   * Which gesture pans the timeline:
   *  - `"twoFinger"` (default) — a two-finger drag anywhere on the chart.
   *  - `"axisDrag"` — a one-finger drag starting in the bottom X-axis band
   *    ("grab the time ruler").
   *  - `"holdToScrub"` — a one-finger drag anywhere scrolls; scrub moves to
   *    press-and-hold (Rainbow-style). Scrub engages after ~220ms unless you set
   *    your own `scrub.panGestureDelay`.
   */
  gesture?: "twoFinger" | "axisDrag" | "holdToScrub";
}

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
  /**
   * Label floated at the top edge of the plot area. `true` = the built-in value
   * label showing the chart's current TOP Y-axis bound (updated each frame),
   * `false`/omitted = none, or pass `AxisLabelConfig` to configure it (or supply
   * a custom `render`). Default off.
   */
  topLabel?: boolean | AxisLabelConfig;
  /**
   * Label floated at the bottom edge of the plot area. `true` = the built-in
   * value label showing the chart's current BOTTOM Y-axis bound (updated each
   * frame), `false`/omitted = none, or pass `AxisLabelConfig` (or a custom
   * `render`). Default off.
   */
  bottomLabel?: boolean | AxisLabelConfig;
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
   * Render a marker as a custom **React Native** element instead of a built-in
   * Skia glyph — e.g. an `expo-blur` glass badge or any non-Skia view that the
   * canvas can't draw. Return an element to float it, auto-centered, at the
   * marker's live `(time, value)` position (tracked on the UI thread); return
   * `null`/`undefined` to keep the built-in atlas glyph for that marker.
   *
   * The element is rendered as an RN view layered over the canvas, so it is
   * crisp at native resolution. Use it sparingly (a handful of special markers):
   * each custom marker is its own animated view + projection, whereas built-in
   * glyphs batch into a single draw call. Custom-rendered markers skip the atlas
   * glyph entirely (no double-draw).
   */
  renderMarker?: (marker: Marker) => ReactElement | null | undefined;
  /**
   * Render a fully custom scrub tooltip as a **React Native** element instead of
   * the built-in pill — the same idea as `renderMarker`. The chart floats the
   * returned element over the canvas and positions it on the UI thread per
   * `scrub.tooltipPlacement` (so it stays smooth, unlike rebuilding the tooltip
   * from the JS-thread `onScrub`). You own the chrome (border radius/color,
   * background are plain RN styles) and content — bind the {@link
   * TooltipRenderProps} SharedValues to animated text for the value/date.
   *
   * Supplying `renderTooltip` replaces the built-in tooltip entirely while
   * scrubbing (the line pill in line mode, the OHLC stack in candle mode).
   * Returning `null`/`undefined` from a frame renders nothing for that frame
   * (e.g. to hide the tooltip in certain states) — it does *not* restore the
   * built-in pill. Works in **both line and candle mode**: in candle mode the
   * scrubbed candle is available as {@link TooltipRenderProps.candle} for
   * rendering your own OHLC readout.
   */
  renderTooltip?: (ctx: TooltipRenderProps) => ReactElement | null | undefined;
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
  /**
   * Enable horizontal time-scrolling: drag (or fling) to pan back through history.
   * The chart stops auto-scrolling while panned and resumes once you reach the
   * live edge again. One-finger plot-area scrub is unchanged. Requires retained
   * history in `data` / `candles` to scroll into.
   *
   * `true` uses the two-finger gesture; pass a {@link TimeScrollConfig} to pick
   * the activation (`"twoFinger"` or `"axisDrag"`). Default `false`.
   *
   * @experimental Prototype — gesture model and API may change.
   */
  timeScroll?: boolean | TimeScrollConfig;
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
  /**
   * Dot-lattice fill of the area beneath the line (clipped to the under-line
   * region). `true` = defaults, or pass `AreaDotsConfig`. Composes with
   * `gradient`. Default `false` (off). Inert in candle mode.
   */
  areaDots?: boolean | AreaDotsConfig;
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
  /**
   * Time-range segments (sessions, after-hours, overnight, etc.). At rest the
   * line is one uniform color; scrubbing a {@link ChartSegment} — or marking one
   * `active` — keeps it full while the others de-emphasize (`mutedColor` /
   * `mutedColors`). Optional dashed `divider` + `label` mark a segment's edge.
   */
  segments?: ChartSegment[];
  /**
   * Color the line above vs. below a live threshold value (break-even / average
   * cost, VWAP, previous close, a peg). Always a `SharedValue` so the split tracks
   * live on the UI thread. See {@link ThresholdConfig}.
   */
  threshold?: ThresholdConfig;
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
  /** Render once with no per-frame animation loop — for many small charts (sparklines)
   *  in a list. Pulse/scrub/degen and the entry animation are disabled. Frame the data
   *  with `timeWindow` + `nowOverride` (see the historical-data-fill pattern). */
  static?: boolean;
  /** Called when the user scrubs the crosshair. `null` when scrub ends. */
  onScrub?: (point: ScrubPoint | null) => void;
  /**
   * Scrub-action ("order ticket") mode: tap to drop a locked crosshair, drag to
   * fine-tune a **price level**, then press the right-gutter action badge to fire
   * {@link onScrubAction}. `true` = defaults, `false`/omitted = off, or pass
   * {@link ScrubActionConfig}. Coexists with `scrub`/`onScrub`. Default off.
   */
  scrubAction?: boolean | ScrubActionConfig;
  /**
   * Called on the JS thread when the user presses the scrub-action badge. The
   * payload's `price` is the value at the locked reticle's Y (a chosen price
   * level), not the line value at that time. See {@link ScrubActionPoint}.
   */
  onScrubAction?: (point: ScrubActionPoint) => void;
  /**
   * Called on the JS thread when the user taps a reference line's **badge** — the
   * pill tag drawn for a working order / alert / target (a `ReferenceLine` with a
   * {@link ReferenceLine.badge}). Receives the tapped line and its index in the
   * `referenceLines` array, e.g. to open a cancel/edit sheet for that order. Only
   * badge-tagged Form-A (value) lines are pressable — a plain line has no discrete
   * hit target. Coexists with `scrub`/`scrubAction`/`markers` (a tap on a badge is
   * routed here, not to reticle placement). Single-series only.
   */
  onReferenceLinePress?: (line: ReferenceLine, index: number) => void;
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
