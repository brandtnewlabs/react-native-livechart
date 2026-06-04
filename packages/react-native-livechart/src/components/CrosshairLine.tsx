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
  dimOpacity = 0.3,
  crosshairLineColor,
  crosshairDimColor,
}: {
  scrubX: SharedValue<number>;
  crosshairOpacity: SharedValue<number>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LiveChartPalette;
  /** Opacity of content right of the crosshair (dstOut fade). Default 0.3. */
  dimOpacity?: number;
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

  // dstOut erase color: alpha = fraction of trailing content to remove, ramped
  // by the crosshair fade-in. RGB is irrelevant for dstOut.
  const dimErase = useDerivedValue(
    () => `rgba(0,0,0,${(1 - dimOpacity) * crosshairOpacity.value})`,
  );

  return (
    <>
      {crosshairDimColor !== undefined ? (
        // Legacy: solid colored mask painted over the chart (opt-in).
        <Group opacity={crosshairOpacity}>
          <Rect
            x={scrubX}
            y={padding.top}
            width={dimWidth}
            height={dimHeight}
            color={crosshairDimColor}
          />
        </Group>
      ) : dimOpacity < 1 ? (
        // Erase the trailing content's alpha so it fades to the real background.
        <Group blendMode="dstOut">
          <Rect
            x={scrubX}
            y={padding.top}
            width={dimWidth}
            height={dimHeight}
            color={dimErase}
          />
        </Group>
      ) : null}

      <Group opacity={crosshairOpacity}>
        <Line
          p1={p1}
          p2={p2}
          color={crosshairLineColor ?? palette.crosshairLine}
          strokeWidth={1}
        />
      </Group>
    </>
  );
}
