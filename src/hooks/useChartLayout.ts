import type { SkFont } from "@shopify/react-native-skia";
import {
  minPaddingLeftForBadge,
  minPaddingRightForBadgeYAxisAlign,
  resolveAutoLeft,
  resolveAutoRight,
  resolvePadding,
  type ChartPadding,
} from "../draw/line";
import { measureFontTextWidth } from "../measureFontTextWidth";
import type { ChartInsets, LivelinePalette } from "../types";

export interface ChartLayoutConfig {
  palette: LivelinePalette;
  lineWidthOverride?: number;
  insetsOverride?: ChartInsets;
  yAxis: boolean;
  badge: boolean;
  /** When true, badge occupies the left gutter instead of the right. */
  badgeOnLeft?: boolean;
  /** When false, bottom inset shrinks (no x-axis labels). Default true. */
  xAxis?: boolean;
  /** Skia font for measuring label width. When provided with formatValue + currentValue, padding auto-sizes. */
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
  const badgeOnLeft = config.badgeOnLeft ?? false;
  const badgeOnRight = config.badge && !badgeOnLeft;
  const xAxis = config.xAxis ?? true;

  // ── Right inset ──────────────────────────────────────────────────────────
  let rightPad: number;
  if (config.insetsOverride?.right != null) {
    rightPad = config.insetsOverride.right;
  } else if (
    config.font &&
    config.formatValue &&
    config.currentValue != null &&
    !badgeOnLeft
  ) {
    const v = config.currentValue;
    const samples = [v, v / 10, v / 100, v * 10].map(config.formatValue);
    const textWidth = Math.max(
      ...samples.map((s) => measureFontTextWidth(config.font!, s)),
    );
    rightPad = badgeOnRight
      ? minPaddingRightForBadgeYAxisAlign(config.font.getSize(), textWidth)
      : Math.max(textWidth + 16, 44);
  } else {
    rightPad = resolveAutoRight(config.yAxis, badgeOnRight);
  }

  // ── Left inset ───────────────────────────────────────────────────────────
  let leftPad: number;
  if (config.insetsOverride?.left != null) {
    leftPad = config.insetsOverride.left;
  } else if (
    badgeOnLeft &&
    config.font &&
    config.formatValue &&
    config.currentValue != null
  ) {
    const v = config.currentValue;
    const samples = [v, v / 10, v / 100, v * 10].map(config.formatValue);
    const textWidth = Math.max(
      ...samples.map((s) => measureFontTextWidth(config.font!, s)),
    );
    leftPad = minPaddingLeftForBadge(textWidth);
  } else {
    leftPad = resolveAutoLeft(badgeOnLeft);
  }

  const base = resolvePadding(
    config.insetsOverride,
    config.yAxis,
    config.badge,
    badgeOnLeft,
    xAxis,
  );

  return {
    strokeWidth: config.lineWidthOverride ?? config.palette.lineWidth,
    padding: { ...base, right: rightPad, left: leftPad },
  };
}
