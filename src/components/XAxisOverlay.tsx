import { Group, Path, Skia, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { ChartPadding } from "../draw/line";
import type { XAxisEntry } from "../hooks/useXAxis";
import { measureFontTextWidth } from "../measureFontTextWidth";
import type { LivelinePalette } from "../types";
import type { ChartEngineLayout } from "../useLivelineEngine";
import { AnimatedLabel } from "./AnimatedLabel";

const MAX_X_LABELS = 10;

export function XAxisOverlay({
  entries,
  engine,
  padding,
  palette,
  font,
}: {
  entries: SharedValue<XAxisEntry[]>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LivelinePalette;
  font: SkFont;
}) {
  const axisPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const w = engine.canvasWidth.value;
    const h = engine.canvasHeight.value;
    const lineY = h - padding.bottom;

    // Bottom axis line
    path.moveTo(padding.left, lineY);
    path.lineTo(w - padding.right, lineY);

    // Tick marks
    const items = entries.value;
    for (let i = 0; i < items.length; i++) {
      path.moveTo(items[i].x, lineY);
      path.lineTo(items[i].x, lineY + 5);
    }
    return path;
  });

  // Transform XAxisEntry[] into { x, y, label, alpha } for AnimatedLabel
  const labelEntries = useDerivedValue(() => {
    const items = entries.value;
    const h = engine.canvasHeight.value;
    const y = h - padding.bottom + 19;
    return items.map((e) => ({
      x: e.x - measureFontTextWidth(font, e.label) / 2,
      y,
      label: e.label,
      alpha: e.alpha,
    }));
  });

  return (
    <Group>
      <Path
        path={axisPath}
        style="stroke"
        strokeWidth={1}
        color={palette.gridLine}
      />
      {Array.from({ length: MAX_X_LABELS }, (_, i) => (
        <AnimatedLabel
          key={i}
          entries={labelEntries}
          index={i}
          font={font}
          color={palette.timeLabel}
        />
      ))}
    </Group>
  );
}
