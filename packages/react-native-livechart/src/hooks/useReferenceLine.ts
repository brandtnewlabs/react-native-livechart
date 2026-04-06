import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { SkFont } from "@shopify/react-native-skia";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import type { ReferenceLine } from "../types";

export interface ReferenceLineLayout {
  y: number;
  x1: number;
  x2: number;
  label: string;
  labelX: number;
  labelY: number;
  visible: boolean;
}

/**
 * Derives the screen-space layout for a horizontal reference line.
 * Returns a shared value that updates each frame as displayMin/Max animate.
 */
export function useReferenceLine(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  referenceLine: ReferenceLine | undefined,
  formatValue: (v: number) => string,
  font: SkFont,
): SharedValue<ReferenceLineLayout> {
  return useDerivedValue<ReferenceLineLayout>(() => {
    const invisible: ReferenceLineLayout = {
      y: -1,
      x1: 0,
      x2: 0,
      label: "",
      labelX: 0,
      labelY: -1,
      visible: false,
    };

    if (!referenceLine) return invisible;

    const w = engine.canvasWidth.value;
    const h = engine.canvasHeight.value;
    const dMin = engine.displayMin.value;
    const dMax = engine.displayMax.value;
    const valRange = dMax - dMin;

    if (valRange <= 0 || w === 0 || h === 0) return invisible;

    const chartH = h - padding.top - padding.bottom;
    const y =
      padding.top + chartH * (1 - (referenceLine.value - dMin) / valRange);

    // Keep the line within the visible chart area
    if (y < padding.top || y > h - padding.bottom) return invisible;

    const x1 = padding.left;
    const x2 = w - padding.right;

    const label = referenceLine.label ?? formatValue(referenceLine.value);

    // Place label in right gutter, vertically centered on the line
    const fm = font.getMetrics();
    const baselineOffset = (fm.ascent + fm.descent) / 2;
    const labelX = x2 + 4;
    const labelY = y - baselineOffset;

    return { y, x1, x2, label, labelX, labelY, visible: true };
  });
}
