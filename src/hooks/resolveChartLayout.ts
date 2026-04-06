import type { SkFont } from "@shopify/react-native-skia";
import {
  minPaddingRightForBadgeYAxisAlign,
  minPaddingRightForYAxisWithPulse,
  pulseRadialOutset,
  resolveAutoLeft,
  resolveAutoRight,
  resolvePadding,
  type ChartPadding,
} from "../draw/line";
import { measureFontTextWidth } from "../measureFontTextWidth";
import type { ChartInsets, LiveChartPalette } from "../types";

export interface ChartLayoutConfig {
  palette: LiveChartPalette;
  lineWidthOverride?: number;
  insetsOverride?: ChartInsets;
  yAxis: boolean;
  badge: boolean;
  /**
   * When true (default if omitted and `badge` is true), reserve the wide right gutter for the badge.
   * Set false when the badge is anchored left of the live dot (`position: "left"`).
   */
  badgeUsesRightGutter?: boolean;
  /** When false, bottom inset shrinks (no x-axis labels). Default true. */
  xAxis?: boolean;
  /** Skia font for measuring label width. When provided with formatValue + currentValue, padding auto-sizes. */
  font?: SkFont;
  /** Worklet formatter — called on JS thread here to measure label width */
  formatValue?: (v: number) => string;
  /** Current value read from SharedValue on JS thread — used to produce a sample label for measurement */
  currentValue?: number;
  /** Live dot pulse (LiveChart); expands top/right/bottom insets so the ring is not clipped. */
  pulse?: { maxRadius: number; strokeWidth: number } | null;
}

export interface ChartLayoutResult {
  strokeWidth: number;
  padding: ChartPadding;
}

export function resolveChartLayout(
  config: ChartLayoutConfig,
): ChartLayoutResult {
  const badgeUsesRightGutter =
    config.badge && (config.badgeUsesRightGutter ?? true);
  const xAxis = config.xAxis ?? true;

  let measuredYAxisLabelWidth: number | undefined;

  // ── Right inset ──────────────────────────────────────────────────────────
  let rightPad: number;
  if (config.insetsOverride?.right != null) {
    rightPad = config.insetsOverride.right;
  } else if (
    config.font &&
    config.formatValue &&
    config.currentValue != null &&
    (badgeUsesRightGutter || !config.badge || config.yAxis)
  ) {
    const v = config.currentValue;
    const samples = [v, v / 10, v / 100, v * 10].map(config.formatValue);
    measuredYAxisLabelWidth = Math.max(
      ...samples.map((s) => measureFontTextWidth(config.font!, s)),
    );
    rightPad = badgeUsesRightGutter
      ? minPaddingRightForBadgeYAxisAlign(
          config.font.getSize(),
          measuredYAxisLabelWidth,
        )
      : config.yAxis
        ? Math.max(measuredYAxisLabelWidth + 16, 44)
        : resolveAutoRight(false, false);
  } else {
    rightPad = resolveAutoRight(config.yAxis, badgeUsesRightGutter);
  }

  if (config.pulse && config.yAxis && config.insetsOverride?.right == null) {
    const outlet = pulseRadialOutset(
      config.pulse.maxRadius,
      config.pulse.strokeWidth,
    );
    const labelW = measuredYAxisLabelWidth ?? 49;
    rightPad = Math.max(
      rightPad,
      minPaddingRightForYAxisWithPulse(outlet, labelW),
    );
  }

  // ── Left inset ───────────────────────────────────────────────────────────
  let leftPad: number;
  if (config.insetsOverride?.left != null) {
    leftPad = config.insetsOverride.left;
  } else {
    leftPad = resolveAutoLeft(false);
  }

  const base = resolvePadding(
    config.insetsOverride,
    config.yAxis,
    badgeUsesRightGutter,
    false,
    xAxis,
  );

  let padding: ChartPadding = { ...base, right: rightPad, left: leftPad };
  if (config.pulse) {
    const outlet = pulseRadialOutset(
      config.pulse.maxRadius,
      config.pulse.strokeWidth,
    );
    padding = {
      ...padding,
      right: Math.max(padding.right, outlet),
      top: Math.max(padding.top, outlet),
      bottom: Math.max(padding.bottom, outlet),
    };
  }

  return {
    strokeWidth: config.lineWidthOverride ?? config.palette.lineWidth,
    padding,
  };
}
