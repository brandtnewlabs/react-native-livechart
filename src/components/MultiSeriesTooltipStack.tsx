import {
  Group,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { MAX_MULTI_SERIES } from "../constants";
import type { TooltipLayout } from "../hooks/crosshairShared";
import type { LivelinePalette } from "../types";

const TOOLTIP_STACK_SLOTS = MAX_MULTI_SERIES + 1;

function TooltipStackLine({
  index,
  tooltipLayout,
  font,
  palette,
}: {
  index: number;
  tooltipLayout: SharedValue<TooltipLayout>;
  font: SkFont;
  palette: LivelinePalette;
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
      <SkiaText
        x={x}
        y={y}
        text={text as unknown as string}
        font={font}
        color={color as unknown as string}
      />
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
  palette: LivelinePalette;
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
