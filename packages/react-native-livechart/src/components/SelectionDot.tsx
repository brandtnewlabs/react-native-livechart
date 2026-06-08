import { Circle, Group } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { ResolvedSelectionDotConfig } from "../core/resolveConfig";

/**
 * Built-in selection dot: a filled circle at the scrub intersection plus an
 * optional subtle outer ring (the `ring` config). Drawn only when `y >= 0` (the
 * sentinel for "no dot") — an off-screen Y hides it naturally.
 */
export function DefaultSelectionDot({
  x,
  y,
  opacity,
  color,
  size,
  ring,
}: {
  x: SharedValue<number>;
  y: SharedValue<number>;
  opacity: SharedValue<number>;
  color: string;
  size: number;
  ring: ResolvedSelectionDotConfig["ring"];
}) {
  // Push the dot off-screen when there's no value to mark (y < 0), so the
  // sentinel never paints a stray dot at the top of the plot.
  const cy = useDerivedValue(() => (y.get() < 0 ? -size * 4 : y.get()));
  return (
    <Group opacity={opacity}>
      {ring && (
        <Circle
          cx={x}
          cy={cy}
          r={size + ring.width}
          color={ring.color ?? color}
          opacity={0.25}
        />
      )}
      <Circle cx={x} cy={cy} r={size} color={color} />
    </Group>
  );
}

/**
 * Resolves the selection-dot slot inside a crosshair overlay: renders nothing
 * when `config` is null or the position is unavailable, the consumer's custom
 * `component` when one is given, and the built-in dot otherwise.
 *
 * `color` is the resolved fallback (line / leading-series color) used when the
 * config's own `color` is unset.
 */
export function SelectionDotSlot({
  config,
  x,
  y,
  active,
  opacity,
  color,
}: {
  config?: ResolvedSelectionDotConfig | null;
  x: SharedValue<number>;
  y?: SharedValue<number>;
  active?: SharedValue<number> | SharedValue<boolean>;
  opacity: SharedValue<number>;
  color: string;
}) {
  if (!config || y === undefined || !active) return null;
  const dotColor = config.color ?? color;
  if (config.component) {
    const Custom = config.component;
    return (
      <Custom
        x={x}
        y={y}
        active={active as SharedValue<boolean>}
        opacity={opacity}
        color={dotColor}
        size={config.size}
      />
    );
  }
  return (
    <DefaultSelectionDot
      x={x}
      y={y}
      opacity={opacity}
      color={dotColor}
      size={config.size}
      ring={config.ring}
    />
  );
}
