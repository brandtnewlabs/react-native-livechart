import { Circle, Group } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { LivelinePalette, Momentum } from "../types";
import type { EngineState } from "../useLivelineEngine";

const PULSE_INTERVAL = 1500;
const PULSE_DURATION = 900;

export function DotOverlay({
  dotX,
  dotY,
  momentum,
  palette,
  engine,
  pulse = true,
}: {
  dotX: SharedValue<number>;
  dotY: SharedValue<number>;
  momentum: SharedValue<Momentum>;
  palette: LivelinePalette;
  engine: EngineState;
  pulse?: boolean;
}) {
  // Glow color based on momentum
  const glowColor = useDerivedValue(() => {
    const m = momentum.value;
    if (m === "up") return palette.glowUp;
    if (m === "down") return palette.glowDown;
    return palette.glowFlat;
  });

  // Pulse ring: expanding radius + fading opacity
  const pulseRadius = useDerivedValue(() => {
    if (!pulse) return 0;
    const nowMs = engine.timestamp.value * 1000;
    const t = (nowMs % PULSE_INTERVAL) / PULSE_DURATION;
    if (t >= 1) return 0;
    return 9 + t * 12;
  });

  const pulseOpacity = useDerivedValue(() => {
    if (!pulse) return 0;
    const nowMs = engine.timestamp.value * 1000;
    const t = (nowMs % PULSE_INTERVAL) / PULSE_DURATION;
    if (t >= 1) return 0;
    return 0.35 * (1 - t);
  });

  return (
    <Group>
      {/* Glow circle */}
      <Circle
        cx={dotX}
        cy={dotY}
        r={14}
        color={glowColor as unknown as string}
      />

      {/* Pulse ring */}
      {pulse && (
        <Circle
          cx={dotX}
          cy={dotY}
          r={pulseRadius}
          color={palette.line}
          style="stroke"
          strokeWidth={1.5}
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
