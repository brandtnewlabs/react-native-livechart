import {
  Group,
  Line,
  Rect,
  RoundedRect,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { type ChartPadding } from "../draw/line";
import { type TooltipLayout } from "../hooks/crosshairShared";
import type { LiveChartPalette } from "../types";
import type { ChartEngineLayout } from "../useLiveChartEngine";

const TOOLTIP_RADIUS = 5;

export function CrosshairOverlay({
  scrubX,
  crosshairOpacity,
  tooltipLayout,
  engine,
  padding,
  palette,
  font,
  showTooltip = true,
  tooltipBody,
  crosshairLineColor,
  crosshairDimColor,
}: {
  scrubX: SharedValue<number>;
  crosshairOpacity: SharedValue<number>;
  tooltipLayout: SharedValue<TooltipLayout>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LiveChartPalette;
  font: SkFont;
  showTooltip?: boolean;
  tooltipBody?: ReactNode;
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

  const tipX = useDerivedValue(() => tooltipLayout.value.x);
  const tipY = useDerivedValue(() => tooltipLayout.value.y);
  const tipW = useDerivedValue(() => tooltipLayout.value.w);
  const tipH = useDerivedValue(() => tooltipLayout.value.h);

  const valueStr = useDerivedValue(() => tooltipLayout.value.valueStr);
  const timeStr = useDerivedValue(() => tooltipLayout.value.timeStr);
  const valueTextX = useDerivedValue(() => tooltipLayout.value.valueTextX);
  const timeTextX = useDerivedValue(() => tooltipLayout.value.timeTextX);
  const line1Y = useDerivedValue(() => tooltipLayout.value.line1Y);
  const line2Y = useDerivedValue(() => tooltipLayout.value.line2Y);

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

      {showTooltip && (
        <>
          <RoundedRect
            x={tipX}
            y={tipY}
            width={tipW}
            height={tipH}
            r={TOOLTIP_RADIUS}
            color={palette.tooltipBg}
          />

          <RoundedRect
            x={tipX}
            y={tipY}
            width={tipW}
            height={tipH}
            r={TOOLTIP_RADIUS}
            color={palette.tooltipBorder}
            style="stroke"
            strokeWidth={1}
          />

          {tooltipBody ?? (
            <Group>
              <SkiaText
                x={valueTextX}
                y={line1Y}
                text={valueStr}
                font={font}
                color={palette.tooltipText}
              />
              <SkiaText
                x={timeTextX}
                y={line2Y}
                text={timeStr}
                font={font}
                color={palette.gridLabel}
              />
            </Group>
          )}
        </>
      )}
    </Group>
  );
}
