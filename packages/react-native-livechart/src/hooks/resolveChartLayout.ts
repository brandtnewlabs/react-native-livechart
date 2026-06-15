import type { SkFont } from "@shopify/react-native-skia";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import {
  minPaddingRightForBadgeYAxisAlign,
  minPaddingRightForYAxisWithPulse,
  pulseRadialOutset,
  resolveAutoLeft,
  resolveAutoRight,
  resolvePadding,
  type ChartPadding,
} from "../draw/line";
import type { BadgeMetrics, ChartInsets, LiveChartPalette } from "../types";

export interface ChartLayoutConfig {
  palette: LiveChartPalette;
  lineWidthOverride?: number;
  insetsOverride?: ChartInsets;
  yAxis: boolean;
  badge: boolean;
  /** Badge pill geometry tokens. Omit for built-in defaults. */
  badgeMetrics?: BadgeMetrics;
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
  /**
   * Live dot pulse (LiveChart); floors top/right/bottom auto-padding so the ring
   * is not clipped. An explicit `insetsOverride` on a side wins over this floor.
   */
  pulse?: { maxRadius: number; strokeWidth: number } | null;
  /** When false and badge uses the right gutter, omit BADGE_TAIL_LEN from the right padding. */
  badgeShowTail?: boolean;
  /** Multi-series dot radius — used to add spacing between dots and Y-axis labels. */
  multiSeriesDotRadius?: number;
  /** When true, inline series labels sit right of dots and need extra right padding. */
  multiSeriesValueLabel?: boolean;
  /** Measured width of the widest series label (e.g. "Maybe"). Used when `multiSeriesValueLabel` is true. */
  multiSeriesMaxLabelWidth?: number;
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
  const showTail = config.badgeShowTail ?? true;
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
    const dotR = config.multiSeriesDotRadius ?? 0;
    const seriesLabelW = config.multiSeriesMaxLabelWidth ?? 0;
    rightPad = badgeUsesRightGutter
      ? minPaddingRightForBadgeYAxisAlign(
          config.font.getSize(),
          measuredYAxisLabelWidth,
          showTail,
          config.badgeMetrics,
        )
      : config.multiSeriesValueLabel && config.yAxis
        ? Math.max(
            dotR + 8 + seriesLabelW + 8 + measuredYAxisLabelWidth + 8,
            44,
          )
        : config.multiSeriesValueLabel
          ? Math.max(dotR + 8 + seriesLabelW + 8, 44)
          : config.yAxis
            ? Math.max(measuredYAxisLabelWidth + 16 + dotR * 2, 44)
            : resolveAutoRight(false, false);
  } else {
    rightPad = resolveAutoRight(
      config.yAxis,
      badgeUsesRightGutter,
      showTail,
      config.badgeMetrics,
    );
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
    showTail,
    config.badgeMetrics,
  );

  let padding: ChartPadding = { ...base, right: rightPad, left: leftPad };
  if (config.pulse) {
    const outlet = pulseRadialOutset(
      config.pulse.maxRadius,
      config.pulse.strokeWidth,
    );
    // The pulse ring needs this much room or it clips at the canvas edge, so it
    // acts as a floor on the *auto* padding. An explicitly-provided inset always
    // wins, though — the caller opts into any clipping that causes (issue #128).
    // Every other auto-padding already respects an explicit inset (see the
    // right/left branches and resolvePadding); this is the last place that didn't.
    const ins = config.insetsOverride;
    padding = {
      ...padding,
      right: ins?.right != null ? padding.right : Math.max(padding.right, outlet),
      top: ins?.top != null ? padding.top : Math.max(padding.top, outlet),
      bottom:
        ins?.bottom != null ? padding.bottom : Math.max(padding.bottom, outlet),
    };
  }

  return {
    strokeWidth: config.lineWidthOverride ?? config.palette.lineWidth,
    padding,
  };
}
