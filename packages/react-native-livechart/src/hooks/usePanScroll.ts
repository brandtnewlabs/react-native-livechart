import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  useSharedValue,
  withDecay,
  type SharedValue,
} from "react-native-reanimated";

import type { ChartPadding } from "../draw/line";

/** Minimum height (px) of the bottom "grab the time ruler" band in axis-drag mode. */
const AXIS_GRAB_MIN_PX = 44;
/** Horizontal travel (px) before an axis-drag commits to scrolling vs. falling through. */
const AXIS_ACTIVATE_PX = 6;

/** Which gesture activates a time-scroll. */
export type PanScrollGestureMode = "twoFinger" | "axisDrag";

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
   * Activation model. `"twoFinger"` (default): a two-finger drag anywhere.
   * `"axisDrag"`: a one-finger drag starting in the bottom X-axis band ("grab
   * the time ruler"). One-finger scrub in the plot area is untouched either way.
   */
  mode?: PanScrollGestureMode;
  /**
   * Worklet fired when a scroll drag activates — e.g. to clear the crosshair so
   * a stray scrub doesn't linger behind the pan.
   */
  onScrollStart?: () => void;
}

/**
 * Smallest valid right-edge time: keeps the window's left edge
 * (`rightEdge - window`) from passing `minTime`, and never exceeds the live edge
 * so the `[lo, liveEdge]` clamp range stays valid when history is short.
 */
export function panLowerBound(
  minTime: number,
  windowSecs: number,
  liveEdge: number,
): number {
  "worklet";
  return Math.min(minTime + windowSecs, liveEdge);
}

/**
 * Next right-edge time after dragging `changeX` px (drag right ⇒ reveal earlier
 * time ⇒ smaller right edge), clamped to `[lo, liveEdge]`. Returns `null` once
 * the drag reaches the live edge — the signal to resume following.
 */
export function nextViewEnd(
  cur: number,
  changeX: number,
  chartW: number,
  windowSecs: number,
  liveEdge: number,
  lo: number,
): number | null {
  "worklet";
  let next = cur - (changeX / chartW) * windowSecs;
  if (next < lo) next = lo;
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
 * Horizontal pan that scrolls the chart back through time. One-finger plot-area
 * scrub is left untouched; pick the activation with `mode`:
 *  - `"twoFinger"` — a two-finger drag anywhere (compose with `Gesture.Race`;
 *    pointer count disambiguates it from the one-finger scrub).
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
  mode = "twoFinger",
  onScrollStart,
}: UsePanScrollOptions): ReturnType<typeof Gesture.Pan> {
  const { viewEnd, liveEdge, displayWindow, canvasWidth, canvasHeight } = engine;
  const padLeft = padding.left;
  const padRight = padding.right;
  const padBottom = padding.bottom;

  // Axis-drag activation tracking (manualActivation). Created unconditionally so
  // the hook order is stable; unused in two-finger mode.
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const armed = useSharedValue(false);

  const onStart =
    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    () => {
      "worklet";
      cancelAnimation(viewEnd);
      // Anchor at the current right edge so the first delta is relative to where
      // the window sits (the live edge when we were following).
      if (viewEnd.get() == null) viewEnd.set(liveEdge.get());
      onScrollStart?.();
    };

  const onChange =
    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    (e: { changeX: number }) => {
      "worklet";
      const win = displayWindow.get();
      const chartW = canvasWidth.get() - padLeft - padRight;
      if (chartW <= 0) return;
      const edge = liveEdge.get();
      const cur = viewEnd.get() ?? edge;
      const lo = panLowerBound(minTime.get(), win, edge);
      viewEnd.set(nextViewEnd(cur, e.changeX, chartW, win, edge, lo));
    };

  const onEnd =
    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    (e: { velocityX: number }) => {
      "worklet";
      if (viewEnd.get() == null) return;
      const win = displayWindow.get();
      const chartW = canvasWidth.get() - padLeft - padRight;
      if (chartW <= 0) return;
      const edge = liveEdge.get();
      const lo = panLowerBound(minTime.get(), win, edge);
      const velocity = flingVelocity(e.velocityX, chartW, win);
      cancelAnimation(viewEnd);
      viewEnd.set(
        withDecay({ velocity, clamp: [lo, edge] }, (finished) => {
          "worklet";
          // Landed on the live-edge clamp → resume following; stopped short →
          // stay frozen where inertia died.
          if (finished && (viewEnd.get() ?? edge) >= edge - 1e-3) {
            viewEnd.set(null);
          }
        }),
      );
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
      .onEnd(onEnd);
  }

  return Gesture.Pan()
    .enabled(enabled)
    // Two fingers only — leaves the one-finger scrub gesture alone.
    .minPointers(2)
    .maxPointers(2)
    .averageTouches(true)
    .onStart(onStart)
    .onChange(onChange)
    .onEnd(onEnd);
}
