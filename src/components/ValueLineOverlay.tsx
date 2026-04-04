import { DashPathEffect, Path, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartPadding } from "../draw/line";
import type { LivelinePalette } from "../types";
import type { EngineState } from "../useLivelineEngine";

/**
 * A dashed horizontal line that tracks the live display value — sitting at
 * the same Y as the badge and live dot. Rendered behind the chart line.
 */
export function ValueLineOverlay({
  dotY,
  engine,
  padding,
  palette,
}: {
  dotY: SharedValue<number>;
  engine: EngineState;
  padding: ChartPadding;
  palette: LivelinePalette;
}) {
  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const y = dotY.value;
    if (y < 0) return p;
    p.moveTo(padding.left, y);
    p.lineTo(engine.canvasWidth.value - padding.right, y);
    return p;
  });

  return (
    <Path path={path} style="stroke" strokeWidth={1} color={palette.dashLine}>
      <DashPathEffect intervals={[4, 4]} />
    </Path>
  );
}
