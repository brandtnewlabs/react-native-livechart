import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { SkFont } from "@shopify/react-native-skia";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ResolvedSegment } from "../core/resolveSegment";
import type { ChartPadding } from "../draw/line";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import { segmentBandX } from "../math/segments";

/** Screen-space geometry for one segment's divider + label, per frame. */
export interface SegmentDividerLayout {
  visible: boolean;
  /** Segment left edge (px) — the divider sits here. */
  x1: number;
  /** Segment right edge (px). */
  x2: number;
  /** Segment top edge (plot top). */
  yTop: number;
  /** Segment bottom edge (plot bottom). */
  yBottom: number;
  label: string;
  labelX: number;
  labelY: number;
}

const INVISIBLE: SegmentDividerLayout = {
  visible: false,
  x1: 0,
  x2: 0,
  yTop: 0,
  yBottom: 0,
  label: "",
  labelX: 0,
  labelY: -1,
};

/**
 * Derives the screen-space geometry for a single segment's dashed divider and
 * caption label each frame: the x-extent projected from its `[from, to]` time
 * range, the plot's top/bottom edges, and the label anchor. The projection math
 * lives in pure `segmentBandX` so it is unit-testable without Reanimated.
 */
export function useSegmentDivider(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  segment: ResolvedSegment,
  font: SkFont,
): SharedValue<SegmentDividerLayout> {
  return useDerivedValue<SegmentDividerLayout>(() => {
    const w = engine.canvasWidth.value;
    const h = engine.canvasHeight.value;
    if (w === 0 || h === 0) return INVISIBLE;

    const win = engine.displayWindow.value;
    const winStart = engine.timestamp.value - win;
    const x1 = padding.left;
    const x2 = w - padding.right;

    const band = segmentBandX(segment.from, segment.to, winStart, win, x1, x2);
    if (!band.visible) return INVISIBLE;

    const yTop = padding.top;
    const yBottom = h - padding.bottom;

    const label = segment.label ?? "";
    const fm = font.getMetrics();
    const labelX =
      segment.labelPosition === "right"
        ? band.bx2 - 4 - measureFontTextWidth(font, label)
        : band.bx1 + 4;
    const labelY = yTop - fm.ascent + 2;

    return {
      visible: true,
      x1: band.bx1,
      x2: band.bx2,
      yTop,
      yBottom,
      label,
      labelX,
      labelY,
    };
  });
}
