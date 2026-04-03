import type { SkFont } from "@shopify/react-native-skia";
import {
  minPaddingRightForBadgeYAxisAlign,
  resolveAutoRight,
  resolvePadding,
  type ChartPadding,
} from "../draw/line";
import { measureFontTextWidth } from "../measureFontTextWidth";
import type { LivelinePalette, Padding } from "../types";

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
    // Sample across multiple magnitudes so the gutter fits the widest label
    // the chart will plausibly show (handles all price ranges: 0.001 → 10M+).
    const v = config.currentValue;
    const samples = [v, v / 10, v / 100, v * 10].map(config.formatValue);
    const textWidth = Math.max(
      ...samples.map((s) => measureFontTextWidth(config.font!, s)),
    );
    rightPad = config.badge
      ? minPaddingRightForBadgeYAxisAlign(config.font.getSize(), textWidth)
      : Math.max(textWidth + 16, 44);
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
