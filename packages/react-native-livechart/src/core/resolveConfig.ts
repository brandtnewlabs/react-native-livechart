import type {
  AreaDotsConfig,
  AxisLabelConfig,
  BadgeConfig,
  BadgeVariant,
  DegenOptions,
  FontConfig,
  FontWeight,
  GradientConfig,
  GridStyleConfig,
  LeftEdgeFadeConfig,
  LegendConfig,
  LegendStyle,
  LineStyleConfig,
  LiveChartMetrics,
  LiveChartMetricsOverride,
  DotConfig,
  DotRingConfig,
  MultiSeriesDotConfig,
  PulseConfig,
  ReferenceLine,
  ScrubActionConfig,
  ScrubConfig,
  SelectionDotConfig,
  SelectionDotProps,
  SelectionDotRingConfig,
  ThresholdConfig,
  ThresholdLineConfig,
  TradeEvent,
  ValueLineConfig,
  XAxisConfig,
  YAxisConfig,
} from "../types";

import type { ComponentType, ReactElement } from "react";
import type { SharedValue } from "react-native-reanimated";
import {
  BADGE_METRICS_DEFAULTS,
  CANDLE_METRICS_DEFAULTS,
  EMPTY_STATE_METRICS_DEFAULTS,
  FADE_EDGE_WIDTH,
  GRID_METRICS_DEFAULTS,
  MOTION_METRICS_DEFAULTS,
} from "../constants";

// ─── Resolved types (all fields required, no optionals) ──────────────────────

export interface ResolvedValueLineConfig {
  strokeWidth: number;
  intervals: [number, number];
  /** undefined → use palette.dashLine at render time */
  color: string | undefined;
}

export interface ResolvedBadgeConfig {
  variant: BadgeVariant;
  tail: boolean;
  position: "right" | "left";
  background: string | undefined;
  /** Track the visible window's right-edge price while scrolled back. */
  followViewEdge: boolean;
}

export interface ResolvedYAxisConfig {
  minGap: number;
  /** Float the axis over a full-width plot (no reserved right gutter). */
  float: boolean;
}

/** Resolved straight-line styling (connector, etc.). `color: undefined` → caller default. */
export interface ResolvedLineStyleConfig {
  color: string | undefined;
  strokeWidth: number;
  /** undefined → solid (no dash). */
  intervals: [number, number] | undefined;
}

export interface ResolvedAxisLabelConfig {
  /** undefined → use the chart's `formatValue` at render time. */
  format?: (v: number) => string;
  /** undefined → use the muted default label color at render time. */
  color?: string;
  /** `"left"`/`"right"` pin to that edge; `"extrema"`(-`edge`) tracks the data point. */
  position: "left" | "right" | "extrema" | "extrema-edge";
  /** undefined → the built-in default text size (11). */
  fontSize?: number;
  /** undefined → the platform `<Text>` default weight. */
  fontWeight?: FontWeight;
  /** undefined → the platform `<Text>` default family. */
  fontFamily?: string;
  /** Extrema dot color; undefined → use `color`. */
  dotColor?: string;
  /** Extrema dot diameter (px); undefined → the built-in default (7). */
  dotSize?: number;
  /** Extrema — whether to draw the marker dot. */
  dot: boolean;
  /** `"extrema-edge"` connector line (dot → edge label); null → none. */
  connector: ResolvedLineStyleConfig | null;
  /** When set, the built-in value label is replaced by this custom element. */
  render?: () => ReactElement | null;
}

export interface ResolvedXAxisConfig {
  minGap: number;
}

export interface ResolvedScrubConfig {
  tooltip: boolean;
  /** Opacity of content right of the crosshair while scrubbing (dstOut fade). */
  dimOpacity: number;
  /** undefined → palette.crosshairLine */
  crosshairLineColor: string | undefined;
  /** Dash intervals `[on, off, …]` for the crosshair line; undefined → solid. */
  crosshairDash: number[] | undefined;
  /** undefined → palette.crosshairDim */
  crosshairDimColor: string | undefined;
  /** undefined → palette.tooltipBg */
  tooltipBackground: string | undefined;
  /** undefined → palette.tooltipText */
  tooltipColor: string | undefined;
  /** undefined → palette.tooltipBorder */
  tooltipBorderColor: string | undefined;
  /** Tooltip pill corner radius in px. */
  tooltipBorderRadius: number;
  /** Where the tooltip pill sits relative to the scrub line. */
  tooltipPlacement: "side" | "top" | "bottom";
  /** Gap (px) between the tooltip and the plot edge it's pinned to. */
  tooltipMargin: number;
  /** Show the value row in the default tooltip body. */
  tooltipShowValue: boolean;
  /** Show the time row in the default tooltip body. */
  tooltipShowTime: boolean;
  /** Press-and-hold delay (ms) before scrubbing activates. 0 = immediate. */
  panGestureDelay: number;
}

export interface ResolvedScrubActionConfig {
  /** Glyph drawn in the action badge. */
  icon: string;
  /** undefined → palette.badgeBg */
  background: string | undefined;
  /** undefined → palette.badgeText */
  iconColor: string | undefined;
  /** undefined → palette.crosshairLine */
  lineColor: string | undefined;
  /** Show the price readout pill; false → icon-only badge. */
  text: boolean;
  /** Show the date/time pill where the vertical line meets the x-axis. */
  timeBadge: boolean;
  /** undefined → no rounding */
  snap: number | undefined;
  dismissOnTapOutside: boolean;
}

export interface ResolvedGradientConfig {
  /** undefined → use palette.fillTop (theme-aware) at render time */
  topOpacity: number | undefined;
  /** undefined → use palette.fillBottom (transparent) at render time */
  bottomOpacity: number | undefined;
  /** Explicit color stops (top → bottom); overrides the opacity stops. */
  colors: string[] | undefined;
  /** Stop positions (0..1) matching `colors` length. */
  positions: number[] | undefined;
}

export interface ResolvedAreaDotsConfig {
  spacing: number;
  size: number;
  /** undefined → derive a faint tint from the line/accent color at render time. */
  color: string | undefined;
  opacity: number;
}

export interface ResolvedPulseConfig {
  interval: number;
  duration: number;
  maxRadius: number;
  opacity: number;
  strokeWidth: number;
}

export interface ResolvedReferenceLineConfig {
  strokeWidth: number;
  intervals: [number, number];
  /** undefined → use palette.refLine at render time */
  color: string | undefined;
}

export interface ResolvedGridStyleConfig {
  /** undefined → use palette.gridLine at render time */
  color: string | undefined;
  strokeWidth: number;
  /** Empty array → solid stroke (no dash effect). */
  intervals: number[];
  opacity: number;
}

export interface ResolvedFontConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: FontWeight;
}

export interface ResolvedDegenConfig {
  scale: number;
  downMomentum: boolean;
  shake: boolean;
  shakeIntensity: number;
  shakeDurationSec: number;
  particleSlotCount: number;
  particleBurstDurationSec: number;
  burstParticleCount: number;
  drag: number;
  particleSizeMin: number;
  particleSizeMax: number;
  particleOpacity: number;
  spreadAngle: number;
  positionJitterX: number;
  positionJitterY: number;
  speedMin: number;
  speedMax: number;
  /** `null` = use palette.line at render time. */
  colors: string[] | null;
}

export interface ResolvedTradeStreamConfig {
  maxCount: number;
  /** Horizontal offset from `padding.left` for the label text (default 8). */
  labelOffsetX: number;
}

export interface ResolvedLeftEdgeFadeConfig {
  width: number;
  startColor: string;
  endColor: string;
}

// ─── Resolver functions ───────────────────────────────────────────────────────

/**
 * Uniform `boolean | Config` feature-flag resolver, shared by every toggle below.
 * - `false` → `null` (explicitly disabled)
 * - `undefined` → `defaultOn ? defaults : null` (the feature's default state)
 * - `true` → `defaults`
 * - object → defaults shallow-merged with the caller's overrides
 *
 * `defaultOn` makes each toggle's default explicit at the resolver. Toggles whose
 * default-on is owned by the component prop (e.g. `badge = true`) pass
 * `defaultOn: false` here, so a bare resolver call without that default stays off.
 */
function resolveToggle<C extends object, R extends object>(
  prop: boolean | C | undefined,
  defaults: R,
  defaultOn: boolean,
): R | null {
  if (prop === false) return null;
  if (prop == null) return defaultOn ? defaults : null;
  if (prop === true) return defaults;
  return { ...defaults, ...prop } as R;
}

const VALUE_LINE_DEFAULTS: ResolvedValueLineConfig = {
  strokeWidth: 1,
  intervals: [4, 4],
  color: undefined,
};

/**
 * Resolves `valueLine` prop to a fully-typed config or null (disabled).
 * `true` → defaults, object → merged with defaults, falsy → null.
 */
export function resolveValueLine(
  prop: boolean | ValueLineConfig | undefined,
): ResolvedValueLineConfig | null {
  return resolveToggle(prop, VALUE_LINE_DEFAULTS, false);
}

export interface ResolvedThresholdLineConfig {
  /** undefined → no label. */
  label: string | undefined;
  /** Label side; `"left"` sits inside the plot (clear of the y-axis gutter). */
  labelPosition: "left" | "right";
  /** undefined → use palette.refLine (line) / palette.refLabel (label) at render time. */
  color: string | undefined;
  intervals: [number, number];
  strokeWidth: number;
  showValue: boolean;
}

export interface ResolvedThresholdConfig {
  /** The live split value (Y-axis units). Read on the UI thread each frame. */
  value: SharedValue<number>;
  /** undefined → use palette.candleUp (up-green) at render time. */
  aboveColor: string | undefined;
  /** undefined → use palette.candleDown (down-red) at render time. */
  belowColor: string | undefined;
  fill: boolean;
  line: ResolvedThresholdLineConfig | null;
}

const THRESHOLD_LINE_DEFAULTS: ResolvedThresholdLineConfig = {
  label: undefined,
  labelPosition: "left",
  color: undefined,
  intervals: [4, 4],
  strokeWidth: 1,
  showValue: false,
};

/**
 * Resolves the `threshold.line` sub-prop to a config or null (no marker line).
 * `true` → dashed defaults, object → merged, falsy/undefined → null.
 */
export function resolveThresholdLine(
  prop: boolean | ThresholdLineConfig | undefined,
): ResolvedThresholdLineConfig | null {
  return resolveToggle(prop, THRESHOLD_LINE_DEFAULTS, false);
}

/**
 * Resolves the `threshold` prop to a fully-typed config or null (disabled).
 * Presence-gated (like `referenceLines`/`markers`): the required `value`
 * SharedValue means there is no boolean form — a config object enables it.
 */
export function resolveThreshold(
  prop: ThresholdConfig | undefined,
): ResolvedThresholdConfig | null {
  if (!prop) return null;
  return {
    value: prop.value,
    aboveColor: prop.aboveColor,
    belowColor: prop.belowColor,
    fill: prop.fill ?? false,
    line: resolveThresholdLine(prop.line),
  };
}

const BADGE_DEFAULTS: ResolvedBadgeConfig = {
  variant: "default",
  tail: true,
  position: "right",
  background: undefined,
  followViewEdge: false,
};

/**
 * Resolves `badge` prop to a fully-typed config or null (disabled).
 * `true` → defaults, object → merged with defaults, falsy → null.
 */
export function resolveBadge(
  prop: boolean | BadgeConfig | undefined,
): ResolvedBadgeConfig | null {
  return resolveToggle(prop, BADGE_DEFAULTS, false);
}

const Y_AXIS_DEFAULTS: ResolvedYAxisConfig = {
  minGap: 36,
  float: false,
};

/**
 * Resolves `yAxis` prop to a fully-typed config or null (disabled).
 * `true` → defaults, object → merged with defaults, falsy → null.
 */
export function resolveYAxis(
  prop: boolean | YAxisConfig | undefined,
): ResolvedYAxisConfig | null {
  return resolveToggle(prop, Y_AXIS_DEFAULTS, false);
}

const AXIS_LABEL_DEFAULTS: ResolvedAxisLabelConfig = {
  format: undefined,
  color: undefined,
  position: "right",
  fontSize: undefined,
  fontWeight: undefined,
  fontFamily: undefined,
  dotColor: undefined,
  dotSize: undefined,
  dot: true,
  // Always overwritten by resolveAxisLabel (per-position default-on); placeholder.
  connector: null,
  render: undefined,
};

/** Dashed by default — a subtle guide tying the extrema dot to its edge label. */
const CONNECTOR_DEFAULTS: ResolvedLineStyleConfig = {
  color: undefined,
  strokeWidth: 1,
  intervals: [2, 3],
};

/**
 * Resolves the extrema-label `connector` sub-prop to a line style or null.
 * `defaultOn` (true in `"extrema-edge"` mode) means an unset connector draws the
 * dashed default; `false` → null; an object → merged; a `LineStyleConfig` is
 * normalized (its `intervals` may be omitted for a solid line).
 */
export function resolveConnector(
  prop: boolean | LineStyleConfig | undefined,
  defaultOn: boolean,
): ResolvedLineStyleConfig | null {
  if (prop === false) return null;
  if (prop == null) return defaultOn ? CONNECTOR_DEFAULTS : null;
  if (prop === true) return CONNECTOR_DEFAULTS;
  return {
    color: prop.color,
    strokeWidth: prop.strokeWidth ?? CONNECTOR_DEFAULTS.strokeWidth,
    // An explicit object opts into its own dash (or solid when omitted).
    intervals: prop.intervals,
  };
}

/**
 * Resolves a `topLabel` / `bottomLabel` prop to a fully-typed config or null
 * (no label). Opt-in, so `undefined`/`false` → null; `true` → the built-in
 * value label with defaults; object → configured built-in (or a custom `render`).
 * The `connector` defaults on (dashed) in `"extrema-edge"` mode, else off.
 */
export function resolveAxisLabel(
  prop: boolean | AxisLabelConfig | undefined,
): ResolvedAxisLabelConfig | null {
  const resolved = resolveToggle(prop, AXIS_LABEL_DEFAULTS, false);
  if (!resolved) return null;
  const connectorProp =
    typeof prop === "object" ? prop.connector : undefined;
  return {
    ...resolved,
    connector: resolveConnector(
      connectorProp,
      resolved.position === "extrema-edge",
    ),
  };
}

const X_AXIS_DEFAULTS: ResolvedXAxisConfig = {
  minGap: 60,
};

/**
 * Resolves `xAxis` prop to a fully-typed config or null (disabled).
 * Defaults to enabled (`true`) so a bare `undefined` also returns the defaults.
 */
export function resolveXAxis(
  prop: boolean | XAxisConfig | undefined,
): ResolvedXAxisConfig | null {
  return resolveToggle(prop, X_AXIS_DEFAULTS, true);
}

const SCRUB_DEFAULTS: ResolvedScrubConfig = {
  tooltip: true,
  dimOpacity: 0.3,
  crosshairLineColor: undefined,
  crosshairDash: undefined,
  crosshairDimColor: undefined,
  tooltipBackground: undefined,
  tooltipColor: undefined,
  tooltipBorderColor: undefined,
  tooltipBorderRadius: 5,
  tooltipPlacement: "side",
  tooltipMargin: 8,
  tooltipShowValue: true,
  tooltipShowTime: true,
  panGestureDelay: 0,
};

/**
 * Resolves `scrub` prop to a fully-typed config or null (disabled).
 * `true` → defaults, object → merged with defaults, falsy → null.
 */
export function resolveScrub(
  prop: boolean | ScrubConfig | undefined,
): ResolvedScrubConfig | null {
  const resolved = resolveToggle(prop, SCRUB_DEFAULTS, false);
  if (resolved) {
    // Normalize the dash shorthand: `true` → a default dash, an array passes
    // through, anything falsy → solid (undefined).
    const dash = typeof prop === "object" ? prop.crosshairDash : undefined;
    resolved.crosshairDash = dash === true ? [4, 4] : dash || undefined;
  }
  return resolved;
}

const SCRUB_ACTION_DEFAULTS: ResolvedScrubActionConfig = {
  icon: "+",
  background: undefined,
  iconColor: undefined,
  lineColor: undefined,
  text: true,
  timeBadge: false,
  snap: undefined,
  dismissOnTapOutside: false,
};

/**
 * Resolves `scrubAction` prop to a fully-typed config or null (disabled).
 * Opt-in: `false`/`undefined` → null; `true` → defaults; object → merged.
 */
export function resolveScrubAction(
  prop: boolean | ScrubActionConfig | undefined,
): ResolvedScrubActionConfig | null {
  return resolveToggle(prop, SCRUB_ACTION_DEFAULTS, false);
}

const GRADIENT_DEFAULTS: ResolvedGradientConfig = {
  topOpacity: undefined,
  bottomOpacity: undefined,
  colors: undefined,
  positions: undefined,
};

/**
 * Resolves `gradient` prop to a fully-typed config or null (disabled).
 * `true` → defaults (use palette colors), object → merged with defaults, falsy → null.
 */
export function resolveGradient(
  prop: boolean | GradientConfig | undefined,
): ResolvedGradientConfig | null {
  return resolveToggle(prop, GRADIENT_DEFAULTS, false);
}

const AREA_DOTS_DEFAULTS: ResolvedAreaDotsConfig = {
  spacing: 12,
  size: 1.6,
  color: undefined,
  opacity: 1,
};

/**
 * Resolves `areaDots` prop to a fully-typed config or null (disabled).
 * `true` → defaults (palette-derived color), object → merged with defaults,
 * falsy/omitted → null. Default OFF (unlike `gradient`).
 */
export function resolveAreaDots(
  prop: boolean | AreaDotsConfig | undefined,
): ResolvedAreaDotsConfig | null {
  return resolveToggle(prop, AREA_DOTS_DEFAULTS, false);
}

/** Fallback when no theme background is passed (e.g. unit tests). */
const LEFT_EDGE_FADE_COLOR_FALLBACK: Pick<
  ResolvedLeftEdgeFadeConfig,
  "startColor" | "endColor"
> = {
  startColor: "rgba(0, 0, 0, 1)",
  endColor: "rgba(0, 0, 0, 0)",
};

/**
 * Resolves `leftEdgeFade` prop to a fully-typed config or null (disabled).
 * `true` → defaults, object → merged with defaults, falsy → null.
 *
 * Pass `colorDefaults` from `leftEdgeFadeColorsFromBgRgb(palette.bgRgb)` so default
 * stops match the chart background; omit for black alpha-gradient fallback.
 */
export function resolveLeftEdgeFade(
  prop: boolean | LeftEdgeFadeConfig | undefined,
  colorDefaults: {
    startColor: string;
    endColor: string;
  } = LEFT_EDGE_FADE_COLOR_FALLBACK,
): ResolvedLeftEdgeFadeConfig | null {
  if (!prop) return null;
  const base: ResolvedLeftEdgeFadeConfig = {
    width: FADE_EDGE_WIDTH,
    ...colorDefaults,
  };
  if (prop === true) return base;
  return { ...base, ...prop };
}

const PULSE_DEFAULTS: ResolvedPulseConfig = {
  interval: 1500,
  duration: 900,
  maxRadius: 21,
  opacity: 0.35,
  strokeWidth: 1.5,
};

/**
 * Resolves `pulse` prop to a fully-typed config or null (disabled).
 * `true` → defaults, object → merged with defaults, falsy → null.
 */
export function resolvePulse(
  prop: boolean | PulseConfig | undefined,
): ResolvedPulseConfig | null {
  return resolveToggle(prop, PULSE_DEFAULTS, false);
}

const REFERENCE_LINE_VISUAL_DEFAULTS = {
  strokeWidth: 1,
  intervals: [4, 4] as [number, number],
  color: undefined as string | undefined,
};

/**
 * Resolves the `font` prop into a fully-typed config ready for `matchFont`.
 * `defaultFamily` is the platform-specific fallback resolved by the caller.
 */
export function resolveFontConfig(
  config: FontConfig | undefined,
  defaultFamily: string,
  defaultSize: number,
): ResolvedFontConfig {
  return {
    fontFamily: config?.fontFamily ?? defaultFamily,
    fontSize: config?.fontSize ?? defaultSize,
    fontWeight: config?.fontWeight ?? "500",
  };
}

/**
 * Extracts the visual rendering config from a `ReferenceLine` prop.
 * Returns null when no reference line is set.
 */
export function resolveReferenceLineConfig(
  rl: ReferenceLine | undefined,
): ResolvedReferenceLineConfig | null {
  if (!rl) return null;
  return {
    strokeWidth: rl.strokeWidth ?? REFERENCE_LINE_VISUAL_DEFAULTS.strokeWidth,
    intervals: rl.intervals ?? REFERENCE_LINE_VISUAL_DEFAULTS.intervals,
    color: rl.color,
  };
}

const GRID_STYLE_DEFAULTS: ResolvedGridStyleConfig = {
  color: undefined,
  strokeWidth: 1,
  intervals: [],
  opacity: 1,
};

/**
 * Resolves the `gridStyle` prop into a fully-typed config. Always returns a
 * config (the grid always needs concrete defaults); omitted fields fall back to
 * the legacy solid 1px grid line.
 */
export function resolveGridStyle(
  prop: GridStyleConfig | undefined,
): ResolvedGridStyleConfig {
  if (!prop) return GRID_STYLE_DEFAULTS;
  return {
    color: prop.color,
    strokeWidth: prop.strokeWidth ?? GRID_STYLE_DEFAULTS.strokeWidth,
    intervals: prop.intervals ?? GRID_STYLE_DEFAULTS.intervals,
    opacity: prop.opacity ?? GRID_STYLE_DEFAULTS.opacity,
  };
}

const DEGEN_SHAKE_DURATION_DEFAULT_SEC = 0.45;
const DEGEN_PARTICLE_SLOT_DEFAULT = 60;
const DEGEN_PARTICLE_BURST_DURATION_DEFAULT_SEC = 1.0;
const DEGEN_BURST_PARTICLE_DEFAULT = 20;

function clampDegenParticleSlotCount(n: number): number {
  return Math.max(4, Math.min(80, Math.round(n)));
}

function clampDegenParticleBurstDurationSec(n: number): number {
  return Math.max(0.05, Math.min(5, n));
}

function clampDegenBurstParticleCount(n: number, slotCount: number): number {
  return Math.max(1, Math.min(slotCount, Math.round(n)));
}

const DEGEN_DEFAULTS: ResolvedDegenConfig = {
  scale: 1,
  downMomentum: false,
  shake: true,
  shakeIntensity: 1,
  shakeDurationSec: DEGEN_SHAKE_DURATION_DEFAULT_SEC,
  particleSlotCount: DEGEN_PARTICLE_SLOT_DEFAULT,
  particleBurstDurationSec: DEGEN_PARTICLE_BURST_DURATION_DEFAULT_SEC,
  burstParticleCount: DEGEN_BURST_PARTICLE_DEFAULT,
  drag: 0.95,
  particleSizeMin: 1,
  particleSizeMax: 2.2,
  particleOpacity: 0.55,
  spreadAngle: Math.PI * 1.2,
  positionJitterX: 24,
  positionJitterY: 8,
  speedMin: 60,
  speedMax: 160,
  colors: null,
};

function resolveDegenColors(
  input: string | string[] | undefined,
): string[] | null {
  if (!input) return null;
  if (typeof input === "string") return [input];
  return input.length > 0 ? input : null;
}

/**
 * Resolves `degen` prop to a fully-typed config or null (disabled).
 */
export function resolveDegen(
  prop: boolean | DegenOptions | undefined,
): ResolvedDegenConfig | null {
  if (!prop) return null;
  if (prop === true) return DEGEN_DEFAULTS;
  const slots = clampDegenParticleSlotCount(
    prop.particleSlotCount ?? DEGEN_DEFAULTS.particleSlotCount,
  );
  return {
    scale: prop.scale ?? DEGEN_DEFAULTS.scale,
    downMomentum: prop.downMomentum ?? DEGEN_DEFAULTS.downMomentum,
    shake: prop.shake ?? DEGEN_DEFAULTS.shake,
    shakeIntensity: prop.shakeIntensity ?? DEGEN_DEFAULTS.shakeIntensity,
    shakeDurationSec: prop.shakeDurationSec ?? DEGEN_DEFAULTS.shakeDurationSec,
    particleSlotCount: slots,
    particleBurstDurationSec: clampDegenParticleBurstDurationSec(
      prop.particleBurstDurationSec ?? DEGEN_DEFAULTS.particleBurstDurationSec,
    ),
    burstParticleCount: clampDegenBurstParticleCount(
      prop.burstParticleCount ?? DEGEN_DEFAULTS.burstParticleCount,
      slots,
    ),
    drag: Math.max(0, Math.min(1, prop.drag ?? DEGEN_DEFAULTS.drag)),
    particleSizeMin: Math.max(
      0.1,
      prop.particleSizeMin ?? DEGEN_DEFAULTS.particleSizeMin,
    ),
    particleSizeMax: Math.max(
      0.1,
      prop.particleSizeMax ?? DEGEN_DEFAULTS.particleSizeMax,
    ),
    particleOpacity: Math.max(
      0,
      Math.min(1, prop.particleOpacity ?? DEGEN_DEFAULTS.particleOpacity),
    ),
    spreadAngle: prop.spreadAngle ?? DEGEN_DEFAULTS.spreadAngle,
    positionJitterX: Math.max(
      0,
      prop.positionJitterX ?? DEGEN_DEFAULTS.positionJitterX,
    ),
    positionJitterY: Math.max(
      0,
      prop.positionJitterY ?? DEGEN_DEFAULTS.positionJitterY,
    ),
    speedMin: Math.max(0, prop.speedMin ?? DEGEN_DEFAULTS.speedMin),
    speedMax: Math.max(0, prop.speedMax ?? DEGEN_DEFAULTS.speedMax),
    colors: resolveDegenColors(prop.colors),
  };
}

const TRADE_STREAM_DEFAULTS: ResolvedTradeStreamConfig = {
  maxCount: 50,
  labelOffsetX: 8,
};

/**
 * Whether trade stream markers should run, and cap for mapped trades per frame.
 * Extend `options` when display options are added to props.
 */
export function resolveTradeStream(
  stream: SharedValue<TradeEvent[]> | undefined,
  options?: boolean | { maxCount?: number; labelOffsetX?: number },
): ResolvedTradeStreamConfig | null {
  if (stream === undefined) return null;
  if (options === false) return null;
  if (options === undefined || options === true) return TRADE_STREAM_DEFAULTS;
  return {
    maxCount: options.maxCount ?? TRADE_STREAM_DEFAULTS.maxCount,
    labelOffsetX: options.labelOffsetX ?? TRADE_STREAM_DEFAULTS.labelOffsetX,
  };
}

// ─── Dot (shared) ─────────────────────────────────────────────────────────────

/** Resolved halo ring. `color: undefined` means "use the theme `badgeOuterBg`". */
export interface ResolvedDotRingConfig {
  color: string | undefined;
  width: number;
}

const RING_DEFAULTS: ResolvedDotRingConfig = {
  color: undefined,
  width: 2.5,
};

/** `undefined`/`true` → haloed defaults; `false` → null (flat circle). */
export function resolveDotRing(
  prop: boolean | DotRingConfig | undefined,
): ResolvedDotRingConfig | null {
  return resolveToggle(prop, RING_DEFAULTS, true);
}

/** Shared, fully-resolved dot styling (single- and multi-series). */
export interface ResolvedDotConfig {
  radius: number;
  ring: ResolvedDotRingConfig | null;
  show: boolean;
  color: string | undefined;
}

const DOT_DEFAULTS: ResolvedDotConfig = {
  radius: 3.5,
  ring: RING_DEFAULTS,
  show: true,
  color: undefined,
};

/**
 * Resolves the `dot` prop. Always returns a config (the live dot's geometry is
 * read unconditionally); visibility rides on `show`.
 * - `false` → defaults with `show: false` (the canonical "hide the dot")
 * - `undefined`/`true` → shown defaults
 * - object → merged with defaults (honoring an explicit `show`)
 */
export function resolveDot(
  prop: boolean | DotConfig | undefined,
): ResolvedDotConfig {
  if (prop === false) return { ...DOT_DEFAULTS, show: false };
  if (prop == null || prop === true) return DOT_DEFAULTS;
  return {
    radius: prop.radius ?? DOT_DEFAULTS.radius,
    ring: resolveDotRing(prop.ring),
    show: prop.show ?? DOT_DEFAULTS.show,
    color: prop.color,
  };
}

// ─── Multi-series dot ─────────────────────────────────────────────────────────

export interface ResolvedMultiSeriesDotConfig extends ResolvedDotConfig {
  pulse: ResolvedPulseConfig | null;
  valueLine: ResolvedValueLineConfig | null;
  valueLabel: boolean;
}

export function resolveMultiSeriesDot(
  prop: boolean | MultiSeriesDotConfig | undefined,
): ResolvedMultiSeriesDotConfig {
  const cfg = typeof prop === "object" && prop !== null ? prop : undefined;
  return {
    ...resolveDot(prop),
    pulse: resolvePulse(cfg?.pulse ?? true),
    valueLine: resolveValueLine(cfg?.valueLine),
    valueLabel: cfg?.valueLabel ?? true,
  };
}

// ─── Selection dot ──────────────────────────────────────────────────────────

/** Resolved selection-dot ring. `color: undefined` → use the dot color. */
export interface ResolvedSelectionDotRingConfig {
  color: string | undefined;
  width: number;
}

const SELECTION_DOT_RING_DEFAULTS: ResolvedSelectionDotRingConfig = {
  color: undefined,
  width: 2,
};

/** `undefined`/`true` → ring defaults; `false` → null (no ring). */
export function resolveSelectionDotRing(
  prop: boolean | SelectionDotRingConfig | undefined,
): ResolvedSelectionDotRingConfig | null {
  return resolveToggle(prop, SELECTION_DOT_RING_DEFAULTS, true);
}

/** Fully-resolved selection-dot styling. */
export interface ResolvedSelectionDotConfig {
  size: number;
  /** undefined → use the line / leading-series color at render time. */
  color: string | undefined;
  ring: ResolvedSelectionDotRingConfig | null;
  /** When set, the built-in size/color/ring knobs are ignored. */
  component?: ComponentType<SelectionDotProps>;
}

const SELECTION_DOT_SIZE_DEFAULT = 4;

const SELECTION_DOT_DEFAULTS: ResolvedSelectionDotConfig = {
  size: SELECTION_DOT_SIZE_DEFAULT,
  color: undefined,
  ring: SELECTION_DOT_RING_DEFAULTS,
};

/**
 * Resolves the `selectionDot` prop to a fully-typed config or null (hidden).
 * Defaults to ON, so `undefined`/`true` yield the built-in dot.
 * - `false` → `null` (no dot)
 * - `undefined`/`true` → built-in dot with defaults
 * - object → configured built-in dot, or the custom `component` when set
 *   (the size/color/ring knobs are still resolved but ignored by the slot)
 */
export function resolveSelectionDot(
  prop: boolean | SelectionDotConfig | undefined,
): ResolvedSelectionDotConfig | null {
  if (prop === false) return null;
  if (prop == null || prop === true) return SELECTION_DOT_DEFAULTS;
  return {
    size: prop.size ?? SELECTION_DOT_DEFAULTS.size,
    color: prop.color,
    ring: resolveSelectionDotRing(prop.ring),
    component: prop.component,
  };
}

// ─── Legend ───────────────────────────────────────────────────────────────────

export interface ResolvedLegendConfig {
  visible: boolean;
  compact: boolean;
  position: "top" | "bottom";
  /** Raw style overrides; the chip row applies its own fallbacks. */
  style: LegendStyle | undefined;
}

const LEGEND_DEFAULTS: ResolvedLegendConfig = {
  visible: true,
  compact: false,
  position: "top",
  style: undefined,
};

export function resolveLegend(
  prop: boolean | LegendConfig | undefined,
): ResolvedLegendConfig {
  if (prop === false) return { ...LEGEND_DEFAULTS, visible: false };
  if (prop === undefined || prop === true) {
    return { ...LEGEND_DEFAULTS, compact: false };
  }
  return {
    visible: prop.visible ?? LEGEND_DEFAULTS.visible,
    compact: prop.compact ?? LEGEND_DEFAULTS.compact,
    position: prop.position ?? LEGEND_DEFAULTS.position,
    style: prop.style,
  };
}

// ─── Metrics (sizing & motion tokens) ─────────────────────────────────────────

/** Canonical resolved metrics — every namespace/field present. */
const METRICS_DEFAULTS: LiveChartMetrics = {
  badge: BADGE_METRICS_DEFAULTS,
  candle: CANDLE_METRICS_DEFAULTS,
  grid: GRID_METRICS_DEFAULTS,
  motion: MOTION_METRICS_DEFAULTS,
  emptyState: EMPTY_STATE_METRICS_DEFAULTS,
};

/**
 * Resolve the `metrics` prop into a fully-typed config. Per-namespace shallow
 * merge over the defaults — only the keys the caller sets are replaced, the same
 * model as `applyPaletteOverride`. Returns the shared defaults object when no
 * override is supplied (treated read-only by consumers).
 */
export function resolveMetrics(
  prop: LiveChartMetricsOverride | undefined,
): LiveChartMetrics {
  if (!prop) return METRICS_DEFAULTS;
  return {
    badge: { ...METRICS_DEFAULTS.badge, ...prop.badge },
    candle: { ...METRICS_DEFAULTS.candle, ...prop.candle },
    grid: { ...METRICS_DEFAULTS.grid, ...prop.grid },
    motion: { ...METRICS_DEFAULTS.motion, ...prop.motion },
    emptyState: { ...METRICS_DEFAULTS.emptyState, ...prop.emptyState },
  };
}
