import { Group, Line, Rect } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { type ChartPadding } from "../draw/line";
import type { LiveChartPalette } from "../types";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";

/**
 * Crosshair vertical line + dim region to the right. No tooltip pill —
 * multi-series delivers scrub data via `onScrub` / `onScrubWorklet` callbacks.
 */
export function CrosshairLine({
  scrubX,
  crosshairOpacity,
  engine,
  padding,
  palette,
  crosshairLineColor,
  crosshairDimColor,
}: {
  scrubX: SharedValue<number>;
  crosshairOpacity: SharedValue<number>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LiveChartPalette;
  crosshairLineColor?: string;
  crosshairDimColor?: string;
}) {
  const p1 = useDerivedValue(() => ({
    x: scrubX.value,
    y: padding.top,
  }));
  const p2 = useDerivedValue(() => ({
    x: scrubX.value,
    y: engine.canvasHeight.value - padding.bottom,
  }));

  const dimWidth = useDerivedValue(() => {
    const rightEdge = engine.canvasWidth.value - padding.right;
    return Math.max(0, rightEdge - scrubX.value);
  });
  const dimHeight = useDerivedValue(
    () => engine.canvasHeight.value - padding.top - padding.bottom,
  );

  return (
    <Group opacity={crosshairOpacity}>
      <Rect
        x={scrubX}
        y={padding.top}
        width={dimWidth}
        height={dimHeight}
        color={crosshairDimColor ?? palette.crosshairDim}
      />
      <Line
        p1={p1}
        p2={p2}
        color={crosshairLineColor ?? palette.crosshairLine}
        strokeWidth={1}
      />
    </Group>
  );
}
