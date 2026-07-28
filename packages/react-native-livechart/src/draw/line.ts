import { BADGE_METRICS_DEFAULTS } from "../constants";
import type { BadgeMetrics, ChartInsets, LiveChartPoint } from "../types";
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
 *
 * When `showTail` is false the tail spike is omitted and only the round cap
 * radius is returned, letting callers shrink the right gutter.
 */
export function badgeTailAndCap(
  fontSize: number,
  showTail = true,
  badge: BadgeMetrics = BADGE_METRICS_DEFAULTS,
): number {
  "worklet";
  const pillH = fontSize + badge.padY * 2;
  return (showTail ? badge.tailLength : 0) + pillH / 2;
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
  badge: BadgeMetrics = BADGE_METRICS_DEFAULTS,
): number {
  "worklet";
  const bodyLeft = canvasWidth - paddingRight + tl;
  const bodyRight = canvasWidth - badge.marginEdge;
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
 * Right-aligned text positioning — used for y-axis labels when inline series
 * labels occupy the left portion of the right gutter.
 */
export function gutterRightAlignedTextLeftX(
  canvasWidth: number,
  textWidth: number,
  rightMargin = 4,
): number {
  "worklet";
  return canvasWidth - textWidth - rightMargin;
}

/**
 * Minimum `padding.right` for the badge gutter.
 *
 * Layout: |dot| BADGE_DOT_GAP | tl | PAD_X | text | PAD_X | BADGE_MARGIN_RIGHT |canvas edge
 */
export function minPaddingRightForBadgeYAxisAlign(
  fontSize: number,
  textWidth: number,
  showTail = true,
  badge: BadgeMetrics = BADGE_METRICS_DEFAULTS,
): number {
  const tl = badgeTailAndCap(fontSize, showTail, badge);
  return Math.ceil(
    badge.dotGap + tl + 2 * badge.padX + textWidth + badge.marginEdge,
  );
}

/** Auto-right-padding: badge needs space for the pill, y-axis labels need less. */
export function resolveAutoRight(
  yAxis: boolean,
  badge: boolean,
  showTail = true,
  badgeMetrics: BadgeMetrics = BADGE_METRICS_DEFAULTS,
): number {
  if (badge) return minPaddingRightForBadgeYAxisAlign(12, 49, showTail, badgeMetrics);
  if (yAxis) return 44;
  return DEFAULT_PADDING.right;
}

/**
 * Minimum `padding.left` for a badge pill drawn in the left chart margin (label width + horizontal padding + dot gap).
 * `resolveChartLayout` does not call this; it remains available for custom layouts or `resolvePadding(..., badgeOnLeft: true)`.
 */
export function minPaddingLeftForBadge(
  textWidth: number,
  badge: BadgeMetrics = BADGE_METRICS_DEFAULTS,
): number {
  return Math.ceil(
    badge.marginEdge + 2 * badge.padX + textWidth + badge.dotGap,
  );
}

/** Default left inset, or a wider inset when `badgeOnLeft` is true (see `minPaddingLeftForBadge`). */
export function resolveAutoLeft(
  badgeOnLeft: boolean,
  badgeMetrics: BadgeMetrics = BADGE_METRICS_DEFAULTS,
): number {
  if (badgeOnLeft) return minPaddingLeftForBadge(49, badgeMetrics);
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
  showTail = true,
  badgeMetrics: BadgeMetrics = BADGE_METRICS_DEFAULTS,
): ChartPadding {
  const autoRight = resolveAutoRight(
    yAxis,
    badge && !badgeOnLeft,
    showTail,
    badgeMetrics,
  );
  const autoLeft = resolveAutoLeft(badgeOnLeft, badgeMetrics);
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
 * and appends a live tip at (now, displayValue) unless `appendLiveTip` is false —
 * in which case the line is instead closed at the right edge with the
 * interpolated *data* value there (see below).
 *
 * Flat layout avoids ~150 tuple object allocations per frame.
 *
 * Pass `out` to reuse a persistent array instead of allocating a fresh one each
 * frame (it is cleared and refilled). The per-frame allocation otherwise scales
 * with the visible point count, so pooling it cuts UI-thread GC pressure on
 * busy / wide-window charts. Callers that pool `out` must ping-pong two buffers
 * so the returned reference still changes each frame (Reanimated's value-equality
 * check skips notifying subscribers when the reference is unchanged).
 *
 * The live tip is pinned to the plot's RIGHT EDGE (x = left + chartW), not to a
 * time — it is only in the right place while the window follows the live edge
 * (`now === liveEdge`). Pass `appendLiveTip: false` when the window is frozen
 * behind the live edge, otherwise the tip drags the line from the last visible
 * sample to an off-screen price. Candle mode needs no such flag: a candle is
 * positioned from its own `time` and `appendCandleShapes` drops it once it
 * leaves the window, so the live candle disappears on its own.
 *
 * With `appendLiveTip: false` the line is still closed at the right edge, but
 * with the value the data itself has at `now` (linearly interpolated between the
 * samples bracketing it) instead of the live price. That keeps the line reaching
 * the edge while scrolled back, and keeps a window that lands inside a data gap
 * from collapsing to a single point (which every consumer discards).
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
  out?: number[],
  appendLiveTip = true,
): number[] {
  "worklet";
  const pts: number[] = out ?? [];
  if (out) out.length = 0;
  const chartW = canvasWidth - padding.left - padding.right;
  const chartH = canvasHeight - padding.top - padding.bottom;
  const valRange = displayMax - displayMin;

  if (valRange === 0 || chartW <= 0 || chartH <= 0 || data.length === 0)
    return pts;

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

  // End of the visible range: first index strictly after `now` (upper bound).
  let elo = startIdx;
  let ehi = data.length;
  while (elo < ehi) {
    const emid = (elo + ehi) >> 1;
    if (data[emid].time <= now) elo = emid + 1;
    else ehi = emid;
  }
  const endIdx = elo;

  const xScale = chartW / windowSecs;
  const yScale = chartH / valRange;

  // Decimate to ~2 points per horizontal pixel once the window is denser than
  // that. Drawing more points than the canvas is wide is wasted per-frame work
  // (array build + Skia stroke) that scales with sample count rather than
  // pixels — the dominant cost on dense / wide-window charts, and the reason
  // scrubbing a saturated window drops frames. Below the threshold we keep the
  // exact per-sample path (and existing behaviour) untouched.
  const maxPlainPoints = Math.ceil(chartW * 2);

  if (endIdx - startIdx <= maxPlainPoints) {
    for (let i = startIdx; i < endIdx; i++) {
      pts.push(
        padding.left + (data[i].time - winStart) * xScale,
        padding.top + (displayMax - data[i].value) * yScale,
      );
    }
  } else {
    // Min/max-per-pixel-column decimation: within each pixel column keep the
    // lowest- and highest-value samples (emitted in their original time order)
    // so the line's envelope and any volatility spikes survive at full vertical
    // fidelity while the point count stays bounded by the canvas width.
    let curCol = -2147483648;
    let minIdx = startIdx;
    let maxIdx = startIdx;
    for (let i = startIdx; i < endIdx; i++) {
      const col = ((data[i].time - winStart) * xScale) | 0;
      if (col !== curCol) {
        if (curCol !== -2147483648) {
          const a = minIdx <= maxIdx ? minIdx : maxIdx;
          const b = minIdx <= maxIdx ? maxIdx : minIdx;
          pts.push(
            padding.left + (data[a].time - winStart) * xScale,
            padding.top + (displayMax - data[a].value) * yScale,
          );
          if (b !== a) {
            pts.push(
              padding.left + (data[b].time - winStart) * xScale,
              padding.top + (displayMax - data[b].value) * yScale,
            );
          }
        }
        curCol = col;
        minIdx = i;
        maxIdx = i;
      } else {
        if (data[i].value < data[minIdx].value) minIdx = i;
        if (data[i].value > data[maxIdx].value) maxIdx = i;
      }
    }
    // Flush the final column.
    const a = minIdx <= maxIdx ? minIdx : maxIdx;
    const b = minIdx <= maxIdx ? maxIdx : minIdx;
    pts.push(
      padding.left + (data[a].time - winStart) * xScale,
      padding.top + (displayMax - data[a].value) * yScale,
    );
    if (b !== a) {
      pts.push(
        padding.left + (data[b].time - winStart) * xScale,
        padding.top + (displayMax - data[b].value) * yScale,
      );
    }
  }

  // Live tip at current time with smoothed value
  if (appendLiveTip) {
    pts.push(
      padding.left + chartW,
      padding.top + ((displayMax - displayValue) / valRange) * chartH,
    );
  } else if (pts.length >= 2) {
    // No live tip: the window is frozen behind the live edge. Close the line at
    // the plot's right edge with the value the DATA has at `now`, linearly
    // interpolated between the two samples bracketing it. This is not the live
    // tip in disguise — the tip draws the live (off-screen) price at the edge,
    // this draws the price the frozen right edge actually points at, which is the
    // correct value while scrolled back. It fixes two symptoms:
    //  - A window whose whole span falls inside a data gap emits exactly ONE
    //    point (the pre-window sample kept for left-edge entry). Every consumer
    //    discards a run shorter than two points, so the chart drew grid and axes
    //    with no line, no gradient fill and no threshold band at all.
    //  - Otherwise the line stops at the last sample <= `now`, up to one bucket
    //    short of the right edge, and that shortfall shrinks and grows as the
    //    window slides — a gap that visibly breathes while dragging.
    const exitX = padding.left + chartW;
    // Skip a zero-width segment when the last emitted sample already sits on the
    // edge (`data[endIdx - 1].time === now`): a duplicated x makes `drawSpline`
    // treat the interval as flat and zero the final tangent on both ends of it.
    if (exitX - pts[pts.length - 2] > 1e-3) {
      // Reaching here means the loop above emitted at least one point, so
      // `endIdx > startIdx >= 0` and `data[endIdx - 1]` is in bounds.
      const a = data[endIdx - 1];
      // `endIdx` is the first index after `now`; at or past the end of the array
      // there is no later sample to interpolate towards (the window is scrolled
      // past the newest data), so hold the last known value out to the edge
      // instead of reading off the end.
      const b = endIdx < data.length ? data[endIdx] : a;
      const span = b.time - a.time;
      // `frac` is clamped so the result can only ever be a convex blend of `a` and
      // `b`, never an extrapolation into a spike off the plot.
      //
      // It cannot currently fire: `elo` reaches `endIdx` only via `elo = emid + 1`
      // with `emid === endIdx - 1`, on the branch that tested
      // `data[endIdx - 1].time <= now`; and `ehi` reaches `endIdx` only via
      // `ehi = emid` with `emid === endIdx`, on the branch that tested
      // `data[endIdx].time > now`. So `a.time <= now < b.time` — hence `span > 0`
      // and `frac` in [0, 1) — holds for ANY input, sorted or not. The clamp keeps
      // that a local, obvious invariant rather than a three-step argument about
      // the index math above, so refactoring that search can't silently turn this
      // interpolation into an extrapolation.
      //
      // `span === 0` only happens when `b === a` (no sample after the window), and
      // then `frac = 0` holds `a`'s own value out to the edge.
      const frac = span > 0 ? Math.min(1, Math.max(0, (now - a.time) / span)) : 0;
      const exitValue = a.value + frac * (b.value - a.value);
      pts.push(exitX, padding.top + (displayMax - exitValue) * yScale);
    }
  }

  return pts;
}
