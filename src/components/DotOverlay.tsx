import { Circle, Group } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { ResolvedPulseConfig } from "../resolveConfig";
import type { LiveChartPalette } from "../types";
import type { ChartEngineLayout } from "../useLiveChartEngine";

const MIN_PULSE_RADIUS = 9;
const DOT_OUTER_RADIUS = 6.5;
const DOT_INNER_RADIUS = 3.5;

/**
 * Live dot + expanding pulse ring. Peak ring size uses `pulse.maxRadius` and
 * `pulse.strokeWidth`; chart padding reserves the same outer extent via
 * `pulseRadialOutset` in `draw/line.ts` (see `resolveChartLayout`).
 */
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

      <Circle
        cx={dotX}
        cy={dotY}
        r={DOT_OUTER_RADIUS}
        color={palette.badgeOuterBg}
      />

      <Circle cx={dotX} cy={dotY} r={DOT_INNER_RADIUS} color={palette.line} />
    </Group>
  );
}
