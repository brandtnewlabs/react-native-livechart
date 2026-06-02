import { Group, Path, Skia, type SkFont } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import type { XAxisEntry } from "../hooks/useXAxis";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import type { LiveChartPalette } from "../types";
import { AnimatedLabel } from "./AnimatedLabel";

const MAX_X_LABELS = 10;
const TICK_HEIGHT = 5;
const LABEL_OFFSET_Y = 19;

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
  palette: LiveChartPalette;
  font: SkFont;
}) {
  const axisCache = useMemo(
    () => ({
      a: Skia.Path.Make(),
      b: Skia.Path.Make(),
      tick: false,
    }),
    [],
  );

  const axisPath = useDerivedValue(() => {
    "worklet";
    axisCache.tick = !axisCache.tick;
    const path = axisCache.tick ? axisCache.a : axisCache.b;
    path.reset();
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
      path.lineTo(items[i].x, lineY + TICK_HEIGHT);
    }
    return path;
  });

  // Transform XAxisEntry[] into { x, y, label, alpha } for AnimatedLabel
  const labelEntries = useDerivedValue(() => {
    "worklet";
    const items = entries.value;
    const h = engine.canvasHeight.value;
    const y = h - padding.bottom + LABEL_OFFSET_Y;
    const n = items.length;
    const out: { x: number; y: number; label: string; alpha: number }[] = [];
    for (let i = 0; i < n; i++) {
      const e = items[i];
      out.push({
        x: e.x - measureFontTextWidth(font, e.label) / 2,
        y,
        label: e.label,
        alpha: e.alpha,
      });
    }
    return out;
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
