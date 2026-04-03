import {
  Group,
  Line,
  Rect,
  RoundedRect,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { type ChartPadding } from "../draw/line";
import { type TooltipLayout } from "../hooks/useCrosshair";
import type { LivelinePalette } from "../types";
import type { EngineState } from "../useLivelineEngine";

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
}: {
  scrubX: SharedValue<number>;
  crosshairOpacity: SharedValue<number>;
  tooltipLayout: SharedValue<TooltipLayout>;
  engine: EngineState;
  padding: ChartPadding;
  palette: LivelinePalette;
  font: SkFont;
  showTooltip?: boolean;
}) {
  // Crosshair line endpoints
  const p1 = useDerivedValue(() => ({
    x: scrubX.value,
    y: padding.top,
  }));
  const p2 = useDerivedValue(() => ({
    x: scrubX.value,
    y: engine.canvasHeight.value - padding.bottom,
  }));

  // Dim overlay: from crosshair X to the right chart edge
  const dimWidth = useDerivedValue(() => {
    const rightEdge = engine.canvasWidth.value - padding.right;
    return Math.max(0, rightEdge - scrubX.value);
  });
  const dimHeight = useDerivedValue(
    () => engine.canvasHeight.value - padding.top - padding.bottom,
  );

  // Tooltip pill geometry
  const tipX = useDerivedValue(() => tooltipLayout.value.x);
  const tipY = useDerivedValue(() => tooltipLayout.value.y);
  const tipW = useDerivedValue(() => tooltipLayout.value.w);
  const tipH = useDerivedValue(() => tooltipLayout.value.h);

  // Tooltip text
  const valueStr = useDerivedValue(() => tooltipLayout.value.valueStr);
  const timeStr = useDerivedValue(() => tooltipLayout.value.timeStr);
  const valueTextX = useDerivedValue(() => tooltipLayout.value.valueTextX);
  const timeTextX = useDerivedValue(() => tooltipLayout.value.timeTextX);
  const line1Y = useDerivedValue(() => tooltipLayout.value.line1Y);
  const line2Y = useDerivedValue(() => tooltipLayout.value.line2Y);

  return (
    <Group opacity={crosshairOpacity}>
      {/* Dim right of crosshair */}
      <Rect
        x={scrubX}
        y={padding.top}
        width={dimWidth}
        height={dimHeight}
        color="rgba(0, 0, 0, 0.12)"
      />

      {/* Vertical crosshair line */}
      <Line p1={p1} p2={p2} color={palette.crosshairLine} strokeWidth={1} />

      {showTooltip && (
        <>
          {/* Tooltip background */}
          <RoundedRect
            x={tipX}
            y={tipY}
            width={tipW}
            height={tipH}
            r={TOOLTIP_RADIUS}
            color={palette.tooltipBg}
          />

          {/* Tooltip border */}
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

          {/* Value string — primary text */}
          <SkiaText
            x={valueTextX}
            y={line1Y}
            text={valueStr as unknown as string}
            font={font}
            color={palette.tooltipText}
          />

          {/* Time string — secondary / dimmer text */}
          <SkiaText
            x={timeTextX}
            y={line2Y}
            text={timeStr as unknown as string}
            font={font}
            color={palette.gridLabel}
          />
        </>
      )}
    </Group>
  );
}
