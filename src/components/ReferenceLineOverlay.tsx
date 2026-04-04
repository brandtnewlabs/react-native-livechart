import {
  DashPathEffect,
  Group,
  Path,
  Skia,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ReferenceLineLayout } from "../hooks/useReferenceLine";
import type { LivelinePalette } from "../types";

/**
 * Renders a dashed horizontal reference line with an optional right-gutter label.
 * Placed inside the Skia <Canvas>, after the fill and before the chart line.
 */
export function ReferenceLineOverlay({
  layout,
  palette,
  font,
}: {
  layout: SharedValue<ReferenceLineLayout>;
  palette: LivelinePalette;
  font: SkFont;
}) {
  const opacity = useDerivedValue(() => (layout.value.visible ? 1 : 0));

  const linePath = useDerivedValue(() => {
    const l = layout.value;
    const path = Skia.Path.Make();
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
        strokeWidth={1}
        color={palette.refLine}
      >
        <DashPathEffect intervals={[4, 4]} />
      </Path>
      <SkiaText
        x={labelX}
        y={labelY}
        text={labelText as unknown as string}
        font={font}
        color={palette.refLabel}
      />
    </Group>
  );
}
