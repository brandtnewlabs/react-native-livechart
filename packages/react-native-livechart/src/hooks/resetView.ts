import {
  cancelAnimation,
  Easing,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import type { ChartScale } from "../types";

/** Duration (ms) of the eased `yRangeScale` → 1 when no price pan is active. */
export const Y_RANGE_SCALE_RESET_MS = 240;

/** The subset of {@link ResetViewRefs} a chart without price panning resets. */
export type ResetSeriesViewRefs = Pick<
  ResetViewRefs,
  "viewEnd" | "viewWindow" | "yRangeScale"
>;

/**
 * `LiveChartSeries` counterpart of {@link resetChartView}: clear the pinch
 * window and frozen edge (as `resetZoom()`) and ease `yRangeScale` back to 1.
 */
export function resetSeriesView(refs: ResetSeriesViewRefs): void {
  "worklet";
  const { viewEnd, viewWindow, yRangeScale } = refs;
  cancelAnimation(viewWindow);
  cancelAnimation(viewEnd);
  viewWindow.set(null);
  viewEnd.set(null);
  cancelAnimation(yRangeScale);
  yRangeScale.set(withTiming(1, { duration: Y_RANGE_SCALE_RESET_MS }));
}

/** Engine SharedValues a reset writes. */
export interface ResetViewRefs {
  viewEnd: SharedValue<number | null>;
  viewWindow: SharedValue<number | null>;
  viewRange: SharedValue<Pick<ChartScale, "min" | "max"> | null>;
  viewRangeGestureOwned: SharedValue<boolean>;
  yRangeScale: SharedValue<number>;
  returnT: SharedValue<number>;
  returnFrom: SharedValue<number>;
  /** "Return to live" glide duration in ms; `0` snaps. */
  returnToLiveMs: number;
}

/**
 * Return the chart to its fitted live view on the UI thread: clear the pinch
 * window, glide the right edge back to live (the `timeScroll.returnToLive`
 * timing, see #164), drop a gesture-owned price range and land `yRangeScale`
 * on 1. Safe to call when the view is already fitted.
 */
export function resetChartView(refs: ResetViewRefs): void {
  "worklet";
  const {
    viewEnd,
    viewWindow,
    viewRange,
    viewRangeGestureOwned,
    yRangeScale,
    returnT,
    returnFrom,
    returnToLiveMs,
  } = refs;
  cancelAnimation(viewWindow);
  viewWindow.set(null);
  const frozenEnd = viewEnd.get();
  cancelAnimation(viewEnd);
  viewEnd.set(null);
  if (frozenEnd != null && returnToLiveMs > 0) {
    returnFrom.set(frozenEnd);
    returnT.set(0);
    returnT.set(
      withTiming(1, {
        duration: returnToLiveMs,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }
  cancelAnimation(yRangeScale);
  if (viewRangeGestureOwned.get()) {
    // Land the scale in one step: the tick snaps the range while the scale is
    // moving, which would jump the panned window onto the scaled fit before
    // easing. With the scale parked, the display range eases from the panned
    // window to the fit instead.
    viewRange.set(null);
    viewRangeGestureOwned.set(false);
    yRangeScale.set(1);
  } else {
    yRangeScale.set(withTiming(1, { duration: Y_RANGE_SCALE_RESET_MS }));
  }
}
