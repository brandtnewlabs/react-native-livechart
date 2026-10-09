import type { ReferenceTagStack } from "../math/referenceTagStack";
import { useMemo } from "react";
import type { SkFont } from "@shopify/react-native-skia";
import { Gesture } from "react-native-gesture-handler";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import type { AxisBadgeConfig } from "../math/axisBadgeLayout";
import { referenceBadgeFont } from "./referenceBadgeFont";
import { resolveReferenceBadge } from "../math/referenceLines";
import type { FontConfig, ReferenceLine } from "../types";
import { pointInRect } from "./crosshairShared";
import {
  computeReferenceLineLayout,
  referenceBadgeRect,
  type ReferenceBadgeRect,
} from "./useReferenceLine";

import { useLatestCallback } from "./useLatestCallback";

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
  valueAxis?: AxisBadgeConfig,
  fontProp?: FontConfig,
  groupHidden?: SharedValue<boolean[]>,
  custom?: boolean[],
  offAxisCustom?: boolean[],
  tagStack?: SharedValue<ReferenceTagStack>,
): {
  tapGesture: ReturnType<typeof Gesture.Tap>;
  hitTest: (x: number, y: number) => boolean;
} {
  const fonts = useMemo(
    () =>
      lines.map((line) => ({
        name: referenceBadgeFont(
          font,
          fontProp,
          resolveReferenceBadge(line) ?? undefined,
        ),
        value: referenceBadgeFont(
          font,
          fontProp,
          typeof line.valueBadge === "object" ? line.valueBadge : undefined,
        ),
      })),
    [lines, font, fontProp],
  );
  /* istanbul ignore next -- worklet runs on the UI thread, not in Jest */
  const rects = useDerivedValue<(ReferenceBadgeRect | null)[][]>(() => {
    if (!active || lines.length === 0) return [];
    if (tagStack) {
      const out: ReferenceBadgeRect[][] = [];
      for (let i = 0; i < lines.length; i++) out.push([]);
      for (const tag of tagStack.get().tags) {
        if (lines[tag.index] && lines[tag.index].id === tag.lineId && tag.kind !== "custom" && (tag.kind === "value" || resolveReferenceBadge(lines[tag.index]))) {
          out[tag.index]?.push(tag);
        }
      }
      return out;
    }
    const out: (ReferenceBadgeRect | null)[][] = [];
    for (let i = 0; i < lines.length; i++) {
      if (custom?.[i] || groupHidden?.get()[i]) {
        out.push([]);
        continue;
      }
      const layout = computeReferenceLineLayout(
        engine.canvasWidth.get(),
        engine.canvasHeight.get(),
        padding,
        lines[i],
        formatValue,
        fonts[i].name,
        engine.displayMin.get(),
        engine.displayMax.get(),
        0,
        1,
        dragValues?.get()[i],
        undefined,
        undefined,
        0,
        font,
        fonts[i].value,
        valueAxis,
      );
      if (offAxisCustom?.[i] && layout.offAxis) {
        out.push([]);
        continue;
      }
      out.push([
        referenceBadgeRect(layout, fonts[i].name, lines[i]),
        layout.valueBadge,
      ]);
    }
    return out;
  });

  const emitPress = useLatestCallback(
    (index: number, id: string | undefined) => {
      const line = lines[index];
      // A queued tap must not target a replacement at the same array index.
      if (line && line.id === id) onPress?.(line, index);
    },
  );
  const lineIds = useDerivedValue(() => {
    const ids: (string | undefined)[] = [];
    for (const line of lines) ids.push(line.id);
    return ids;
  });

  return useMemo(() => {
    // Topmost badge under (x, y), or -1. Last drawn = last in the array = topmost.
    /* istanbul ignore next -- worklet, runs on the UI thread */
    const indexAt = (x: number, y: number): number => {
      "worklet";
      const rs = rects.get();
      // Exact pill hits win over neighboring expanded touch targets.
      if (tagStack) {
        for (let i = rs.length - 1; i >= 0; i--) {
          for (const r of rs[i]) if (r && pointInRect(x, y, r, 0)) return i;
        }
      }
      for (let i = rs.length - 1; i >= 0; i--) {
        for (const r of rs[i]) {
          if (r && pointInRect(x, y, r, hitSlop)) return i;
        }
      }
      return -1;
    };

    /* istanbul ignore next -- worklet, runs on the UI thread */
    const hitTest = (x: number, y: number): boolean => {
      "worklet";
      return indexAt(x, y) >= 0;
    };

    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    const tapGesture = Gesture.Tap()
      .maxDuration(250)
      .onEnd((e, success) => {
        "worklet";
        if (!active || !success) return;
        const i = indexAt(e.x, e.y);
        if (i >= 0) scheduleOnRN(emitPress, i, lineIds.get()[i]);
      });

    return { tapGesture, hitTest };
  }, [active, emitPress, hitSlop, lineIds, rects, tagStack]);
}
