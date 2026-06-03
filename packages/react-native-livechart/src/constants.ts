/** Milliseconds per frame at 60 fps — baseline for frame-rate-independent lerp. */
export const MS_PER_FRAME_60FPS = 16.67;

/** Extra speed applied to catch up when the live dot lags behind the target. */
export const ADAPTIVE_SPEED_BOOST = 0.12;

/** Horizontal padding inside the badge pill, on each side of the label. */
export const BADGE_PILL_PAD_X = 10;
/** Vertical padding above and below the label inside the badge pill. */
export const BADGE_PILL_PAD_Y = 3;
/** Length of the badge tail (the pointed spike toward the dot). */
export const BADGE_TAIL_LEN = 5;
/** Gap between the pill's right edge and the canvas right edge. */
export const BADGE_MARGIN_RIGHT = 4;
/** Gap between the live dot and the badge tail tip. */
export const BADGE_DOT_GAP = 12;

/** Maximum simultaneous series rendered (paths/dots slots). */
export const MAX_MULTI_SERIES = 12;

/** Default width (px) of the left-edge fade band */
export const FADE_EDGE_WIDTH = 40;

/** Empty-state label opacity. */
export const EMPTY_STATE_LABEL_ALPHA = 0.35;
/** Half-padding (px) around empty text for the squiggle “gap” erase band. */
export const EMPTY_TEXT_GAP_PAD = 20;
/** Horizontal fade width (px) on each side of the empty-text gap. */
export const EMPTY_GAP_FADE_WIDTH = 30;

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
