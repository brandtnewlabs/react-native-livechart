import type { ResolvedSegment } from "../core/resolveSegment";

/** Screen-space x-extent of a segment band, recomputed each frame. */
export interface SegmentBandX {
  visible: boolean;
  /** Band left edge (px), clamped into the plot. */
  bx1: number;
  /** Band right edge (px), clamped into the plot. */
  bx2: number;
}

const INVISIBLE_BAND: SegmentBandX = { visible: false, bx1: 0, bx2: 0 };

/**
 * Project a segment's `[from, to]` time range (unix seconds) to a clamped x-pixel
 * band within the plot `[x1, x2]`. Mirrors the time-band logic in
 * `useReferenceLine`: an omitted `from` extends to the left edge (window start),
 * an omitted `to` extends to the live edge (`now = winStart + win`). Swaps a
 * reversed range, culls a fully off-screen one, and clamps a partial one.
 */
export function segmentBandX(
  from: number | undefined,
  to: number | undefined,
  winStart: number,
  win: number,
  x1: number,
  x2: number,
): SegmentBandX {
  "worklet";
  if (win <= 0 || x2 <= x1) return INVISIBLE_BAND;
  const chartW = x2 - x1;
  const f = from ?? winStart;
  const t = to ?? winStart + win;

  let bx1 = x1 + ((f - winStart) / win) * chartW;
  let bx2 = x1 + ((t - winStart) / win) * chartW;
  if (bx2 < bx1) {
    const tmp = bx1;
    bx1 = bx2;
    bx2 = tmp;
  }
  if (bx2 < x1 || bx1 > x2) return INVISIBLE_BAND;
  if (bx1 < x1) bx1 = x1;
  if (bx2 > x2) bx2 = x2;
  return { visible: true, bx1, bx2 };
}

/**
 * Whether a segment should render its highlighted appearance: forced on by
 * `active`, otherwise on while the scrub crosshair sits inside the band's x-range.
 * `scrubX` is `-1` when idle, so the `scrubActive` gate keeps the range test safe.
 */
export function segmentHighlighted(
  active: boolean,
  scrubActive: boolean,
  scrubX: number,
  bx1: number,
  bx2: number,
): boolean {
  "worklet";
  if (active) return true;
  return scrubActive && scrubX >= bx1 && scrubX <= bx2;
}

/** Horizontal stroke gradient for the recolored line segments. */
export interface SegmentGradient {
  colors: string[];
  positions: number[];
}

/**
 * Build the horizontal gradient applied to the line stroke itself, implementing
 * "scrub focus" (the Robinhood model): the whole line is its plain `baseColor`
 * until the user scrubs (or a segment is forced `active`). While focused, the
 * segment under the scrub — or the `active` one — stays `baseColor` (full), and
 * every OTHER `recolorLine` segment is de-emphasized with its own `lineColor` /
 * `lineColors` (a different hue and/or a reduced alpha that fades it). Because it
 * paints the line directly (not a layer on top), an alpha-reduced color genuinely
 * lowers the line's opacity there.
 *
 * Stop positions are fractions of the full canvas width — the same coordinate
 * space as the gradient's `start`/`end` vectors. Each de-emphasized segment
 * contributes `base@f1 → color(s) across [f1,f2] → base@f2`, with duplicate
 * positions at the boundaries producing hard edges. The Skia gradient requires
 * non-decreasing positions, so stops are emitted in ascending x order and never
 * allowed to step backwards — overlapping/reversed/clamped segments can therefore
 * never feed a non-monotonic array.
 *
 * Returns `null` when the line should be uniform: not scrubbing and nothing
 * `active`, or when every segment is the focused one (nothing to de-emphasize).
 * The caller then strokes the line with its plain solid color.
 */
export function segmentLineGradient(
  segments: ResolvedSegment[],
  winStart: number,
  win: number,
  canvasWidth: number,
  plotLeft: number,
  plotRight: number,
  baseColor: string,
  scrubActive: boolean,
  scrubX: number,
): SegmentGradient | null {
  "worklet";
  if (win <= 0 || canvasWidth <= 0 || plotRight <= plotLeft) return null;

  // Focus mode is on only while scrubbing or when a segment is forced `active`.
  // Off → the whole line is its plain base color (segments are indistinguishable).
  let focusMode = scrubActive;
  if (!focusMode) {
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].recolorLine && segments[i].active) {
        focusMode = true;
        break;
      }
    }
  }
  if (!focusMode) return null;

  const chartW = plotRight - plotLeft;

  // Collect the NON-focused segments — they get de-emphasized (their lineColor);
  // the focused segment (under the scrub, or `active`) stays the base color.
  const spans: { f1: number; f2: number; cols: string[] }[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg.recolorLine) continue;

    const from = seg.from ?? winStart;
    const to = seg.to ?? winStart + win;
    let px1 = plotLeft + ((from - winStart) / win) * chartW;
    let px2 = plotLeft + ((to - winStart) / win) * chartW;
    if (px2 < px1) {
      const tmp = px1;
      px1 = px2;
      px2 = tmp;
    }
    if (px2 < plotLeft || px1 > plotRight) continue;
    if (px1 < plotLeft) px1 = plotLeft;
    if (px2 > plotRight) px2 = plotRight;

    const focused =
      (scrubActive && scrubX >= px1 && scrubX <= px2) || seg.active;
    if (focused) continue; // the focused segment keeps the full base color

    const f1 = px1 / canvasWidth;
    const f2 = px2 / canvasWidth;
    if (f2 <= f1) continue;
    const cols =
      seg.lineColors && seg.lineColors.length >= 2
        ? seg.lineColors
        : [seg.lineColor];
    spans.push({ f1, f2, cols });
  }
  if (spans.length === 0) return null; // nothing to de-emphasize → uniform line

  spans.sort((a, b) => a.f1 - b.f1);

  const colors: string[] = [];
  const positions: number[] = [];
  let last = 0;
  const push = (color: string, pos: number) => {
    // Stops must be non-decreasing for Skia. `px` is already clamped to the plot
    // (⊆ [0, canvasWidth]) so `pos` is within [0,1]; only the monotonic guard is
    // needed — it keeps overlapping/reversed spans from stepping backwards.
    const p = pos < last ? last : pos;
    colors.push(color);
    positions.push(p);
    last = p;
  };

  push(baseColor, 0);
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    push(baseColor, span.f1); // hard edge: base line up to the segment start
    const n = span.cols.length;
    if (n === 1) {
      push(span.cols[0], span.f1);
      push(span.cols[0], span.f2);
    } else {
      for (let k = 0; k < n; k++) {
        push(span.cols[k], span.f1 + (k / (n - 1)) * (span.f2 - span.f1));
      }
    }
    push(baseColor, span.f2); // hard edge: back to the base line after the segment
  }
  push(baseColor, 1);

  return { colors, positions };
}
