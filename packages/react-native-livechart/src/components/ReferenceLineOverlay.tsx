import {
    DashPathEffect,
    Group,
    Path,
    Skia,
    Text as SkiaText,
    type SkFont,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ReferenceLineLayout } from "../hooks/useReferenceLine";

/**
 * Renders a dashed horizontal reference line with an optional right-gutter label.
 * Placed inside the Skia <Canvas>, after the fill and before the chart line.
 */
export function ReferenceLineOverlay({
  layout,
  strokeWidth,
  intervals,
  color,
  labelColor,
  font,
}: {
  layout: SharedValue<ReferenceLineLayout>;
  strokeWidth: number;
  intervals: [number, number];
  color: string;
  labelColor: string;
  font: SkFont;
}) {
  const opacity = useDerivedValue(() => (layout.value.visible ? 1 : 0));

  const cache = useMemo(
    () => ({
      a: Skia.Path.Make(),
      b: Skia.Path.Make(),
      tick: false,
    }),
    [],
  );

  const linePath = useDerivedValue(() => {
    cache.tick = !cache.tick;
    const path = cache.tick ? cache.a : cache.b;
    path.reset();
    const l = layout.value;
    if (!l.visible) return path;
    path.moveTo(l.x1, l.y);
    path.lineTo(l.x2, l.y);
    return path;
  });

  const labelX = useDerivedValue(() => layout.value.labelX);
  const labelY = useDerivedValue(() => layout.value.labelY);
  const labelText = useDerivedValue(() => layout.value.label);

  return (
    <Group opacity={opacity}>
      <Path
        path={linePath}
        style="stroke"
        strokeWidth={strokeWidth}
        color={color}
      >
        <DashPathEffect intervals={intervals} />
      </Path>
      <SkiaText
        x={labelX}
        y={labelY}
        text={labelText}
        font={font}
        color={labelColor}
      />
    </Group>
  );
}
