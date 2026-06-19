import { Circle, Group } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type {
  ResolvedDotRingConfig,
  ResolvedPulseConfig,
} from "../core/resolveConfig";
import type { LiveChartPalette } from "../types";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";

const MIN_PULSE_RADIUS = 9;

/**
 * Live dot + expanding pulse ring. The dot is a color-filled circle of `radius`
 * with an optional contrasting outer `ring` (halo). Peak pulse size uses
 * `pulse.maxRadius` / `pulse.strokeWidth`; chart padding reserves the same outer
 * extent via `pulseRadialOutset` in `draw/line.ts` (see `resolveChartLayout`).
 */
export function DotOverlay({
  dotX,
  dotY,
  palette,
  engine,
  pulse,
  radius,
  ring,
  color,
  viewEnd,
}: {
  dotX: SharedValue<number>;
  dotY: SharedValue<number>;
  palette: LiveChartPalette;
  engine: ChartEngineLayout;
  pulse: ResolvedPulseConfig | null;
  /** Radius of the color-filled dot in pixels. */
  radius: number;
  /** Outer halo ring, or `null` for a flat dot. */
  ring: ResolvedDotRingConfig | null;
  /** Dot (and pulse) fill color; falls back to the chart line color. */
  color: string | undefined;
  /**
   * Time-scroll right edge (`null` = following live). While scrolled back the
   * pulse is suppressed — it's driven by the (now frozen) view timestamp, so it
   * would stick or flicker, and a "live" heartbeat on a historical point is wrong.
   */
  viewEnd?: SharedValue<number | null>;
}) {
  const dotColor = color ?? palette.line;

  const pulseRadius = useDerivedValue(() => {
    if (!pulse) return 0;
    if (viewEnd?.value != null) return 0; // scrolled back — no live pulse
    const nowMs = engine.timestamp.value * 1000;
    const t = (nowMs % pulse.interval) / pulse.duration;
    if (t >= 1) return 0;
    return MIN_PULSE_RADIUS + t * (pulse.maxRadius - MIN_PULSE_RADIUS);
  });

  const pulseOpacity = useDerivedValue(() => {
    if (!pulse) return 0;
    if (viewEnd?.value != null) return 0; // scrolled back — no live pulse
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
          color={dotColor}
          style="stroke"
          strokeWidth={pulse.strokeWidth}
          opacity={pulseOpacity}
        />
      )}

      {ring && (
        <Circle
          cx={dotX}
          cy={dotY}
          r={radius + ring.width}
          color={ring.color ?? palette.badgeOuterBg}
        />
      )}

      <Circle cx={dotX} cy={dotY} r={radius} color={dotColor} />
    </Group>
  );
}
