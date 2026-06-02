import { Group, Path, Skia, type SkFont } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { BADGE_DOT_GAP } from "../constants";
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
}) {
  const gridCache = useMemo(
    () => ({
      a: Skia.Path.Make(),
      b: Skia.Path.Make(),
      tick: false,
    }),
    [],
  );

  const gridLinesPath = useDerivedValue(() => {
    gridCache.tick = !gridCache.tick;
    const path = gridCache.tick ? gridCache.a : gridCache.b;
    path.reset();
    const items = entries.value;
    const w = engine.canvasWidth.value;
    for (let i = 0; i < items.length; i++) {
      path.moveTo(padding.left, items[i].y);
      path.lineTo(w - padding.right, items[i].y);
    }
    return path;
  });

  const leftInset = BADGE_DOT_GAP + badgeTailAndCap(font.getSize(), badgeTail);

  const labelEntries = useDerivedValue(() => {
    const items = entries.value;
    const w = engine.canvasWidth.value;
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
      <Path
        path={gridLinesPath}
        style="stroke"
        strokeWidth={1}
        color={palette.gridLine}
      />
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
