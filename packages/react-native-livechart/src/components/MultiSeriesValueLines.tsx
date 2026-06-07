import { DashPathEffect, Group, Path } from "@shopify/react-native-skia";

import { useDerivedValue } from "react-native-reanimated";
import { MAX_MULTI_SERIES } from "../constants";
import type { ChartPadding } from "../draw/line";
import type { ResolvedValueLineConfig } from "../core/resolveConfig";
import type { MultiEngineState } from "../core/useLiveChartEngine";
import { usePathBuilder } from "../hooks/usePathBuilder";

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
  const builder = usePathBuilder();

  const path = useDerivedValue(() => {
    const b = builder.value;
    const h = engine.canvasHeight.get();
    const s = engine.series.get();
    const displays = engine.displaySeriesValues.get();
    if (h !== 0 && index < s.length) {
      const chartH = h - padding.top - padding.bottom;
      const dMin = engine.displayMin.get();
      const dMax = engine.displayMax.get();
      const valRange = dMax - dMin;
      const v = displays[index] ?? s[index].value;
      const y =
        valRange === 0
          ? padding.top + chartH / 2
          : padding.top + ((dMax - v) / valRange) * chartH;

      if (y >= 0) {
        b.moveTo(padding.left, y);
        b.lineTo(engine.canvasWidth.get() - padding.right, y);
      }
    }
    return b.detach();
  });

  const opacity = useDerivedValue(() => {
    const s = engine.series.get();
    const op = engine.seriesOpacities.get();
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
