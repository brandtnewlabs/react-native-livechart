import { vec } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import {
  thresholdLineY,
  thresholdSplitPositions,
  thresholdVisible,
} from "../math/threshold";

export interface ThresholdGeometry {
  /** Threshold pixel-Y within the canvas, or NaN before layout / degenerate range. */
  lineY: SharedValue<number>;
  /** Whether the threshold sits within the plot area (drives marker-line opacity). */
  visible: SharedValue<boolean>;
  /** Vertical gradient end vector, `vec(0, canvasHeight)` — shared by stroke + fill. */
  gradientEnd: SharedValue<ReturnType<typeof vec>>;
  /** `[0, t, t, 1]` stop positions for the hard-split gradient — shared by stroke + fill. */
  splitPositions: SharedValue<number[]>;
}

/**
 * Per-frame screen geometry for the threshold split, shared by the stroke
 * gradient, the profit/loss fill band, and the dashed marker line. Reads the live
 * threshold value + engine Y-range on the UI thread; the math lives in
 * `math/threshold` so it stays unit-testable without Reanimated.
 */
export function useThreshold(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  value: SharedValue<number>,
): ThresholdGeometry {
  const lineY = useDerivedValue(() =>
    thresholdLineY(
      value.get(),
      engine.displayMin.get(),
      engine.displayMax.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    ),
  );

  const visible = useDerivedValue(() =>
    thresholdVisible(
      lineY.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    ),
  );

  const splitPositions = useDerivedValue(() =>
    thresholdSplitPositions(lineY.get(), engine.canvasHeight.get()),
  );

  const gradientEnd = useDerivedValue(() =>
    vec(0, Math.max(1, engine.canvasHeight.get())),
  );

  return { lineY, visible, gradientEnd, splitPositions };
}
