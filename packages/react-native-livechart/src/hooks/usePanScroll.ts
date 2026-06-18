import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  withDecay,
  type SharedValue,
} from "react-native-reanimated";

import type { ChartPadding } from "../draw/line";

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
 * Two-finger horizontal pan that scrolls the chart back through time. One-finger
 * scrub is left entirely untouched — compose this alongside it (e.g.
 * `Gesture.Race`); the pointer-count split (2 here, 1 for scrub) disambiguates.
 *
 * Writes `engine.viewEnd`: a number freezes the window at that absolute right
 * edge; `null` means "follow live". Dragging (or flinging) back to the live edge
 * resumes following so new data scrolls in again.
 */
export function usePanScroll({
  engine,
  padding,
  minTime,
  enabled,
  onScrollStart,
}: UsePanScrollOptions): ReturnType<typeof Gesture.Pan> {
  const { viewEnd, liveEdge, displayWindow, canvasWidth } = engine;
  const padLeft = padding.left;
  const padRight = padding.right;

  return (
    Gesture.Pan()
      .enabled(enabled)
      // Two fingers only — leaves the one-finger scrub gesture alone.
      .minPointers(2)
      .maxPointers(2)
      .averageTouches(true)
      .onStart(
        /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
        () => {
          "worklet";
          cancelAnimation(viewEnd);
          // Anchor at the current right edge so the first delta is relative to
          // where the window sits (the live edge when we were following).
          if (viewEnd.get() == null) viewEnd.set(liveEdge.get());
          onScrollStart?.();
        },
      )
      .onChange(
        /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
        (e) => {
          "worklet";
          const win = displayWindow.get();
          const chartW = canvasWidth.get() - padLeft - padRight;
          if (chartW <= 0) return;
          const edge = liveEdge.get();
          const cur = viewEnd.get() ?? edge;
          const lo = panLowerBound(minTime.get(), win, edge);
          viewEnd.set(nextViewEnd(cur, e.changeX, chartW, win, edge, lo));
        },
      )
      .onEnd(
        /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
        (e) => {
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
              // Landed on the live-edge clamp → resume following; stopped short
              // → stay frozen where inertia died.
              if (finished && (viewEnd.get() ?? edge) >= edge - 1e-3) {
                viewEnd.set(null);
              }
            }),
          );
        },
      )
  );
}
