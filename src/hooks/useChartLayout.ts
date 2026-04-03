import type { LivelinePalette, Padding } from "../types";
import { resolveAutoRight, resolvePadding } from "../draw/line";

import type { ChartPadding } from "../draw/line";
import type { SkFont } from "@shopify/react-native-skia";

export interface ChartLayoutConfig {
  palette: LivelinePalette;
  lineWidthOverride?: number;
  paddingOverride?: Padding;
  grid: boolean;
  badge: boolean;
  /** Skia font for measuring label width. When provided with formatValue + currentValue, right padding auto-sizes. */
  font?: SkFont;
  /** Worklet formatter — called on JS thread here to measure label width */
  formatValue?: (v: number) => string;
  /** Current value read from SharedValue on JS thread — used to produce a sample label for measurement */
  currentValue?: number;
}

export interface ChartLayoutResult {
  strokeWidth: number;
  padding: ChartPadding;
}

export function resolveChartLayout(
  config: ChartLayoutConfig,
): ChartLayoutResult {
  let rightPad: number;
  if (config.paddingOverride?.right != null) {
    rightPad = config.paddingOverride.right;
  } else if (config.font && config.formatValue && config.currentValue != null) {
    // Measure the current value and a 10x smaller value (drift protection)
    const s1 = config.formatValue(config.currentValue);
    const s2 = config.formatValue(config.currentValue / 10);
    const textWidth = Math.max(
      config.font.getTextWidth(s1),
      config.font.getTextWidth(s2),
    );
    // Badge pill structure: tail(5) + padX(10) + text + padX(10) + gap(4) = text + 29
    const margin = config.badge ? 38 : 16;
    rightPad = Math.max(textWidth + margin, config.badge ? 60 : 42);
  } else {
    rightPad = resolveAutoRight(config.grid, config.badge);
  }

  const base = resolvePadding(
    config.paddingOverride,
    config.grid,
    config.badge,
  );

  return {
    strokeWidth: config.lineWidthOverride ?? config.palette.lineWidth,
    padding: { ...base, right: rightPad },
  };
}
