import { Circle, Group } from "@shopify/react-native-skia";

import type { ChartPadding } from "../draw/line";
import { MAX_MULTI_SERIES } from "../constants";
import type { MultiEngineState } from "../useLivelineEngine";
import { useDerivedValue } from "react-native-reanimated";

function SeriesDotAtIndex({
  index,
  engine,
  padding,
  color,
}: {
  index: number;
  engine: MultiEngineState;
  padding: ChartPadding;
  color: string;
}) {
  const dotX = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    if (w === 0) return -100;
    return w - padding.right;
  });

  const dotY = useDerivedValue(() => {
    const h = engine.canvasHeight.value;
    if (h === 0) return -100;
    const s = engine.series.value;
    const displays = engine.displaySeriesValues.value;
    if (index >= s.length) return -100;
    const chartH = h - padding.top - padding.bottom;
    const dMin = engine.displayMin.value;
    const dMax = engine.displayMax.value;
    const valRange = dMax - dMin;
    const v = displays[index] ?? s[index].value;
    if (valRange === 0) return padding.top + chartH / 2;
    return padding.top + ((dMax - v) / valRange) * chartH;
  });

  const opacity = useDerivedValue(() => {
    const s = engine.series.value;
    const op = engine.seriesOpacities.value;
    if (index >= s.length || index >= op.length) return 0;
    return op[index] ?? 0;
  });

  return (
    <Group opacity={opacity}>
      <Circle cx={dotX} cy={dotY} r={5} color={color} />
    </Group>
  );
}

export function MultiSeriesDots({
  engine,
  padding,
  colors,
}: {
  engine: MultiEngineState;
  padding: ChartPadding;
  colors: string[];
}) {
  return (
    <Group>
      {Array.from({ length: MAX_MULTI_SERIES }, (_, i) => (
        <SeriesDotAtIndex
          key={i}
          index={i}
          engine={engine}
          padding={padding}
          color={colors[i] ?? "#ffffff"}
        />
      ))}
    </Group>
  );
}
