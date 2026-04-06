import {
  Group,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { ChartPadding } from "../draw/line";
import type { TradeMarker } from "../draw/trade";
import { lerpColor } from "../math/color";
import type { LiveChartPalette } from "../types";

const MAX_TRADE_LABELS = 20;

const GREEN: [number, number, number] = [34, 197, 94];
const RED: [number, number, number] = [239, 68, 68];

function TapeLabel({
  index,
  markers,
  bgRgb,
  labelX,
  font,
  groupOpacity,
}: {
  index: number;
  markers: SharedValue<TradeMarker[]>;
  bgRgb: [number, number, number];
  labelX: number;
  font: SkFont;
  groupOpacity: SharedValue<number>;
}) {
  /* istanbul ignore next -- worklet */
  const y = useDerivedValue(() => markers.value[index]?.y ?? -200);
  /* istanbul ignore next -- worklet */
  const text = useDerivedValue(() => markers.value[index]?.label ?? " ");

  /* istanbul ignore next -- worklet */
  const fillColor = useDerivedValue(() => {
    const m = markers.value[index];
    if (!m) return "transparent";
    const base = m.green ? GREEN : RED;
    return lerpColor(base, bgRgb, 1 - m.alpha);
  });

  /* istanbul ignore next -- worklet */
  const outlineColor = useDerivedValue(() => {
    const m = markers.value[index];
    if (!m) return "transparent";
    return `rgb(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]})`;
  });

  /* istanbul ignore next -- worklet */
  const opacity = useDerivedValue(() => {
    const m = markers.value[index];
    if (!m) return 0;
    return groupOpacity.value;
  });

  return (
    <Group opacity={opacity}>
      <SkiaText
        x={labelX}
        y={y}
        text={text}
        font={font}
        color={outlineColor}
        style="stroke"
        strokeWidth={0.5}
        opacity={0.75}
      />
      <SkiaText x={labelX} y={y} text={text} font={font} color={fillColor} />
    </Group>
  );
}

export function TradeStreamOverlay({
  markers,
  palette,
  padding,
  font,
  opacity,
  labelOffsetX = 8,
}: {
  markers: SharedValue<TradeMarker[]>;
  palette: LiveChartPalette;
  padding: ChartPadding;
  font: SkFont;
  opacity: SharedValue<number>;
  labelOffsetX?: number;
}) {
  const labelX = padding.left + labelOffsetX;
  const slots = [];
  for (let i = 0; i < MAX_TRADE_LABELS; i++) {
    slots.push(
      <TapeLabel
        key={i}
        index={i}
        markers={markers}
        bgRgb={palette.bgRgb}
        labelX={labelX}
        font={font}
        groupOpacity={opacity}
      />,
    );
  }
  return <Group>{slots}</Group>;
}
