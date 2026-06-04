import {
  DashPathEffect,
  Group,
  Path,
  Skia,
  type SkFont,
  type SkPath,
} from "@shopify/react-native-skia";
import { useRef } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { BADGE_DOT_GAP } from "../constants";
import type { ResolvedGridStyleConfig } from "../core/resolveConfig";
import type { YAxisEntry } from "../draw/grid";
import {
  badgeTailAndCap,
  gutterCenteredTextLeftX,
  gutterRightAlignedTextLeftX,
  pillTextLeftX,
  type ChartPadding,
} from "../draw/line";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import type { LiveChartPalette } from "../types";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import { AnimatedLabel } from "./AnimatedLabel";

const MAX_Y_LABELS = 15;

export function YAxisOverlay({
  entries,
  engine,
  padding,
  palette,
  font,
  badge = false,
  badgeTail = true,
  seriesLabelInset = 0,
  gridStyle,
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
  /** When > 0, series labels occupy the left portion of the gutter; Y-axis labels right-align. */
  seriesLabelInset?: number;
  /** Grid-line styling overrides. Omit for the legacy solid 1px line. */
  gridStyle?: ResolvedGridStyleConfig;
}) {
  const gridColor = gridStyle?.color ?? palette.gridLine;
  const gridWidth = gridStyle?.strokeWidth ?? 1;
  const gridIntervals = gridStyle?.intervals ?? [];
  const gridOpacity = gridStyle?.opacity ?? 1;
  const gridCacheRef = useRef<{
    a: SkPath;
    b: SkPath;
    tick: boolean;
  } | null>(null);
  if (gridCacheRef.current === null) {
    gridCacheRef.current = {
      a: Skia.Path.Make(),
      b: Skia.Path.Make(),
      tick: false,
    };
  }

  const gridLinesPath = useDerivedValue(() => {
    const gridCache = gridCacheRef.current!;
    gridCache.tick = !gridCache.tick;
    const path = gridCache.tick ? gridCache.a : gridCache.b;
    path.reset();
    const items = entries.get();
    const w = engine.canvasWidth.get();
    for (let i = 0; i < items.length; i++) {
      path.moveTo(padding.left, items[i].y);
      path.lineTo(w - padding.right, items[i].y);
    }
    return path;
  });

  const leftInset = BADGE_DOT_GAP + badgeTailAndCap(font.getSize(), badgeTail);

  const labelEntries = useDerivedValue(() => {
    const items = entries.get();
    const w = engine.canvasWidth.get();
    const fm = font.getMetrics();
    const baselineOffset = (fm.ascent + fm.descent) / 2;
    const result: { x: number; y: number; label: string; alpha: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      const textW = measureFontTextWidth(font, e.label);
      const x = badge
        ? pillTextLeftX(w, padding.right, leftInset, textW)
        : seriesLabelInset > 0
          ? gutterRightAlignedTextLeftX(w, textW)
          : gutterCenteredTextLeftX(w, padding.right, textW);
      result.push({
        x,
        y: e.y - baselineOffset,
        label: e.label,
        alpha: e.alpha,
      });
    }
    return result;
  });

  return (
    <Group>
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
      {Array.from({ length: MAX_Y_LABELS }, (_, i) => (
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
