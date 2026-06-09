import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { SkFont } from "@shopify/react-native-skia";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ResolvedSegment } from "../core/resolveSegment";
import type { ChartPadding } from "../draw/line";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import { segmentBandX, segmentHighlighted } from "../math/segments";

/** Screen-space geometry + highlight state for one segment band, per frame. */
export interface SegmentBandLayout {
  visible: boolean;
  /** Band left edge (px). */
  x1: number;
  /** Band right edge (px). */
  x2: number;
  /** Band top edge (plot top). */
  yTop: number;
  /** Band bottom edge (plot bottom). */
  yBottom: number;
  /** True while highlighted (scrub inside the band, or `active`). */
  highlighted: boolean;
  label: string;
  labelX: number;
  labelY: number;
}

const INVISIBLE: SegmentBandLayout = {
  visible: false,
  x1: 0,
  x2: 0,
  yTop: 0,
  yBottom: 0,
  highlighted: false,
  label: "",
  labelX: 0,
  labelY: -1,
};

/**
 * Derives the screen-space band for a single resolved segment each frame: x-range
 * projected from its `[from, to]` time range, top/bottom plot edges, the
 * scrub/active highlight flag, and the label anchor. Mirrors `useReferenceLine`'s
 * time-band derivation; the band math lives in pure `segmentBandX` /
 * `segmentHighlighted` so it is unit-testable without Reanimated.
 */
export function useSegmentBand(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  segment: ResolvedSegment,
  scrubX: SharedValue<number>,
  scrubActive: SharedValue<boolean>,
  font: SkFont,
): SharedValue<SegmentBandLayout> {
  return useDerivedValue<SegmentBandLayout>(() => {
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
    const highlighted = segmentHighlighted(
      segment.active,
      scrubActive.value,
      scrubX.value,
      band.bx1,
      band.bx2,
    );

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
      highlighted,
      label,
      labelX,
      labelY,
    };
  });
}
