import {
  BADGE_DOT_GAP,
  BADGE_MARGIN_RIGHT,
  BADGE_PILL_PAD_X,
  BADGE_PILL_PAD_Y,
  BADGE_TAIL_LEN,
} from "../constants";
import type { LivelinePoint, Padding } from "../types";
export {
  BADGE_DOT_GAP,
  BADGE_MARGIN_RIGHT,
  BADGE_PILL_PAD_X,
  BADGE_PILL_PAD_Y,
  BADGE_TAIL_LEN
} from "../constants";

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_PADDING: ChartPadding = {
  top: 12,
  right: 12,
  bottom: 28,
  left: 12,
};

/**
 * Combined tail + rounded-cap offset.
 * The pill body starts `tl` px to the right of the gutter left edge (= dot x),
 * so the tail spans the gap between the dot and the pill body.
 */
export function badgeTailAndCap(fontSize: number): number {
  "worklet";
  const pillH = fontSize + BADGE_PILL_PAD_Y * 2;
  return BADGE_TAIL_LEN + pillH / 2;
}

/**
 * Text left-edge X so the label is horizontally centered in the badge pill.
 * Uses the ASYMMETRIC layout: tail gap (`tl`) on the left, `BADGE_MARGIN_RIGHT` on
 * the right. Both `useBadge` and `GridOverlay` (when badge is shown) call this so
 * the badge text and y-axis labels share the exact same horizontal position.
 *
 * Layout: |dot| tl |PAD_X| text |PAD_X| BADGE_MARGIN_RIGHT |canvas edge
 *                         ↑ same x for grid labels and badge text
 */
export function pillTextLeftX(
  canvasWidth: number,
  paddingRight: number,
  tl: number,
  textWidth: number,
): number {
  "worklet";
  const bodyLeft = canvasWidth - paddingRight + tl;
  const bodyRight = canvasWidth - BADGE_MARGIN_RIGHT;
  return (bodyLeft + bodyRight - textWidth) / 2;
}

/**
 * Symmetric gutter centering — used for y-axis labels when badge is NOT shown.
 * When badge IS shown, use `pillTextLeftX` instead so labels align with badge text.
 */
export function gutterCenteredTextLeftX(
  canvasWidth: number,
  paddingRight: number,
  textWidth: number,
): number {
  "worklet";
  return canvasWidth - paddingRight / 2 - textWidth / 2;
}

/**
 * Minimum `padding.right` for the badge gutter.
 *
 * Layout: |dot| BADGE_DOT_GAP | tl | PAD_X | text | PAD_X | BADGE_MARGIN_RIGHT |canvas edge
 */
export function minPaddingRightForBadgeYAxisAlign(
  fontSize: number,
  textWidth: number,
): number {
  const tl = badgeTailAndCap(fontSize);
  return Math.ceil(
    BADGE_DOT_GAP + tl + 2 * BADGE_PILL_PAD_X + textWidth + BADGE_MARGIN_RIGHT,
  );
}

/** Auto-right-padding: badge needs space for the pill, grid labels need less. */
export function resolveAutoRight(grid: boolean, badge: boolean): number {
  // Fallback when no font/value is available for measurement.
  // Assumes a typical label ~7 chars × 7px = 49px at 12px font size.
  if (badge) return minPaddingRightForBadgeYAxisAlign(12, 49);
  if (grid) return 44;
  return DEFAULT_PADDING.right;
}

export function resolvePadding(
  override?: Padding,
  grid = false,
  badge = false,
): ChartPadding {
  const autoRight = resolveAutoRight(grid, badge);
  if (!override) return { ...DEFAULT_PADDING, right: autoRight };
  return {
    top: override.top ?? DEFAULT_PADDING.top,
    right: override.right ?? autoRight,
    bottom: override.bottom ?? DEFAULT_PADDING.bottom,
    left: override.left ?? DEFAULT_PADDING.left,
  };
}

/**
 * Build screen-space points as a flat number array [x0, y0, x1, y1, ...].
 * Includes one point before the window for smooth left-edge entry,
 * and appends a live tip at (now, displayValue).
 *
 * Flat layout avoids ~150 tuple object allocations per frame.
 */
export function buildLinePoints(
  data: LivelinePoint[],
  displayValue: number,
  now: number,
  windowSecs: number,
  displayMin: number,
  displayMax: number,
  canvasWidth: number,
  canvasHeight: number,
  padding: ChartPadding,
): number[] {
  "worklet";
  const chartW = canvasWidth - padding.left - padding.right;
  const chartH = canvasHeight - padding.top - padding.bottom;
  const valRange = displayMax - displayMin;

  if (valRange === 0 || chartW <= 0 || chartH <= 0 || data.length === 0)
    return [];

  const winStart = now - windowSecs;

  // Binary search for first point >= winStart
  let lo = 0;
  let hi = data.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].time < winStart) lo = mid + 1;
    else hi = mid;
  }
  const startIdx = Math.max(0, lo - 1);

  const pts: number[] = [];
  for (let i = startIdx; i < data.length; i++) {
    if (data[i].time > now) break;
    pts.push(
      padding.left + ((data[i].time - winStart) / windowSecs) * chartW,
      padding.top + ((displayMax - data[i].value) / valRange) * chartH,
    );
  }

  // Live tip at current time with smoothed value
  pts.push(
    padding.left + chartW,
    padding.top + ((displayMax - displayValue) / valRange) * chartH,
  );

  return pts;
}
