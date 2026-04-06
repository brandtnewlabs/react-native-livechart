import { DashPathEffect, Group, Path, Skia } from "@shopify/react-native-skia";

import { useDerivedValue } from "react-native-reanimated";
import { MAX_MULTI_SERIES } from "../constants";
import type { ChartPadding } from "../draw/line";
import type { ResolvedValueLineConfig } from "../core/resolveConfig";
import type { MultiEngineState } from "../core/useLiveChartEngine";

function SeriesValueLineAtIndex({
  index,
  engine,
  padding,
  color,
  config,
}: {
  index: number;
  engine: MultiEngineState;
  padding: ChartPadding;
  color: string;
  config: ResolvedValueLineConfig;
}) {
  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const h = engine.canvasHeight.value;
    if (h === 0) return p;
    const s = engine.series.value;
    const displays = engine.displaySeriesValues.value;
    if (index >= s.length) return p;

    const chartH = h - padding.top - padding.bottom;
    const dMin = engine.displayMin.value;
    const dMax = engine.displayMax.value;
    const valRange = dMax - dMin;
    const v = displays[index] ?? s[index].value;
    const y =
      valRange === 0
        ? padding.top + chartH / 2
        : padding.top + ((dMax - v) / valRange) * chartH;

    if (y < 0) return p;
    p.moveTo(padding.left, y);
    p.lineTo(engine.canvasWidth.value - padding.right, y);
    return p;
  });

  const opacity = useDerivedValue(() => {
    const s = engine.series.value;
    const op = engine.seriesOpacities.value;
    if (index >= s.length || index >= op.length) return 0;
    return (op[index] ?? 0) * 0.4;
  });

  return (
    <Group opacity={opacity}>
      <Path
        path={path}
        style="stroke"
        strokeWidth={config.strokeWidth}
        color={config.color ?? color}
      >
        <DashPathEffect intervals={config.intervals} />
      </Path>
    </Group>
  );
}

export function MultiSeriesValueLines({
  engine,
  padding,
  colors,
  config,
}: {
  engine: MultiEngineState;
  padding: ChartPadding;
  colors: string[];
  config: ResolvedValueLineConfig;
}) {
  return (
    <Group>
      {Array.from({ length: MAX_MULTI_SERIES }, (_, i) => (
        <SeriesValueLineAtIndex
          key={i}
          index={i}
          engine={engine}
          padding={padding}
          color={colors[i] ?? "#ffffff"}
          config={config}
        />
      ))}
    </Group>
  );
}
