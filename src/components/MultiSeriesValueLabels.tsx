import {
  Group,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";

import { MAX_MULTI_SERIES } from "../constants";
import type { ChartPadding } from "../draw/line";
import type { MultiEngineState } from "../useLiveChartEngine";

const LABEL_GAP = 8;

function SeriesValueLabelAtIndex({
  index,
  engine,
  padding,
  color,
  font,
  dotRadius,
}: {
  index: number;
  engine: MultiEngineState;
  padding: ChartPadding;
  color: string;
  font: SkFont;
  dotRadius: number;
}) {
  const labelX = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    if (w === 0) return -200;
    return w - padding.right + dotRadius + LABEL_GAP;
  });

  const labelY = useDerivedValue(() => {
    const h = engine.canvasHeight.value;
    if (h === 0) return -200;
    const s = engine.series.value;
    const displays = engine.displaySeriesValues.value;
    if (index >= s.length) return -200;
    const chartH = h - padding.top - padding.bottom;
    const dMin = engine.displayMin.value;
    const dMax = engine.displayMax.value;
    const valRange = dMax - dMin;
    const v = displays[index] ?? s[index].value;
    const y =
      valRange === 0
        ? padding.top + chartH / 2
        : padding.top + ((dMax - v) / valRange) * chartH;

    const fm = font.getMetrics();
    return y - (fm.ascent + fm.descent) / 2;
  });

  const text = useDerivedValue(() => {
    const s = engine.series.value;
    if (index >= s.length) return "";
    return s[index].label ?? s[index].id;
  });

  const opacity = useDerivedValue(() => {
    const s = engine.series.value;
    const op = engine.seriesOpacities.value;
    if (index >= s.length || index >= op.length) return 0;
    return op[index] ?? 0;
  });

  return (
    <Group opacity={opacity}>
      <SkiaText x={labelX} y={labelY} text={text} font={font} color={color} />
    </Group>
  );
}

export function MultiSeriesValueLabels({
  engine,
  padding,
  colors,
  font,
  dotRadius,
}: {
  engine: MultiEngineState;
  padding: ChartPadding;
  colors: string[];
  font: SkFont;
  dotRadius: number;
}) {
  return (
    <Group>
      {Array.from({ length: MAX_MULTI_SERIES }, (_, i) => (
        <SeriesValueLabelAtIndex
          key={i}
          index={i}
          engine={engine}
          padding={padding}
          color={colors[i] ?? "#ffffff"}
          font={font}
          dotRadius={dotRadius}
        />
      ))}
    </Group>
  );
}
