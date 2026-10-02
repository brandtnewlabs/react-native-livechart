import { useDerivedValue, useSharedValue } from "react-native-reanimated";

import type { SkFont } from "@shopify/react-native-skia";
import { GRID_METRICS_DEFAULTS, MS_PER_FRAME_60FPS } from "../constants";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import { computeGridEntries } from "../draw/grid";
import type { ChartPadding } from "../draw/line";
import type { GridMetrics } from "../types";

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
  gridMetrics: GridMetrics = GRID_METRICS_DEFAULTS,
  count = 0,
  intervalScale = 1,
) {
  const prevInterval = useSharedValue(0);
  const labelAlphas = useSharedValue<Record<number, number>>({});

  const yAxisEntries = useDerivedValue(() => {
    const dt = MS_PER_FRAME_60FPS;

    // SharedValue payloads may be frozen after crossing the JS/UI boundary.
    // Copy before computeGridEntries adds, updates, or removes label keys.
    const previousAlphas = labelAlphas.get();
    const alphas: Record<number, number> = {};
    const previousKeys = Object.keys(previousAlphas);
    for (let i = 0; i < previousKeys.length; i++) {
      const key = Number(previousKeys[i]);
      alphas[key] = previousAlphas[key];
    }
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
      gridMetrics,
      count,
      intervalScale,
    );

    prevInterval.set(result.interval);
    // This derived value also reads the cache. Only publish actual changes so
    // a settled axis doesn't keep scheduling itself with fresh object identities.
    const nextKeys = Object.keys(alphas);
    let cacheChanged = nextKeys.length !== previousKeys.length;
    for (let i = 0; i < nextKeys.length && !cacheChanged; i++) {
      const key = Number(nextKeys[i]);
      if (alphas[key] !== previousAlphas[key]) cacheChanged = true;
    }
    if (cacheChanged) labelAlphas.set(alphas);

    return result.entries;
  });

  return { yAxisEntries, font };
}
