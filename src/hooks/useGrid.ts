import { useDerivedValue, useSharedValue } from "react-native-reanimated";

import type { ChartPadding } from "../draw/line";
import type { EngineState } from "../useLivelineEngine";
import type { SkFont } from "@shopify/react-native-skia";
import { computeGridEntries } from "../draw/grid";

export function useGrid(
  engine: EngineState,
  padding: ChartPadding,
  formatValue: (v: number) => string,
  font: SkFont,
  minGap = 36,
) {
  const prevInterval = useSharedValue(0);
  const labelAlphas = useSharedValue<Record<number, number>>({});

  const gridEntries = useDerivedValue(() => {
    const dt = 16.67;

    const alphas = labelAlphas.value;
    const result = computeGridEntries(
      engine.displayMin.value,
      engine.displayMax.value,
      engine.canvasHeight.value,
      padding.top,
      padding.bottom,
      prevInterval.value,
      alphas,
      formatValue,
      dt,
      minGap,
    );

    prevInterval.value = result.interval;
    labelAlphas.value = alphas;

    return result.entries;
  });

  return { gridEntries, font };
}
