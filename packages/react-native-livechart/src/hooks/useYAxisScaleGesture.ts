import type { SkFont } from "@shopify/react-native-skia";
import { useMemo } from "react";
import {
  Gesture,
  type ComposedGesture,
  type GestureType,
} from "react-native-gesture-handler";
import {
  cancelAnimation,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { ResolvedYAxisConfig } from "../core/resolveConfig";
import { writeGestureRange } from "../core/gestureRangeOwnership";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import { rightAnchoredYAxisColumnLayout, type YAxisEntry } from "../draw/grid";
import type { ChartPadding } from "../draw/line";
import type { ChartScale } from "../types";

/** Preserve private scale state across gesture/axis toggles on a mounted chart. */
export function useYAxisScaleValue(external?: SharedValue<number>) {
  const internal = useSharedValue(1);
  return external ?? internal;
}

/** The reserved gutter, or the actual measured price column when it floats. */
export function isYAxisScaleHit(
  x: number,
  y: number,
  width: number,
  height: number,
  padding: ChartPadding,
  side: "left" | "right",
  floating: boolean,
  labelRightMargin: number | undefined,
  entries: readonly YAxisEntry[],
  font: SkFont,
): boolean {
  "worklet";
  if (
    width <= 0 ||
    height <= 0 ||
    x < 0 ||
    x > width ||
    y < padding.top ||
    y >= height - padding.bottom
  )
    return false;
  if (side === "left") return x < padding.left;
  let left = width - padding.right;
  if (floating || labelRightMargin !== undefined) {
    // Matches YAxisOverlay: floating labels sit 6px off the canvas edge.
    const column = rightAnchoredYAxisColumnLayout(
      width,
      entries,
      font,
      labelRightMargin ?? 6,
    );
    left = Math.min(left, column.labelX);
  }
  return x >= Math.max(padding.left, left);
}

/** Log-space clamping avoids overflow even for very large drag translations. */
export function draggedYAxisScale(
  start: number,
  dy: number,
  distance: number,
  min: number,
  max: number,
): number {
  "worklet";
  const validStart = Number.isFinite(start) && start > 0 ? start : 1;
  const logScale =
    Math.log(Math.max(min, Math.min(max, validStart))) + dy / distance;
  return Math.max(
    min,
    Math.min(
      max,
      Math.exp(Math.max(Math.log(min), Math.min(Math.log(max), logScale))),
    ),
  );
}

/**
 * Scale explicit price bounds about their midpoint by `factor` (> 1 widens).
 * Returns `range` unchanged when the result would be degenerate or overflow.
 */
export function scaledPriceRange(
  range: Pick<ChartScale, "min" | "max">,
  factor: number,
): Pick<ChartScale, "min" | "max"> {
  "worklet";
  const mid = range.min / 2 + range.max / 2;
  const half = ((range.max - range.min) / 2) * factor;
  const min = mid - half;
  const max = mid + half;
  return Number.isFinite(min) && Number.isFinite(max) && min < max
    ? { min, max }
    : range;
}

type Options = {
  engine: Pick<ChartEngineLayout, "canvasWidth" | "canvasHeight"> & {
    wake?: () => void;
  };
  padding: ChartPadding;
  axis: ResolvedYAxisConfig | null;
  floating?: boolean;
  entries: SharedValue<YAxisEntry[]> | null;
  font: SkFont;
  scale: SharedValue<number>;
  /** Existing plot gesture graph, including pinch. */
  gesture: GestureType | ComposedGesture;
  /** Interactive chart overlays retain their normal tap/drag behavior. */
  deferHit?: (x: number, y: number) => boolean;
  onStart?: () => void;
  active?: SharedValue<boolean>;
  /**
   * Explicit price bounds (see `priceScroll`). While gesture-owned, a drag
   * scales these about their midpoint instead of `scale`, and a double-tap
   * clears them along with the scale.
   */
  range?: SharedValue<Pick<ChartScale, "min" | "max"> | null>;
  rangeGestureOwned?: SharedValue<boolean>;
};

/** Owns gutter touches at touch-down; fails immediately everywhere else. */
export function useYAxisScaleGesture({
  engine,
  padding,
  axis,
  floating = false,
  entries,
  font,
  scale,
  gesture,
  deferHit,
  onStart,
  active,
  range,
  rangeGestureOwned,
}: Options) {
  const startScale = useSharedValue(1);
  // Gesture-owned bounds at touch-down; null scales `scale` instead.
  const startRange = useSharedValue<Pick<ChartScale, "min" | "max"> | null>(null);
  const startY = useSharedValue(0);
  const armed = useSharedValue(false);
  const { canvasWidth, canvasHeight, wake } = engine;
  const { left, right, top, bottom } = padding;
  const side = axis?.side ?? "right";
  const labelRightMargin = axis?.labelRightMargin;
  const config = axis?.scaleGesture;
  const enabled = config != null;
  const minScale = config?.minScale ?? 0.25;
  const maxScale = config?.maxScale ?? 10;
  const dragDistance = config?.dragDistance ?? 160;
  const doubleTapReset = config?.doubleTapReset ?? true;

  const axisGesture = useMemo(() => {
    if (!enabled) return null;
    const hit = (x: number, y: number) => {
      "worklet";
      return (
        isYAxisScaleHit(
          x,
          y,
          canvasWidth.get(),
          canvasHeight.get(),
          { left, right, top, bottom },
          side,
          floating,
          labelRightMargin,
          entries?.get() ?? [],
          font,
        ) && !deferHit?.(x, y)
      );
    };
    const pan = Gesture.Manual()
      .onTouchesDown((event, manager) => {
        "worklet";
        const touch = event.allTouches[0];
        if (event.numberOfTouches !== 1 || !touch || !hit(touch.x, touch.y)) {
          armed.set(false);
          manager.fail();
          return;
        }
        // A Manual recognizer owns the entire down→up lifecycle. A Pan with
        // manualActivation can overwrite activation while beginning its native
        // recognition, so it cannot reliably claim a gutter touch on down.
        // Claim before a parent ScrollView or chart scrub can activate.
        // Exclusive below gives this pair priority over the entire plot graph.
        // Native touch moves can arrive before the ACTIVE/onStart event. Seed
        // the drag here so the first move cannot reuse a previous drag's scale.
        cancelAnimation(scale);
        startScale.set(scale.get());
        startRange.set(range && rangeGestureOwned?.get() ? range.get() : null);
        startY.set(touch.y);
        armed.set(true);
        active?.set(true);
        manager.begin();
        manager.activate();
      })
      .onStart(() => {
        "worklet";
        wake?.();
        active?.set(true);
        onStart?.();
      })
      .onTouchesMove((event) => {
        "worklet";
        const touch = event.allTouches[0];
        if (!armed.get() || !touch) return;
        const fromScale = startScale.get();
        const nextScale = draggedYAxisScale(
          fromScale,
          touch.y - startY.get(),
          dragDistance,
          minScale,
          maxScale,
        );
        const fromRange = startRange.get();
        if (fromRange !== null && range && rangeGestureOwned?.get()) {
          // A panned window scales in place by the same step the absolute scale
          // takes, so repeated drags stay within [minScale, maxScale] overall
          // instead of compounding. The tick ignores `scale` while the range is
          // applied, so updating it only keeps that running total.
          const validFrom =
            Number.isFinite(fromScale) && fromScale > 0 ? fromScale : 1;
          writeGestureRange(
            range,
            rangeGestureOwned,
            scaledPriceRange(fromRange, nextScale / validFrom),
          );
        }
        scale.set(nextScale);
      })
      .onTouchesUp((_event, manager) => {
        "worklet";
        if (armed.get()) {
          armed.set(false);
          manager.end();
        }
      })
      .onTouchesCancelled((_event, manager) => {
        "worklet";
        armed.set(false);
        manager.fail();
      })
      .onFinalize(() => {
        "worklet";
        armed.set(false);
        active?.set(false);
      });
    const reset = Gesture.Tap()
      .enabled(doubleTapReset)
      .numberOfTaps(2)
      .maxDistance(16)
      .onTouchesDown((event, manager) => {
        "worklet";
        const touch = event.allTouches[0];
        if (event.numberOfTouches !== 1 || !touch || !hit(touch.x, touch.y))
          manager.fail();
      })
      .onEnd((_event, success) => {
        "worklet";
        if (!success) return;
        wake?.();
        cancelAnimation(scale);
        if (range && rangeGestureOwned?.get()) {
          // Land the scale in one step so the display range eases from the
          // panned window to the fit (see `resetChartView`).
          range.set(null);
          rangeGestureOwned.set(false);
          scale.set(Math.max(minScale, Math.min(maxScale, 1)));
        } else {
          scale.set(
            withTiming(Math.max(minScale, Math.min(maxScale, 1)), {
              duration: 240,
            }),
          );
        }
        onStart?.();
      });
    return Gesture.Simultaneous(pan, reset);
  }, [
    enabled,
    canvasWidth,
    canvasHeight,
    left,
    right,
    top,
    bottom,
    side,
    floating,
    labelRightMargin,
    entries,
    font,
    deferHit,
    scale,
    range,
    rangeGestureOwned,
    startRange,
    startScale,
    startY,
    armed,
    wake,
    onStart,
    active,
    minScale,
    maxScale,
    dragDistance,
    doubleTapReset,
  ]);
  return useMemo(
    () => (axisGesture ? Gesture.Exclusive(axisGesture, gesture) : gesture),
    [axisGesture, gesture],
  );
}
