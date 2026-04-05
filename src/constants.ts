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

/**
 * Floats per degen particle slot: `x, y, vx, vy, t0, active, size`.
 * Layout is fixed; not on `DegenOptions` because changing it needs matching renderer changes.
 */
export const DEGEN_STRIDE = 7;
