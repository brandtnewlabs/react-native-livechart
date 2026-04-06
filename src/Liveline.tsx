import {
  Canvas,
  Circle,
  LinearGradient,
  Path,
  vec,
} from "@shopify/react-native-skia";
import { useCanvasLayout, useChartPaths, useLiveDot } from "./hooks";

import type { LivelineProps } from "./types";
import { View } from "react-native";
import { resolvePadding } from "./draw/line";
import { resolveTheme } from "./theme";
import { useLivelineEngine } from "./useLivelineEngine";

export function Liveline({
  data,
  value,
  theme = "dark",
  color = "#3b82f6",
  window: windowSecs = 30,
  lerpSpeed = 0.08,
  exaggerate = false,
  referenceLine,
  fill = true,
  lineWidth: lineWidthProp,
  backgroundColor,
  padding,
  style,
}: LivelineProps) {
  const palette = resolveTheme(color, theme);
  const strokeWidth = lineWidthProp ?? palette.lineWidth;
  const effectivePadding = resolvePadding(padding);

  const engine = useLivelineEngine({
    data,
    value,
    window: windowSecs,
    lerpSpeed,
    exaggerate,
    referenceValue: referenceLine?.value,
  });

  const { layoutHeight, onLayout } = useCanvasLayout(engine);
  const { linePath, fillPath } = useChartPaths(engine, effectivePadding);
  const { dotX, dotY } = useLiveDot(engine, effectivePadding);

  const bgColor =
    backgroundColor ??
    `rgb(${palette.bgRgb[0]}, ${palette.bgRgb[1]}, ${palette.bgRgb[2]})`;
  const gradientEnd = Math.max(1, layoutHeight - effectivePadding.bottom);

  return (
    <View
      style={[{ flex: 1, backgroundColor: bgColor }, style]}
      onLayout={onLayout}
    >
      <Canvas style={{ flex: 1 }}>
        {fill && (
          <Path path={fillPath} style="fill">
            <LinearGradient
              start={vec(0, effectivePadding.top)}
              end={vec(0, gradientEnd)}
              colors={[palette.fillTop, palette.fillBottom]}
            />
          </Path>
        )}

        <Path
          path={linePath}
          style="stroke"
          strokeWidth={strokeWidth}
          color={palette.line}
          strokeCap="round"
          strokeJoin="round"
        />

        <Circle cx={dotX} cy={dotY} r={4} color={palette.line} />
      </Canvas>
    </View>
  );
}
