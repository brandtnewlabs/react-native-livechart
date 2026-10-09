import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { groupReferenceLines, type ReferenceGrouping } from "../math/referenceGroup";
import { referenceLineForm } from "../math/referenceLines";
import type { ReferenceLine } from "../types";
import { pinnedPlotY } from "./crosshairShared";

/** Stable result while grouping is disabled. */
const EMPTY_GROUPING: ReferenceGrouping = { hidden: [], groups: [] };

/** Cluster the built-in tags that can actually render in the current plot. */
export function useReferenceLineGrouping({
  radius,
  engine,
  padding,
  lines,
  custom,
  offAxisCustom,
  dragValues,
}: {
  radius: number | null;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  lines: ReferenceLine[];
  custom: boolean[];
  offAxisCustom: boolean[];
  dragValues: SharedValue<number[]>;
}) {
  const hasOffAxisBadge = lines.map((line) => Boolean(line.badge || line.offAxisBadge || line.valueBadge));
  const result = useDerivedValue<ReferenceGrouping>(() => {
    if (radius == null) return EMPTY_GROUPING;
    const canvasHeight = engine.canvasHeight.get();
    const displayMin = engine.displayMin.get();
    const displayMax = engine.displayMax.get();
    const top = padding.top;
    const yPositions: number[] = [];
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (
        referenceLineForm(line) !== "line" ||
        line.value === undefined ||
        custom[index] ||
        offAxisCustom[index]
      ) {
        yPositions.push(-1);
        continue;
      }
      const value = dragValues.get()[index] ?? line.value;
      // Plain off-axis lines are culled by useReferenceLine. Only a configured
      // badge can contribute a visible tag to the edge's count pill.
      if ((value < displayMin || value > displayMax) && !hasOffAxisBadge[index]) {
        yPositions.push(-1);
        continue;
      }
      yPositions.push(
        pinnedPlotY(
          value,
          displayMin,
          displayMax,
          canvasHeight,
          top,
          padding.bottom,
        ),
      );
    }
    return groupReferenceLines(yPositions, radius);
  });
  const hidden = useDerivedValue<boolean[]>(() => result.get().hidden);
  return { refGroupResult: result, groupHidden: hidden };
}
