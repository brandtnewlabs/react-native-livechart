import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withDecay,
  type SharedValue,
} from "react-native-reanimated";

import type { ChartPadding } from "../draw/line";

/** Minimum height (px) of the bottom "grab the time ruler" band in axis-drag mode. */
export const AXIS_GRAB_MIN_PX = 44;
/** Horizontal travel (px) before a one-finger drag commits to scrolling vs. falling through. */
const AXIS_ACTIVATE_PX = 6;
/** Vertical travel (px) that fails the one-finger scroll so a parent vertical scroll wins. */
const HOLD_SCRUB_FAIL_Y_PX = 12;

/** Which gesture activates a time-scroll. */
export type PanScrollGestureMode = "holdToScrub" | "axisDrag";

/** Engine SharedValues the pan-scroll gesture reads/writes (subset of the engine state). */
export interface PanScrollEngineRefs {
  /** Absolute right-edge time to freeze at, or `null` to follow the live edge. */
  viewEnd: SharedValue<number | null>;
  /** Right-edge time the engine would use if following live (advances each frame). */
  liveEdge: SharedValue<number>;
  /** Animating visible window width in seconds. */
  displayWindow: SharedValue<number>;
  /** Canvas width in px. */
  canvasWidth: SharedValue<number>;
  /** Canvas height in px (for the axis-drag band hit-test). */
  canvasHeight: SharedValue<number>;
}

export interface UsePanScrollOptions {
  engine: PanScrollEngineRefs;
  padding: ChartPadding;
  /**
   * Earliest selectable time (unix seconds) — typically the first data point /
   * candle. Clamps how far back the window can pan. When there's no scrollable
   * history this should equal (or exceed) the live edge so panning is a no-op.
   */
  minTime: SharedValue<number>;
  /** Master switch. When false the gesture is disabled and the chart follows live. */
  enabled: boolean;
  /**
   * Activation model:
   *  - `"holdToScrub"` (default): a one-finger drag anywhere scrolls; scrub moves
   *    to press-and-hold (Rainbow-style). The caller must give the scrub gesture
   *    a long-press delay so a quick drag falls through to this one.
   *  - `"axisDrag"`: a one-finger drag starting in the bottom X-axis band ("grab
   *    the time ruler"); one-finger plot scrub untouched.
   */
  mode?: PanScrollGestureMode;
  /**
   * Worklet fired when a scroll drag activates — e.g. to clear the crosshair so
   * a stray scrub doesn't linger behind the pan.
   */
  onScrollStart?: () => void;
  /**
   * Set true for as long as this gesture owns the touch, cleared on finalize.
   * The hold-to-scrub pan reads it and refuses to activate mid-scroll — RNGH's
   * `Gesture.Race` declares no relation between the two pans, so this latch is
   * the only thing stopping the scrub's long-press timer from firing while the
   * chart is already being dragged. See `delayedPanGuard.shouldStartDelayedPan`.
   */
  scrollActive?: SharedValue<boolean>;
  /**
   * True while the scrub crosshair owns the touch. Scrolling is inert while set,
   * so an engaged scrub locks the chart in place and the finger only moves the
   * price indicator. Cleared when the finger lifts (the scrub pan's finalize).
   */
  scrubActive?: SharedValue<boolean>;
  /**
   * Fraction of the visible window (0–1) the pan may travel past the data
   * bounds — into blank future space beyond the live edge and blank history
   * before the oldest point (TradingView-style free dragging). `0` (default)
   * keeps the classic hard stops at the data. Resolved from
   * `timeScroll.overscroll` (see `resolveOverscroll`).
   */
  overscroll?: number;
}

/**
 * Snap-to-follow zone around the live edge, as a fraction of the window. With
 * overscroll a released drag/fling that settles within this zone re-attaches to
 * live; anything further out stays parked where it stopped.
 */
export const FOLLOW_SNAP = 0.02;

/**
 * Smallest valid right-edge time: keeps the window's left edge
 * (`rightEdge - window`) from passing `minTime`, and never exceeds the live edge
 * so the `[lo, liveEdge]` clamp range stays valid when history is short. With
 * `overscroll` the left edge may pass `minTime` by that fraction of the window,
 * exposing blank space before the oldest data.
 */
export function panLowerBound(
  minTime: number,
  windowSecs: number,
  liveEdge: number,
  overscroll: number = 0,
): number {
  "worklet";
  return Math.min(minTime + windowSecs * (1 - overscroll), liveEdge);
}

/**
 * Largest valid right-edge time: the live edge, pushed past it by `overscroll`
 * (a fraction of the window) so the latest data can be dragged toward the middle
 * of the plot, leaving blank future space on the right. `0` = the live edge.
 */
export function panUpperBound(
  windowSecs: number,
  liveEdge: number,
  overscroll: number,
): number {
  "worklet";
  return liveEdge + windowSecs * overscroll;
}

/**
 * Re-clamp a parked right edge after the overscroll setting changes. Reducing
 * the allowance must not leave a stale future/history position outside the new
 * bounds; at the classic live-edge hard stop, `null` resumes following live.
 */
export function clampViewEndForOverscroll(
  viewEnd: number,
  minTime: number,
  windowSecs: number,
  liveEdge: number,
  overscroll: number,
): number | null {
  "worklet";
  const lo = panLowerBound(minTime, windowSecs, liveEdge, overscroll);
  if (viewEnd < lo) return lo;
  const hi = panUpperBound(windowSecs, liveEdge, overscroll);
  if (viewEnd >= hi) return overscroll > 0 ? hi : null;
  return viewEnd;
}

/**
 * Next right-edge time after dragging `changeX` px (drag right ⇒ reveal earlier
 * time ⇒ smaller right edge), clamped to `[lo, panUpperBound]`. Without
 * overscroll, returns `null` once the drag reaches the live edge — the signal to
 * resume following.
 *
 * With overscroll it must NOT return `null` mid-drag: the pan's `onChange`
 * re-derives `cur` from `viewEnd ?? liveEdge` each frame, so snapping to follow
 * re-anchors every per-frame delta at the live edge and the drag can't escape it
 * in either direction. Re-attaching to live happens only in the release decay
 * callback (see `usePanScroll`), inside the {@link FOLLOW_SNAP} zone.
 */
export function nextViewEnd(
  cur: number,
  changeX: number,
  chartW: number,
  windowSecs: number,
  liveEdge: number,
  lo: number,
  overscroll: number = 0,
): number | null {
  "worklet";
  let next = cur - (changeX / chartW) * windowSecs;
  if (next < lo) next = lo;
  if (overscroll > 0) {
    const hi = panUpperBound(windowSecs, liveEdge, overscroll);
    if (next > hi) next = hi;
    return next;
  }
  if (next > liveEdge) next = liveEdge;
  return next >= liveEdge ? null : next;
}

/** Pan velocity (px/s) → time-seconds/s for `withDecay` (drag right ⇒ earlier). */
export function flingVelocity(
  velocityX: number,
  chartW: number,
  windowSecs: number,
): number {
  "worklet";
  return -(velocityX / chartW) * windowSecs;
}

/**
 * Top y (px) of the axis-drag grab band — a touch at or below this row starts a
 * scroll. The band is the bottom padding (where the time labels sit), widened to
 * a comfortable touch target.
 */
export function axisBandTop(canvasHeight: number, padBottom: number): number {
  "worklet";
  return canvasHeight - Math.max(padBottom, AXIS_GRAB_MIN_PX);
}

/**
 * Horizontal pan that scrolls the chart back through time. Pick the activation
 * with `mode`:
 *  - `"holdToScrub"` — a one-finger drag anywhere (activates on horizontal
 *    travel; vertical falls through). Scrub must be press-and-hold so a quick
 *    drag races past it (compose with `Gesture.Race`).
 *  - `"axisDrag"` — a one-finger drag starting in the bottom X-axis band, gated
 *    via `manualActivation` (compose with `Gesture.Exclusive`, this gesture
 *    first: outside the band it fails instantly so scrub runs).
 *
 * Writes `engine.viewEnd`: a number freezes the window at that absolute right
 * edge; `null` means "follow live". Dragging (or flinging) back to the live edge
 * resumes following.
 */
export function usePanScroll({
  engine,
  padding,
  minTime,
  enabled,
  mode = "holdToScrub",
  onScrollStart,
  scrollActive,
  scrubActive,
  overscroll = 0,
}: UsePanScrollOptions): ReturnType<typeof Gesture.Pan> {
  const { viewEnd, liveEdge, displayWindow, canvasWidth, canvasHeight } = engine;
  const padLeft = padding.left;
  const padRight = padding.right;
  const padBottom = padding.bottom;

  // Axis-drag activation tracking (manualActivation). Created unconditionally so
  // the hook order is stable; unused in hold-to-scrub mode.
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const armed = useSharedValue(false);
  const overscrollSV = useDerivedValue(() => overscroll);

  // A runtime config change (the demo exposes Off / 50% / 90%) applies to an
  // already parked window immediately. Without this, disabling overscroll while
  // parked in the future leaves a numeric `viewEnd`; re-enabling it later revives
  // that stale future position and makes the chart jump without a gesture.
  useAnimatedReaction(
    () => overscrollSV.value,
    /* istanbul ignore next -- UI-thread config reaction; pure clamp is unit-tested */
    (nextOverscroll) => {
      const cur = viewEnd.get();
      if (cur == null) return;
      const next = clampViewEndForOverscroll(
        cur,
        minTime.get(),
        displayWindow.get(),
        liveEdge.get(),
        nextOverscroll,
      );
      if (next !== cur) {
        cancelAnimation(viewEnd);
        viewEnd.set(next);
      }
    },
  );

  const onStart =
    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    () => {
      "worklet";
      // Stop an in-flight fling FIRST. `withDecay` keeps writing `viewEnd` after
      // the finger lifts, and `Gesture.Race` declares no relation between the two
      // pans, so this can run while a scrub is already engaged. Bailing out below
      // without cancelling left the decay sliding the window underneath the
      // crosshair — the opposite of the lock the scrub is meant to hold.
      cancelAnimation(viewEnd);
      // An engaged scrub locks the chart: the finger moves the price indicator
      // across a fixed window, so a scroll that activates underneath it must do
      // nothing further (and must not claim the touch via `scrollActive`).
      if (scrubActive?.get()) return;
      scrollActive?.set(true);
      // Keep `null` while following live. `onChange` resolves it to the current
      // live edge before applying the first delta. Materializing that same edge
      // here would falsely signal "scrolled back" between start and change,
      // briefly collapsing the floating-axis gutter on a forward-only overdrag.
      onScrollStart?.();
    };

  const onChange =
    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    (e: { changeX: number }) => {
      "worklet";
      if (scrubActive?.get()) return;
      const win = displayWindow.get();
      const chartW = canvasWidth.get() - padLeft - padRight;
      if (chartW <= 0) return;
      const edge = liveEdge.get();
      const cur = viewEnd.get() ?? edge;
      const lo = panLowerBound(minTime.get(), win, edge, overscroll);
      viewEnd.set(nextViewEnd(cur, e.changeX, chartW, win, edge, lo, overscroll));
    };

  const onEnd =
    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    (e: { velocityX: number }) => {
      "worklet";
      if (scrubActive?.get()) return;
      if (viewEnd.get() == null) return;
      const win = displayWindow.get();
      const chartW = canvasWidth.get() - padLeft - padRight;
      if (chartW <= 0) return;
      const edge = liveEdge.get();
      const lo = panLowerBound(minTime.get(), win, edge, overscroll);
      const hi = overscroll > 0 ? panUpperBound(win, edge, overscroll) : edge;
      // With overscroll the snap-to-follow zone widens from the exact live edge
      // to FOLLOW_SNAP of the window around it — this release callback is the
      // ONLY place that re-attaches to live (never mid-drag, see nextViewEnd).
      const snapZone = overscroll > 0 ? win * FOLLOW_SNAP : 1e-3;
      const velocity = flingVelocity(e.velocityX, chartW, win);
      cancelAnimation(viewEnd);
      viewEnd.set(
        withDecay({ velocity, clamp: [lo, hi] }, (finished) => {
          "worklet";
          // Landed near the live edge → resume following; stopped short (or
          // past, with overscroll) → stay frozen where inertia died.
          if (finished && Math.abs((viewEnd.get() ?? edge) - edge) <= snapZone) {
            viewEnd.set(null);
          }
        }),
      );
    };

  // Release the touch claim on every terminal state (END, FAIL, CANCEL), not just
  // onEnd — a scroll that fails its offset clamps never reaches onEnd, and a
  // stuck `scrollActive` would block scrub for the rest of the session.
  const onFinalize =
    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    () => {
      "worklet";
      scrollActive?.set(false);
    };

  if (mode === "axisDrag") {
    return Gesture.Pan()
      .enabled(enabled)
      .maxPointers(1)
      // Position-gate a one-finger pan: only a drag that starts in the bottom
      // axis band scrolls; everything else fails fast so scrub/parent gestures run.
      .manualActivation(true)
      .onTouchesDown(
        /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
        (e, manager) => {
          "worklet";
          const t = e.changedTouches[0];
          if (!t) return;
          if (t.y < axisBandTop(canvasHeight.get(), padBottom)) {
            armed.set(false);
            manager.fail();
            return;
          }
          armed.set(true);
          startX.set(t.x);
          startY.set(t.y);
        },
      )
      .onTouchesMove(
        /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
        (e, manager) => {
          "worklet";
          if (!armed.get()) return;
          const t = e.allTouches[0];
          if (!t) return;
          const dx = Math.abs(t.x - startX.get());
          const dy = Math.abs(t.y - startY.get());
          if (dx > AXIS_ACTIVATE_PX && dx >= dy) {
            manager.activate(); // horizontal intent → take the gesture
          } else if (dy > AXIS_ACTIVATE_PX) {
            manager.fail(); // vertical intent → release to parent/scroll
          }
        },
      )
      .onStart(onStart)
      .onChange(onChange)
      .onEnd(onEnd)
      .onFinalize(onFinalize);
  }

  // holdToScrub (default): a one-finger drag anywhere scrolls. Activate on
  // horizontal travel so a quick one-finger drag scrolls; a still press-hold
  // crosses no offset and falls through to the scrub gesture (which owns the
  // long-press). Vertical travel fails it so a parent vertical scroll wins.
  return Gesture.Pan()
    .enabled(enabled)
    .maxPointers(1)
    .activeOffsetX([-AXIS_ACTIVATE_PX, AXIS_ACTIVATE_PX])
    .failOffsetY([-HOLD_SCRUB_FAIL_Y_PX, HOLD_SCRUB_FAIL_Y_PX])
    .onStart(onStart)
    .onChange(onChange)
    .onEnd(onEnd)
    .onFinalize(onFinalize);
}
