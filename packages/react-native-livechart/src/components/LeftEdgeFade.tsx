import { Group, LinearGradient, Rect, vec } from "@shopify/react-native-skia";

import { useDerivedValue } from "react-native-reanimated";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import { parseColorRgba } from "../theme";

export function LeftEdgeFade({
  paddingLeft,
  fadeWidth,
  startColor,
  endColor,
  engine,
  opaqueBackgroundRgb,
}: {
  paddingLeft: number;
  fadeWidth: number;
  startColor: string;
  endColor: string;
  engine: ChartEngineLayout;
  /** When set, paint the owned background instead of erasing destination alpha. */
  opaqueBackgroundRgb?: [number, number, number];
}) {
  const rectWidth = paddingLeft + fadeWidth;
  const height = useDerivedValue(() => engine.canvasHeight.value);

  const gStart = vec(paddingLeft, 0);
  const gEnd = vec(paddingLeft + fadeWidth, 0);
  const colors = opaqueBackgroundRgb
    ? [
        `rgba(${opaqueBackgroundRgb[0]},${opaqueBackgroundRgb[1]},${opaqueBackgroundRgb[2]},${parseColorRgba(startColor)[3]})`,
        `rgba(${opaqueBackgroundRgb[0]},${opaqueBackgroundRgb[1]},${opaqueBackgroundRgb[2]},${parseColorRgba(endColor)[3]})`,
      ]
    : [startColor, endColor];

  return (
    <Group blendMode={opaqueBackgroundRgb ? undefined : "dstOut"}>
      <Rect x={0} y={0} width={rectWidth} height={height}>
        <LinearGradient start={gStart} end={gEnd} colors={colors} />
      </Rect>
    </Group>
  );
}
