import { Group, Path, Skia, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { BADGE_DOT_GAP } from "../constants";
import type { YAxisEntry } from "../draw/grid";
import {
  badgeTailAndCap,
  gutterCenteredTextLeftX,
  pillTextLeftX,
  type ChartPadding,
} from "../draw/line";
import { measureFontTextWidth } from "../measureFontTextWidth";
import type { LivelinePalette } from "../types";
import type { ChartEngineLayout } from "../useLivelineEngine";
import { AnimatedLabel } from "./AnimatedLabel";

const MAX_Y_LABELS = 15;

export function YAxisOverlay({
  entries,
  engine,
  padding,
  palette,
  font,
  badge = false,
}: {
  entries: SharedValue<YAxisEntry[]>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LivelinePalette;
  font: SkFont;
  /** When true, use the asymmetric pill centering formula so labels align with badge text. */
  badge?: boolean;
}) {
  const gridLinesPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const items = entries.value;
    const w = engine.canvasWidth.value;
    for (let i = 0; i < items.length; i++) {
      path.moveTo(padding.left, items[i].y);
      path.lineTo(w - padding.right, items[i].y);
    }
    return path;
  });

  // Left inset = gap from dot to pill body (used by both badge and grid labels for alignment).
  const leftInset = BADGE_DOT_GAP + badgeTailAndCap(font.getSize());

  // Transform YAxisEntry[] into the { x, y, label, alpha } shape for AnimatedLabel.
  // When badge is shown, use pillTextLeftX so labels horizontally align with badge text.
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
