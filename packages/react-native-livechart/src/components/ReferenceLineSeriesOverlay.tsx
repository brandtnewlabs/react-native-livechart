import {
  DashPathEffect,
  Group,
  Path,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { usePathBuilder } from "../hooks/usePathBuilder";
import { useReferenceLineSeries } from "../hooks/useReferenceLineSeries";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import { thresholdDashPhase } from "../math/threshold";
import type { LiveChartPalette, ReferenceLine } from "../types";

/**
 * Draws Form-B `ReferenceLine.series` geometry. The base pass is a clipped Skia
 * polyline behind the chart; the badge pass is the live-edge label above the
 * chart fade, matching the existing two-pass reference-line layering.
 */
export function ReferenceLineSeriesOverlay({
  engine,
  padding,
  line,
  palette,
  formatValue,
  font,
  badgeLayer,
}: {
  engine: ChartEngineLayout;
  padding: ChartPadding;
  line: ReferenceLine;
  palette: LiveChartPalette;
  formatValue: (value: number) => string;
  font: SkFont;
  badgeLayer: boolean;
}) {
  const points = line.series ?? [];
  const extendToNow = line.extendToNow ?? true;
  const geometry = useReferenceLineSeries(
    engine,
    padding,
    points,
    extendToNow,
  );
  const color = line.color ?? palette.refLine;
  const labelColor = line.labelColor ?? line.color ?? palette.refLabel;
  const strokeOpacity = Math.max(0, Math.min(1, line.strokeOpacity ?? 1));
  const strokeWidth = line.strokeWidth ?? 1;
  const intervals = line.intervals ?? [4, 4];
  const dashCycle = intervals[0] + intervals[1];

  const builder = usePathBuilder();
  const path = useDerivedValue(() => {
    const b = builder.value;
    const screen = geometry.screenPts.get();
    if (geometry.visible.get() && screen.length >= 4) {
      b.moveTo(screen[0], screen[1]);
      for (let i = 2; i < screen.length; i += 2) {
        b.lineTo(screen[i], screen[i + 1]);
      }
    }
    return b.detach();
  });
  const pathOpacity = useDerivedValue(() =>
    geometry.visible.get() ? strokeOpacity : 0,
  );
  const dashPhase = useDerivedValue(() =>
    thresholdDashPhase(
      engine.timestamp.get(),
      engine.displayWindow.get(),
      padding.left,
      engine.canvasWidth.get() - padding.right,
      dashCycle,
    ),
  );
  const plotClip = useDerivedValue(() => ({
    x: padding.left,
    y: padding.top,
    width: Math.max(0, engine.canvasWidth.get() - padding.left - padding.right),
    height: Math.max(
      0,
      engine.canvasHeight.get() - padding.top - padding.bottom,
    ),
  }));

  const metrics = font.getMetrics();
  const baselineOffset = (metrics.ascent + metrics.descent) / 2;
  const labelText = useDerivedValue(() => {
    const value = formatValue(geometry.currentValue.get());
    if (line.label) return line.showValue ? `${line.label} ${value}` : line.label;
    return value;
  });
  const labelX = useDerivedValue(() => {
    const left = padding.left;
    const right = engine.canvasWidth.get() - padding.right;
    const position = line.labelPosition ?? "right";
    if (position === "left") return left + 4;
    if (position === "center") {
      return (left + right) / 2 - measureFontTextWidth(font, labelText.get()) / 2;
    }
    return right + 4;
  });
  const labelY = useDerivedValue(
    () => geometry.currentY.get() - baselineOffset,
  );
  const labelOpacity = useDerivedValue(() =>
    geometry.currentVisible.get() ? 1 : 0,
  );

  if (badgeLayer) {
    return (
      <Group opacity={labelOpacity}>
        <SkiaText
          x={labelX}
          y={labelY}
          text={labelText}
          font={font}
          color={labelColor}
        />
      </Group>
    );
  }

  return (
    <Group clip={plotClip} opacity={pathOpacity}>
      <Path
        path={path}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        strokeJoin="round"
        color={color}
      >
        <DashPathEffect intervals={intervals} phase={dashPhase} />
      </Path>
    </Group>
  );
}
