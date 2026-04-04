import type {
  BadgeConfig,
  BadgeVariant,
  FontConfig,
  FontWeight,
  GradientConfig,
  YAxisConfig,
  PulseConfig,
  ReferenceLine,
  ScrubConfig,
  XAxisConfig,
  ValueLineConfig,
} from "./types";

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

export interface ResolvedFontConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: FontWeight;
}

// ─── Resolver functions ───────────────────────────────────────────────────────

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
  if (!prop) return null;
  if (prop === true) return VALUE_LINE_DEFAULTS;
  return { ...VALUE_LINE_DEFAULTS, ...prop };
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
  if (!prop) return null;
  if (prop === true) return BADGE_DEFAULTS;
  return { ...BADGE_DEFAULTS, ...prop };
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
  if (!prop) return null;
  if (prop === true) return Y_AXIS_DEFAULTS;
  return { ...Y_AXIS_DEFAULTS, ...prop };
}

const X_AXIS_DEFAULTS: ResolvedXAxisConfig = {
  minGap: 60,
};

/**
 * Resolves `xAxis` prop to a fully-typed config or null (disabled).
 * Defaults to enabled (`true`) so `undefined` also returns the defaults.
 */
export function resolveXAxis(
  prop: boolean | XAxisConfig | undefined,
): ResolvedXAxisConfig | null {
  // xAxis defaults to ON — undefined treated as true
  if (prop === false) return null;
  if (prop === undefined || prop === true) return X_AXIS_DEFAULTS;
  return { ...X_AXIS_DEFAULTS, ...prop };
}

const SCRUB_DEFAULTS: ResolvedScrubConfig = {
  tooltip: true,
};

/**
 * Resolves `scrub` prop to a fully-typed config or null (disabled).
 * `true` → defaults, object → merged with defaults, falsy → null.
 */
export function resolveScrub(
  prop: boolean | ScrubConfig | undefined,
): ResolvedScrubConfig | null {
  if (!prop) return null;
  if (prop === true) return SCRUB_DEFAULTS;
  return { ...SCRUB_DEFAULTS, ...prop };
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
  if (!prop) return null;
  if (prop === true) return GRADIENT_DEFAULTS;
  return { ...GRADIENT_DEFAULTS, ...prop };
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
  if (!prop) return null;
  if (prop === true) return PULSE_DEFAULTS;
  return { ...PULSE_DEFAULTS, ...prop };
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
