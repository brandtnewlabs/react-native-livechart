import { DashPathEffect, Path } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartPadding } from "../draw/line";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import { usePathBuilder } from "../hooks/usePathBuilder";

/**
 * A dashed horizontal line that tracks the live display value — sitting at
 * the same Y as the badge and live dot. Rendered behind the chart line.
 */
export function ValueLineOverlay({
  dotY,
  engine,
  padding,
  strokeWidth,
  intervals,
  color,
}: {
  dotY: SharedValue<number>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  strokeWidth: number;
  intervals: [number, number];
  color: string;
}) {
  const builder = usePathBuilder();

  const path = useDerivedValue(() => {
    const b = builder.value;
    const y = dotY.get();
    if (y >= 0) {
      b.moveTo(padding.left, y);
      b.lineTo(engine.canvasWidth.get() - padding.right, y);
    }
    return b.detach();
  });

  return (
    <Path path={path} style="stroke" strokeWidth={strokeWidth} color={color}>
      <DashPathEffect intervals={intervals} />
    </Path>
  );
}
