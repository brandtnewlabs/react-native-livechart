import { Circle, Group } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { ResolvedPulseConfig } from "../resolveConfig";
import type { LiveChartPalette } from "../types";
import type { ChartEngineLayout } from "../useLiveChartEngine";

const MIN_PULSE_RADIUS = 9;

export function DotOverlay({
  dotX,
  dotY,
  palette,
  engine,
  pulse,
}: {
  dotX: SharedValue<number>;
  dotY: SharedValue<number>;
  palette: LiveChartPalette;
  engine: ChartEngineLayout;
  pulse: ResolvedPulseConfig | null;
}) {
  const pulseRadius = useDerivedValue(() => {
    if (!pulse) return 0;
    const nowMs = engine.timestamp.value * 1000;
    const t = (nowMs % pulse.interval) / pulse.duration;
    if (t >= 1) return 0;
    return MIN_PULSE_RADIUS + t * (pulse.maxRadius - MIN_PULSE_RADIUS);
  });

  const pulseOpacity = useDerivedValue(() => {
    if (!pulse) return 0;
    const nowMs = engine.timestamp.value * 1000;
    const t = (nowMs % pulse.interval) / pulse.duration;
    if (t >= 1) return 0;
    return pulse.opacity * (1 - t);
  });

  return (
    <Group>
      {/* Pulse ring */}
      {pulse && (
        <Circle
          cx={dotX}
          cy={dotY}
          r={pulseRadius}
          color={palette.line}
          style="stroke"
          strokeWidth={pulse.strokeWidth}
          opacity={pulseOpacity}
        />
      )}

      {/* Outer ring */}
      <Circle cx={dotX} cy={dotY} r={6.5} color={palette.badgeOuterBg} />

      {/* Inner dot */}
      <Circle cx={dotX} cy={dotY} r={3.5} color={palette.line} />
    </Group>
  );
}
