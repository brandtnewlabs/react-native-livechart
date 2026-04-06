import { Group, LinearGradient, Rect, vec } from "@shopify/react-native-skia";

import { useDerivedValue } from "react-native-reanimated";
import type { ChartEngineLayout } from "../useLiveChartEngine";

export function LeftEdgeFade({
  paddingLeft,
  fadeWidth,
  startColor,
  endColor,
  engine,
}: {
  paddingLeft: number;
  fadeWidth: number;
  startColor: string;
  endColor: string;
  engine: ChartEngineLayout;
}) {
  const rectWidth = paddingLeft + fadeWidth;
  const height = useDerivedValue(() => engine.canvasHeight.value);

  const gStart = vec(paddingLeft, 0);
  const gEnd = vec(paddingLeft + fadeWidth, 0);

  return (
    <Group blendMode="dstOut">
      <Rect x={0} y={0} width={rectWidth} height={height}>
        <LinearGradient
          start={gStart}
          end={gEnd}
          colors={[startColor, endColor]}
        />
      </Rect>
    </Group>
  );
}
