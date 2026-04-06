import { Circle, Group } from "@shopify/react-native-skia";

import { useDerivedValue } from "react-native-reanimated";
import { MAX_MULTI_SERIES } from "../constants";
import type { ChartPadding } from "../draw/line";
import type { ResolvedPulseConfig } from "../core/resolveConfig";
import type { MultiEngineState } from "../core/useLiveChartEngine";

const MIN_PULSE_RADIUS = 6;
const PULSE_STAGGER_MS = 200;

function SeriesDotAtIndex({
  index,
  engine,
  padding,
  color,
  radius,
  pulse,
}: {
  index: number;
  engine: MultiEngineState;
  padding: ChartPadding;
  color: string;
  radius: number;
  pulse: ResolvedPulseConfig | null;
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

  const pulseRadius = useDerivedValue(() => {
    if (!pulse) return 0;
    const nowMs = engine.timestamp.value * 1000 + index * PULSE_STAGGER_MS;
    const t = (nowMs % pulse.interval) / pulse.duration;
    if (t >= 1) return 0;
    return MIN_PULSE_RADIUS + t * (pulse.maxRadius - MIN_PULSE_RADIUS);
  });

  const pulseOpacity = useDerivedValue(() => {
    if (!pulse) return 0;
    const nowMs = engine.timestamp.value * 1000 + index * PULSE_STAGGER_MS;
    const t = (nowMs % pulse.interval) / pulse.duration;
    if (t >= 1) return 0;
    return pulse.opacity * (1 - t);
  });

  return (
    <Group opacity={opacity}>
      {pulse && (
        <Circle
          cx={dotX}
          cy={dotY}
          r={pulseRadius}
          color={color}
          style="stroke"
          strokeWidth={pulse.strokeWidth}
          opacity={pulseOpacity}
        />
      )}
      <Circle cx={dotX} cy={dotY} r={radius} color={color} />
    </Group>
  );
}

export function MultiSeriesDots({
  engine,
  padding,
  colors,
  radius,
  pulse,
}: {
  engine: MultiEngineState;
  padding: ChartPadding;
  colors: string[];
  radius: number;
  pulse: ResolvedPulseConfig | null;
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
          radius={radius}
          pulse={pulse}
        />
      ))}
    </Group>
  );
}
