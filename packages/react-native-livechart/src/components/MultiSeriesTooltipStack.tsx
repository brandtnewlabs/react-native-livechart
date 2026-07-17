import {
  Group,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { TooltipLayout } from "../hooks/crosshairShared";
import type { LiveChartPalette } from "../types";

// Candle tooltips have exactly O/H/L/C + time. This component is only mounted
// for candle mode, so reserving the multi-series capacity registered 40 unused
// derived-value mappers (8 empty rows × 5 mappers).
const TOOLTIP_STACK_SLOTS = 5;

function TooltipStackLine({
  index,
  tooltipLayout,
  font,
  palette,
}: {
  index: number;
  tooltipLayout: SharedValue<TooltipLayout>;
  font: SkFont;
  palette: LiveChartPalette;
}) {
  const opacity = useDerivedValue(() => {
    const sl = tooltipLayout.value.stackedLines;
    if (!sl || index >= sl.length) return 0;
    return 1;
  });
  const text = useDerivedValue(() => {
    const sl = tooltipLayout.value.stackedLines;
    if (!sl || index >= sl.length) return "";
    return sl[index].text;
  });
  const x = useDerivedValue(() => {
    const sl = tooltipLayout.value.stackedLines;
    if (!sl || index >= sl.length) return -400;
    return sl[index].textX;
  });
  const y = useDerivedValue(() => {
    const sl = tooltipLayout.value.stackedLines;
    if (!sl || index >= sl.length) return 0;
    return sl[index].baselineY;
  });
  const color = useDerivedValue(() => {
    const sl = tooltipLayout.value.stackedLines;
    if (!sl || index >= sl.length) return palette.tooltipText;
    return sl[index].dim ? palette.gridLabel : palette.tooltipText;
  });
  return (
    <Group opacity={opacity}>
      <SkiaText x={x} y={y} text={text} font={font} color={color} />
    </Group>
  );
}

export function MultiSeriesTooltipStack({
  tooltipLayout,
  font,
  palette,
}: {
  tooltipLayout: SharedValue<TooltipLayout>;
  font: SkFont;
  palette: LiveChartPalette;
}) {
  return (
    <Group>
      {Array.from({ length: TOOLTIP_STACK_SLOTS }, (_, i) => (
        <TooltipStackLine
          key={i}
          index={i}
          tooltipLayout={tooltipLayout}
          font={font}
          palette={palette}
        />
      ))}
    </Group>
  );
}
