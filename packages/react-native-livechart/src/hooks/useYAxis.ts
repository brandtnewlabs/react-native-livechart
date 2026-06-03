import { useDerivedValue, useSharedValue } from "react-native-reanimated";

import type { SkFont } from "@shopify/react-native-skia";
import { MS_PER_FRAME_60FPS } from "../constants";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import { computeGridEntries } from "../draw/grid";
import type { ChartPadding } from "../draw/line";

/**
 * Compute Y-axis grid entries (values + labels) with animated fade-in/out.
 * Uses `computeGridEntries` to pick nice intervals and track label alpha for
 * smooth transitions when the value range changes.
 */
export function useYAxis(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  formatValue: (v: number) => string,
  font: SkFont,
  minGap = 36,
) {
  const prevInterval = useSharedValue(0);
  const labelAlphas = useSharedValue<Record<number, number>>({});

  const yAxisEntries = useDerivedValue(() => {
    const dt = MS_PER_FRAME_60FPS;

    const alphas = labelAlphas.get();
    const result = computeGridEntries(
      engine.displayMin.get(),
      engine.displayMax.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
      prevInterval.get(),
      alphas,
      formatValue,
      dt,
      minGap,
    );

    prevInterval.set(result.interval);
    labelAlphas.set(alphas);

    return result.entries;
  });

  return { yAxisEntries, font };
}
