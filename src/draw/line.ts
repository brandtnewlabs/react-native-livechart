import {
  BADGE_DOT_GAP,
  BADGE_MARGIN_RIGHT,
  BADGE_PILL_PAD_X,
  BADGE_PILL_PAD_Y,
  BADGE_TAIL_LEN,
} from "../constants";
import type { ChartInsets, LiveChartPoint } from "../types";
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

/** Auto-right-padding: badge needs space for the pill, y-axis labels need less. */
export function resolveAutoRight(yAxis: boolean, badge: boolean): number {
  // Fallback when no font/value is available for measurement.
  // Assumes a typical label ~7 chars × 7px = 49px at 12px font size.
  if (badge) return minPaddingRightForBadgeYAxisAlign(12, 49);
  if (yAxis) return 44;
  return DEFAULT_PADDING.right;
}

/**
 * Minimum `padding.left` for a badge pill drawn in the left chart margin (label width + horizontal padding + dot gap).
 * `resolveChartLayout` does not call this; it remains available for custom layouts or `resolvePadding(..., badgeOnLeft: true)`.
 */
export function minPaddingLeftForBadge(textWidth: number): number {
  return Math.ceil(
    BADGE_MARGIN_RIGHT + 2 * BADGE_PILL_PAD_X + textWidth + BADGE_DOT_GAP,
  );
}

/** Default left inset, or a wider inset when `badgeOnLeft` is true (see `minPaddingLeftForBadge`). */
export function resolveAutoLeft(badgeOnLeft: boolean): number {
  if (badgeOnLeft) return minPaddingLeftForBadge(49);
  return DEFAULT_PADDING.left;
}

/**
 * Minimum inset from the canvas edge so the live-dot pulse ring is not clipped.
 * Matches `DotOverlay`: circle radius up to `maxRadius` with a centered stroke.
 *
 * Used by `resolveChartLayout` when `pulse` is set; keep in sync with `DotOverlay` pulse rendering.
 *
 * @see `resolveChartLayout` in `hooks/resolveChartLayout.ts`
 * @see `DotOverlay` in `components/DotOverlay.tsx`
 */
export function pulseRadialOutset(
  maxRadius: number,
  strokeWidth: number,
): number {
  return Math.ceil(maxRadius + strokeWidth / 2);
}

/** Extra space beyond label width so the pulse ring does not touch glyphs. */
const PULSE_Y_AXIS_LABEL_GAP = 8;

/**
 * Minimum `padding.right` when the live dot (and pulse) sit on the inner edge of the
 * right gutter and y-axis labels are centered in that gutter (`gutterCenteredTextLeftX`).
 * Otherwise the pulse can overlap labels to the right of the dot.
 */
export function minPaddingRightForYAxisWithPulse(
  pulseOutlet: number,
  yAxisLabelTextWidth: number,
  gap = PULSE_Y_AXIS_LABEL_GAP,
): number {
  return Math.ceil(2 * pulseOutlet + yAxisLabelTextWidth + gap);
}

export function resolvePadding(
  override?: ChartInsets,
  yAxis = false,
  badge = false,
  badgeOnLeft = false,
  xAxis = true,
): ChartPadding {
  const autoRight = resolveAutoRight(yAxis, badge && !badgeOnLeft);
  const autoLeft = resolveAutoLeft(badgeOnLeft);
  const autoBottom = xAxis ? DEFAULT_PADDING.bottom : 8;
  if (!override) {
    return {
      ...DEFAULT_PADDING,
      right: autoRight,
      left: autoLeft,
      bottom: autoBottom,
    };
  }
  return {
    top: override.top ?? DEFAULT_PADDING.top,
    right: override.right ?? autoRight,
    bottom: override.bottom ?? autoBottom,
    left: override.left ?? autoLeft,
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
  data: LiveChartPoint[],
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
