import type {
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
  LiveChartMetrics,
  LiveChartMetricsOverride,
  DotConfig,
  DotRingConfig,
  MultiSeriesDotConfig,
  PulseConfig,
  ReferenceLine,
  ScrubConfig,
  TradeEvent,
  ValueLineConfig,
  XAxisConfig,
  YAxisConfig,
} from "../types";

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
}

export interface ResolvedYAxisConfig {
  minGap: number;
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
  /** undefined → palette.crosshairDim */
  crosshairDimColor: string | undefined;
  /** undefined → palette.tooltipBg */
  tooltipBackground: string | undefined;
  /** undefined → palette.tooltipText */
  tooltipColor: string | undefined;
  /** undefined → palette.tooltipBorder */
  tooltipBorderColor: string | undefined;
  /** Press-and-hold delay (ms) before scrubbing activates. 0 = immediate. */
  panGestureDelay: number;
}

export interface ResolvedGradientConfig {
  /** undefined → use palette.fillTop (theme-aware) at render time */
  topOpacity: number | undefined;
  /** undefined → use palette.fillBottom (transparent) at render time */
  bottomOpacity: number | undefined;
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

const BADGE_DEFAULTS: ResolvedBadgeConfig = {
  variant: "default",
  tail: true,
  position: "right",
  background: undefined,
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
  crosshairDimColor: undefined,
  tooltipBackground: undefined,
  tooltipColor: undefined,
  tooltipBorderColor: undefined,
  panGestureDelay: 0,
};

/**
 * Resolves `scrub` prop to a fully-typed config or null (disabled).
 * `true` → defaults, object → merged with defaults, falsy → null.
 */
export function resolveScrub(
  prop: boolean | ScrubConfig | undefined,
): ResolvedScrubConfig | null {
  return resolveToggle(prop, SCRUB_DEFAULTS, false);
}

const GRADIENT_DEFAULTS: ResolvedGradientConfig = {
  topOpacity: undefined,
  bottomOpacity: undefined,
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
