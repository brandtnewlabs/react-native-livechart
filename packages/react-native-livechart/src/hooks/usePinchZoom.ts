import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import type { ChartPadding } from "../draw/line";
import { panLowerBound } from "./usePanScroll";

/** Engine SharedValues the pinch-zoom gesture reads/writes. */
export interface PinchZoomEngineRefs {
  /** Visible-window width override in seconds, or `null` to follow `timeWindow`. */
  viewWindow: SharedValue<number | null>;
  /** Absolute right-edge time, or `null` to follow the live edge (shared with pan). */
  viewEnd: SharedValue<number | null>;
  /** Right-edge time the engine would use if following live (advances each frame). */
  liveEdge: SharedValue<number>;
  /**
   * Animating visible window width in seconds. Written directly during a pinch so
   * the displayed window tracks the fingers 1:1 (the frame-loop lerp toward
   * `timeWindow` would otherwise lag a fast pinch and the focal anchor would drift).
   */
  displayWindow: SharedValue<number>;
  /** Canvas width in px. */
  canvasWidth: SharedValue<number>;
}

export interface UsePinchZoomOptions {
  engine: PinchZoomEngineRefs;
  padding: ChartPadding;
  /**
   * Earliest selectable time (unix seconds) — typically the first data point /
   * candle. Caps how far the (now wider) window can pan back when zooming out.
   */
  minTime: SharedValue<number>;
  /** The configured `timeWindow` prop (seconds) — the anchor for the zoom bounds. */
  timeWindow: number;
  /** Master switch. When false the gesture is disabled. */
  enabled: boolean;
  /** Tightest window (max zoom-in), seconds. Default `timeWindow / 8`. */
  minTimeWindow?: number;
  /** Widest window (max zoom-out), seconds. Default: the full data span, ≥ `timeWindow`. */
  maxTimeWindow?: number;
  /** Worklet fired when a pinch activates — e.g. to clear a lingering crosshair. */
  onZoomStart?: () => void;
}

/** Clamp a window width to `[minWin, maxWin]`. */
export function clampWindow(
  win: number,
  minWin: number,
  maxWin: number,
): number {
  "worklet";
  if (win < minWin) return minWin;
  if (win > maxWin) return maxWin;
  return win;
}

/**
 * Resolve the zoom bounds for a gesture. `maxWin` defaults to the data span but
 * never goes below the configured window (so you can always zoom back out to the
 * starting view); `minWin` defaults to an 8× zoom-in of the configured window.
 * Guards against an inverted range (min ≤ max).
 */
export function zoomWindowBounds(
  configWindow: number,
  span: number,
  minCfg: number | undefined,
  maxCfg: number | undefined,
): [number, number] {
  "worklet";
  const maxWin = Math.max(maxCfg ?? span, configWindow);
  let minWin = minCfg ?? configWindow / 8;
  if (minWin > maxWin) minWin = maxWin;
  return [minWin, maxWin];
}

/**
 * Absolute time under a pixel x, given the visible window. Inverse of the chart's
 * time→x projection: `x = chartLeft + (t - winStart)/window * chartW`.
 */
export function focalTime(
  focalX: number,
  chartLeft: number,
  chartW: number,
  winStart: number,
  windowSecs: number,
): number {
  "worklet";
  return winStart + ((focalX - chartLeft) / chartW) * windowSecs;
}

/**
 * The new right-edge time that keeps `focalT` pinned under `focalX` after the
 * window width changes to `newWindow` — i.e. zoom around the focal point. Derived
 * from the projection above by solving for the right edge (`winStart + window`):
 * the right edge sits `(fraction of the window to the right of the focal)` past
 * `focalT`.
 */
export function zoomViewEnd(
  focalT: number,
  focalX: number,
  chartLeft: number,
  chartW: number,
  newWindow: number,
): number {
  "worklet";
  const rightFraction = (chartLeft + chartW - focalX) / chartW;
  return focalT + rightFraction * newWindow;
}

/**
 * Pinch-to-zoom the visible time window, anchored at the focal point between the
 * two fingers (the time under your fingers stays put). Writes `engine.viewWindow`
 * (the window width) and `engine.viewEnd` (the right edge, so the focal anchor
 * holds) — the symmetric counterpart of {@link usePanScroll}, which only moves the
 * right edge. Pinch is two-finger, so it composes with the one-finger pan/scrub
 * via `Gesture.Simultaneous`.
 *
 * Reaching the live edge resumes following (`viewEnd → null`); the zoom level
 * (`viewWindow`) is independent of scroll position and persists.
 */
export function usePinchZoom({
  engine,
  padding,
  minTime,
  timeWindow,
  enabled,
  minTimeWindow,
  maxTimeWindow,
  onZoomStart,
}: UsePinchZoomOptions): ReturnType<typeof Gesture.Pinch> {
  const { viewWindow, viewEnd, liveEdge, displayWindow, canvasWidth } = engine;
  const padLeft = padding.left;
  const padRight = padding.right;

  // Snapshot at gesture start so the cumulative `scale`/`focalX` map from a fixed
  // origin (no compounding drift while pinching).
  const startWindow = useSharedValue(timeWindow);
  const startViewEnd = useSharedValue(0);

  const onStart =
    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    () => {
      "worklet";
      cancelAnimation(viewEnd);
      cancelAnimation(viewWindow);
      const edge = liveEdge.get();
      startWindow.set(viewWindow.get() ?? timeWindow);
      startViewEnd.set(viewEnd.get() ?? edge);
      onZoomStart?.();
    };

  const onChange =
    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    (e: { scale: number; focalX: number }) => {
      "worklet";
      const chartW = canvasWidth.get() - padLeft - padRight;
      if (chartW <= 0 || e.scale <= 0) return;
      const edge = liveEdge.get();
      const sWin = startWindow.get();
      const sEnd = startViewEnd.get();
      const span = edge - minTime.get();
      const [minWin, maxWin] = zoomWindowBounds(
        timeWindow,
        span,
        minTimeWindow,
        maxTimeWindow,
      );
      // Pinch out (scale > 1) ⇒ narrower window ⇒ zoom in.
      const newWin = clampWindow(sWin / e.scale, minWin, maxWin);
      // Time under the fingers, mapped through the START window so the anchor
      // doesn't compound; the right edge then keeps it under the (live) focal.
      const focalT = focalTime(e.focalX, padLeft, chartW, sEnd - sWin, sWin);
      let newEnd = zoomViewEnd(focalT, e.focalX, padLeft, chartW, newWin);
      const lo = panLowerBound(minTime.get(), newWin, edge);
      if (newEnd < lo) newEnd = lo;
      if (newEnd > edge) newEnd = edge;
      viewWindow.set(newWin);
      // Track the displayed window 1:1 (bypass the frame-loop lerp lag) so the
      // focal anchor is pixel-accurate during the gesture.
      displayWindow.set(newWin);
      viewEnd.set(newEnd >= edge ? null : newEnd);
    };

  return Gesture.Pinch().enabled(enabled).onStart(onStart).onChange(onChange);
}
