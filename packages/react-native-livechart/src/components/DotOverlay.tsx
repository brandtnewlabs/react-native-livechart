import { useEffect } from "react";
import { BlurMask, Circle, Group } from "@shopify/react-native-skia";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import type {
  ResolvedDotGlowConfig,
  ResolvedDotRingConfig,
  ResolvedPulseConfig,
} from "../core/resolveConfig";
import type { LiveChartPalette } from "../types";

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
  pulse,
  glow = null,
  radius,
  ring,
  color,
  viewEnd,
  pulseWhileParked = false,
}: {
  dotX: SharedValue<number>;
  dotY: SharedValue<number>;
  palette: LiveChartPalette;
  pulse: ResolvedPulseConfig | null;
  /** Optional soft static glow; unlike `pulse`, it starts no frame callback. */
  glow?: ResolvedDotGlowConfig | null;
  /** Radius of the color-filled dot in pixels. */
  radius: number;
  /** Outer halo ring, or `null` for a flat dot. */
  ring: ResolvedDotRingConfig | null;
  /** Dot (and pulse) fill color; falls back to the chart line color. */
  color: string | undefined;
  /**
   * Time-scroll right edge (`null` = following live). While scrolled back the
   * pulse is suppressed because a "live" heartbeat on a historical point is
   * misleading.
   */
  viewEnd?: SharedValue<number | null>;
  /**
   * Keep the heartbeat pulse while scrolled back. Set when the dot tracks the
   * true live point (`dot.trackWhileParked`), so the pulse marks an honest
   * live position; edge-pinned `followViewEdge` dots keep the suppression.
   */
  pulseWhileParked?: boolean;
}) {
  const dotColor = color ?? palette.line;

  // Pulse clock: wall time, not `engine.timestamp` — a `nowOverride` freezes
  // the engine clock between data updates, which freezes the pulse with it.
  // Runs only while a pulse is configured (resolvePulse returns null when the
  // chart is static, so a suspended chart burns no frames here).
  const pulseClockMs = useSharedValue(0);
  /* istanbul ignore next -- frame-callback worklet runs on the UI thread, not in Jest */
  const pulseClock = useFrameCallback((frame) => {
    pulseClockMs.value = frame.timestamp;
  }, pulse != null);
  useEffect(() => {
    pulseClock.setActive(pulse != null);
  }, [pulse, pulseClock]);

  const pulseRadius = useDerivedValue(() => {
    if (!pulse) return 0;
    if (!pulseWhileParked && viewEnd?.value != null) return 0; // scrolled back — no live pulse
    const nowMs = pulseClockMs.value;
    const t = (nowMs % pulse.interval) / pulse.duration;
    if (t >= 1) return 0;
    return MIN_PULSE_RADIUS + t * (pulse.maxRadius - MIN_PULSE_RADIUS);
  });

  const pulseOpacity = useDerivedValue(() => {
    if (!pulse) return 0;
    if (!pulseWhileParked && viewEnd?.value != null) return 0; // scrolled back — no live pulse
    const nowMs = pulseClockMs.value;
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

      {glow && (
        <Circle
          cx={dotX}
          cy={dotY}
          r={glow.radius}
          color={glow.color ?? dotColor}
          opacity={glow.opacity}
        >
          <BlurMask blur={glow.blur} style="normal" />
        </Circle>
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
