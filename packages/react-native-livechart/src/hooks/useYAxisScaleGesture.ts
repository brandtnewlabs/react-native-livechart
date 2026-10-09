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
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import { rightAnchoredYAxisColumnLayout, type YAxisEntry } from "../draw/grid";
import type { ChartPadding } from "../draw/line";

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
}: Options) {
  const startScale = useSharedValue(1);
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
        startY.set(touch.y);
        armed.set(true);
        manager.begin();
        manager.activate();
      })
      .onStart(() => {
        "worklet";
        wake?.();
        active?.set(true);
        cancelAnimation(scale);
        startScale.set(scale.get());
        onStart?.();
      })
      .onTouchesMove((event) => {
        "worklet";
        const touch = event.allTouches[0];
        if (!armed.get() || !touch) return;
        scale.set(
          draggedYAxisScale(
            startScale.get(),
            touch.y - startY.get(),
            dragDistance,
            minScale,
            maxScale,
          ),
        );
      })
      .onTouchesUp((_event, manager) => {
        "worklet";
        if (armed.get()) manager.end();
      })
      .onTouchesCancelled((_event, manager) => {
        "worklet";
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
        scale.set(
          withTiming(Math.max(minScale, Math.min(maxScale, 1)), {
            duration: 240,
          }),
        );
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
