import {
  DashPathEffect,
  Group,
  Path,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { BADGE_METRICS_DEFAULTS, MAX_Y_LABELS } from "../constants";
import type { ResolvedGridStyleConfig } from "../core/resolveConfig";
import type { YAxisEntry } from "../draw/grid";
import {
  badgeTailAndCap,
  gutterCenteredTextLeftX,
  gutterRightAlignedTextLeftX,
  pillTextLeftX,
  type ChartPadding,
} from "../draw/line";
import { usePathBuilder } from "../hooks/usePathBuilder";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import type { BadgeMetrics, LiveChartPalette } from "../types";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import { AnimatedLabel } from "./AnimatedLabel";

/** Right margin (px) for floating labels — keeps them just off the canvas edge. */
const FLOAT_LABEL_RIGHT_MARGIN = 6;

/** Returns true when a Y-axis label's line box intersects the live badge pill. */
export function yAxisLabelIntersectsBadge(
  labelCenterY: number,
  labelHeight: number,
  badgeCenterY: number,
  badgeHeight: number,
) {
  "worklet";
  const labelHalfHeight = labelHeight / 2;
  const badgeHalfHeight = badgeHeight / 2;
  return (
    labelCenterY + labelHalfHeight > badgeCenterY - badgeHalfHeight &&
    labelCenterY - labelHalfHeight < badgeCenterY + badgeHalfHeight
  );
}

export function YAxisOverlay({
  entries,
  engine,
  padding,
  palette,
  font,
  badge = false,
  badgeTail = true,
  badgeMetrics = BADGE_METRICS_DEFAULTS,
  badgeCenterY,
  badgeFontSize,
  badgeOffsetY = 0,
  seriesLabelInset = 0,
  gridStyle,
  variant = "all",
  float = false,
}: {
  entries: SharedValue<YAxisEntry[]>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LiveChartPalette;
  font: SkFont;
  /** When true, use the asymmetric pill centering formula so labels align with badge text. */
  badge?: boolean;
  /** Whether the badge tail spike is shown; affects the left inset used for label alignment. */
  badgeTail?: boolean;
  /** Badge pill geometry tokens (kept in sync with useBadge). */
  badgeMetrics?: BadgeMetrics;
  /** Live badge center before its configured Y offset. Enables label collision suppression. */
  badgeCenterY?: SharedValue<number>;
  /** Live badge font size, used to reconstruct the pill's vertical bounds. */
  badgeFontSize?: number;
  /** Configured live badge Y offset. */
  badgeOffsetY?: number;
  /** When > 0, series labels occupy the left portion of the gutter; Y-axis labels right-align. */
  seriesLabelInset?: number;
  /** Grid-line styling overrides. Omit for the legacy solid 1px line. */
  gridStyle?: ResolvedGridStyleConfig;
  /**
   * Which parts to draw. `"all"` (default) renders grid lines + labels together.
   * `"grid"` / `"labels"` split them so a chart can draw the grid behind the data
   * and the labels (over a soft fade) on top — see {@link YAxisEdgeFade}.
   */
  variant?: "all" | "grid" | "labels";
  /**
   * Floating-axis mode: right-align labels at the canvas edge (over a full-width
   * plot) instead of centering them in a reserved gutter. See {@link YAxisConfig.float}.
   */
  float?: boolean;
}) {
  const gridColor = gridStyle?.color ?? palette.gridLine;
  const gridWidth = gridStyle?.strokeWidth ?? 1;
  const gridIntervals = gridStyle?.intervals ?? [];
  const gridOpacity = gridStyle?.opacity ?? 1;
  const gridBuilder = usePathBuilder();

  const gridLinesPath = useDerivedValue(() => {
    const b = gridBuilder.value;
    if (variant === "labels") return b.detach();
    const items = entries.get();
    const w = engine.canvasWidth.get();
    for (let i = 0; i < items.length; i++) {
      b.moveTo(padding.left, items[i].y);
      b.lineTo(w - padding.right, items[i].y);
    }
    return b.detach();
  });

  const leftInset =
    badgeMetrics.dotGap + badgeTailAndCap(font.getSize(), badgeTail, badgeMetrics);

  const labelEntries = useDerivedValue(() => {
    if (variant === "grid") return [];
    const items = entries.get();
    const w = engine.canvasWidth.get();
    const fm = font.getMetrics();
    const baselineOffset = (fm.ascent + fm.descent) / 2;
    const labelHeight = fm.descent - fm.ascent;
    const resolvedBadgeCenterY = badgeCenterY
      ? badgeCenterY.get() + badgeOffsetY
      : null;
    const badgeHeight =
      badgeFontSize === undefined
        ? 0
        : badgeFontSize + badgeMetrics.padY * 2;
    const result: { x: number; y: number; label: string; alpha: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      const textW = measureFontTextWidth(font, e.label);
      const x = float
        ? gutterRightAlignedTextLeftX(w, textW, FLOAT_LABEL_RIGHT_MARGIN)
        : badge
          ? pillTextLeftX(w, padding.right, leftInset, textW, badgeMetrics)
          : seriesLabelInset > 0
            ? gutterRightAlignedTextLeftX(w, textW)
            : gutterCenteredTextLeftX(w, padding.right, textW);
      result.push({
        x,
        y: e.y - baselineOffset,
        label: e.label,
        alpha:
          resolvedBadgeCenterY !== null &&
          yAxisLabelIntersectsBadge(
            e.y,
            labelHeight,
            resolvedBadgeCenterY,
            badgeHeight,
          )
            ? 0
            : e.alpha,
      });
    }
    return result;
  });

  return (
    <Group>
      {variant !== "labels" && (
        <Group opacity={gridOpacity}>
          <Path
            path={gridLinesPath}
            style="stroke"
            strokeWidth={gridWidth}
            color={gridColor}
          >
            {gridIntervals.length > 0 && (
              <DashPathEffect intervals={gridIntervals} />
            )}
          </Path>
        </Group>
      )}
      {variant !== "grid" &&
        Array.from({ length: MAX_Y_LABELS }, (_, i) => (
          <AnimatedLabel
            key={i}
            entries={labelEntries}
            index={i}
            font={font}
            color={palette.gridLabel}
          />
        ))}
    </Group>
  );
}
