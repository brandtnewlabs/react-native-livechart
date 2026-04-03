import { Group, Path, Skia, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { GridEntry } from "../draw/grid";
import type { ChartPadding } from "../draw/line";
import type { LivelinePalette } from "../types";
import type { EngineState } from "../useLivelineEngine";
import { AnimatedLabel } from "./AnimatedLabel";

const MAX_GRID_LABELS = 15;

export function GridOverlay({
  entries,
  engine,
  padding,
  palette,
  font,
}: {
  entries: SharedValue<GridEntry[]>;
  engine: EngineState;
  padding: ChartPadding;
  palette: LivelinePalette;
  font: SkFont;
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

  // Transform GridEntry[] into the { x, y, label, alpha } shape for AnimatedLabel
  const labelEntries = useDerivedValue(() => {
    const items = entries.value;
    const w = engine.canvasWidth.value;
    const marginCenter = w - padding.right + padding.right / 2;
    const fontHeight = font.getSize();
    const result: { x: number; y: number; label: string; alpha: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      const textW = font.getTextWidth(e.label);
      result.push({
        x: marginCenter - textW / 2,
        y: e.y + fontHeight / 2 - 1,
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
      {Array.from({ length: MAX_GRID_LABELS }, (_, i) => (
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
