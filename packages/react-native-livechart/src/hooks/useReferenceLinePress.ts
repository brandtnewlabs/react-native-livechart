import type { SkFont } from "@shopify/react-native-skia";
import { Gesture } from "react-native-gesture-handler";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import type { ReferenceLine } from "../types";
import { pointInRect } from "./crosshairShared";
import {
  computeReferenceBadgeRect,
  type ReferenceBadgeRect,
} from "./useReferenceLine";

/**
 * Builds a tap gesture that hit-tests a chart's reference-line **badges** (the
 * pill tags for working orders / alerts / targets) and fires `onPress(line,
 * index)` when one is tapped. Mirrors {@link useMarkers}: badge rects are
 * projected to screen each frame on the UI thread (so they track the rescaling
 * axis exactly like the rendered pills), and the gesture hit-tests against them.
 *
 * Also returns a `hitTest` worklet so a coexisting gesture (the scrub-action tap)
 * can defer to a badge under the finger instead of acting on it. Only badge-tagged
 * Form-A (value) lines are pressable; everything else projects to `null`.
 */
export function useReferenceLinePress(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  lines: ReferenceLine[],
  font: SkFont,
  formatValue: (v: number) => string,
  active: boolean,
  /** Touch-target inflation around each pill, in px. */
  hitSlop: number,
  onPress?: (line: ReferenceLine, index: number) => void,
  /** Per-line live value overrides (dragged values) so a draggable line's hit-rect
   *  tracks the drag, index-aligned with `lines`. */
  dragValues?: SharedValue<number[]>,
): {
  tapGesture: ReturnType<typeof Gesture.Tap>;
  hitTest: (x: number, y: number) => boolean;
} {
  // Per-frame badge hit-rects, index-aligned with `lines` (null = no pressable
  // badge / off-screen / not laid out). Recomputed on the UI thread.
  /* istanbul ignore next -- worklet runs on the UI thread, not in Jest */
  const rects = useDerivedValue<(ReferenceBadgeRect | null)[]>(() => {
    if (!active || lines.length === 0) return [];
    const w = engine.canvasWidth.value;
    const h = engine.canvasHeight.value;
    const dMin = engine.displayMin.value;
    const dMax = engine.displayMax.value;
    const out: (ReferenceBadgeRect | null)[] = [];
    const dv = dragValues?.value;
    for (let i = 0; i < lines.length; i++) {
      out.push(
        computeReferenceBadgeRect(
          lines[i],
          w,
          h,
          padding,
          dMin,
          dMax,
          font,
          formatValue,
          dv ? dv[i] : undefined,
        ),
      );
    }
    return out;
  });

  // Topmost badge under (x, y), or -1. Last drawn = last in the array = topmost.
  /* istanbul ignore next -- worklet, runs on the UI thread */
  const indexAt = (x: number, y: number): number => {
    "worklet";
    const rs = rects.value;
    for (let i = rs.length - 1; i >= 0; i--) {
      const r = rs[i];
      if (r && pointInRect(x, y, r, hitSlop)) return i;
    }
    return -1;
  };

  /* istanbul ignore next -- worklet, runs on the UI thread */
  const hitTest = (x: number, y: number): boolean => {
    "worklet";
    return indexAt(x, y) >= 0;
  };

  /* istanbul ignore next -- runs only via scheduleOnRN from the UI-thread tap */
  function emitPress(index: number) {
    onPress?.(lines[index], index);
  }

  /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e, success) => {
      "worklet";
      if (!active || !success) return;
      const i = indexAt(e.x, e.y);
      if (i >= 0) scheduleOnRN(emitPress, i);
    });

  return { tapGesture, hitTest };
}
