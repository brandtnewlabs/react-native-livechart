import type {
  BadgeMetrics,
  CandleMetrics,
  EmptyStateMetrics,
  GridMetrics,
  MotionMetrics,
} from "./types";

/** Milliseconds per frame at 60 fps — baseline for frame-rate-independent lerp. */
export const MS_PER_FRAME_60FPS = 16.67;

/**
 * Size of the pre-allocated Y-axis label pool — the most price labels the axis
 * ever renders at once. Caps both the dynamic (nice-interval) grid and the
 * fixed-`count` mode (see {@link YAxisConfig.count}).
 */
export const MAX_Y_LABELS = 15;

/**
 * Default press-and-hold (ms) before scrub engages in the `holdToScrub`
 * time-scroll mode, so a quick one-finger drag scrolls instead. Overridden by
 * `timeScroll.scrubHoldMs`, then `scrub.panGestureDelay`. Shared by `LiveChart`
 * and `LiveChartSeries`.
 */
export const HOLD_TO_SCRUB_MS = 500;

/**
 * Duration (ms) of the "return to live" glide — how long the window takes to ease
 * from a scrolled-back position to the live edge when `timeScroll` is disabled
 * (or a mode switch turns it off). Eased out so it decelerates onto live. See #164.
 */
export const RETURN_TO_LIVE_MS = 450;

/**
 * Duration (ms) of the fade applied to annotation overlays (markers + reference
 * lines) when `scrub.hideOverlaysOnScrub` is on — how long they take to ease out as a
 * scrub starts and back in on release. Driven by the scrub-active flag, eased on
 * the UI thread. Shared by `LiveChart` and `LiveChartSeries`.
 */
export const SCRUB_OVERLAY_FADE_MS = 150;

/**
 * Base wave amplitude (px) of the breathing loading squiggle — it breathes
 * between `0.4×` and `1.0×` this. Overridable via `loading={{ amplitude }}`.
 */
export const LOADING_WAVE_AMPLITUDE = 14;

/** Default breathing-wave speed multiplier (`1` = built-in cadence). */
export const LOADING_WAVE_SPEED = 1;

// ─── Metric default tokens (single source of truth for LiveChartMetrics) ─────
// The resolved `metrics` config (see resolveMetrics) is assembled from these
// objects. Draw/worklet helpers default their metric params to the matching
// object so call sites that don't thread metrics keep the built-in behavior.

/** Default value-badge pill geometry. */
export const BADGE_METRICS_DEFAULTS: BadgeMetrics = {
  padX: 10,
  padY: 3,
  tailLength: 5,
  marginEdge: 4,
  dotGap: 12,
  tailSpread: 2.5,
};

/** Default candlestick body/wick geometry. */
export const CANDLE_METRICS_DEFAULTS: CandleMetrics = {
  minBodyPx: 1,
  maxBodyPx: 40,
  bodyWidthRatio: 0.8,
  bodyRadius: 0,
  wickWidth: 1,
};

/** Default grid + axis-label fade speeds. */
export const GRID_METRICS_DEFAULTS: GridMetrics = {
  fadeInSpeed: 0.18,
  fadeOutSpeed: 0.12,
};

/** Default per-frame lerp speeds for value/color transitions. */
export const MOTION_METRICS_DEFAULTS: MotionMetrics = {
  badgeColorSpeed: 0.08,
  adaptiveSpeedBoost: 0.12,
};

/** Default empty-state (no-data) layout. */
export const EMPTY_STATE_METRICS_DEFAULTS: EmptyStateMetrics = {
  labelOpacity: 0.35,
  gapPad: 20,
  gapFadeWidth: 30,
};

// Back-compat scalar aliases — canonical source is BADGE_METRICS_DEFAULTS above.
/** Horizontal padding inside the badge pill, on each side of the label. */
export const BADGE_PILL_PAD_X = BADGE_METRICS_DEFAULTS.padX;
/** Vertical padding above and below the label inside the badge pill. */
export const BADGE_PILL_PAD_Y = BADGE_METRICS_DEFAULTS.padY;
/** Length of the badge tail (the pointed spike toward the dot). */
export const BADGE_TAIL_LEN = BADGE_METRICS_DEFAULTS.tailLength;
/** Gap between the pill's right edge and the canvas right edge. */
export const BADGE_MARGIN_RIGHT = BADGE_METRICS_DEFAULTS.marginEdge;
/** Gap between the live dot and the badge tail tip. */
export const BADGE_DOT_GAP = BADGE_METRICS_DEFAULTS.dotGap;

/** Baseline offset (px) below the plot bottom where x-axis time labels sit.
 *  Shared so overlays that align to the time-axis row (e.g. the scrub-action
 *  time badge) match the {@link XAxisOverlay} labels. */
export const X_AXIS_LABEL_OFFSET_Y = 19;

/** Maximum simultaneous series rendered (paths/dots slots). */
export const MAX_MULTI_SERIES = 12;

/** Default width (px) of the left-edge fade band */
export const FADE_EDGE_WIDTH = 40;

/**
 * Floats per degen particle slot: `x, y, vx, vy, t0, active, size, colorIndex`.
 * `colorIndex` selects which entry of the renderer's color list a particle uses
 * (multi-series sets it per series; single-series cycles it per particle).
 * Layout is fixed; not on `DegenOptions` because changing it needs matching renderer changes.
 */
export const DEGEN_STRIDE = 8;

/**
 * Default chart accent color — the full light/dark palette is derived from this
 * when a consumer omits `accentColor`. Single source of truth for the brand
 * default; change it here to re-brand the default everywhere.
 */
export const DEFAULT_ACCENT_COLOR = "#3323E6";
