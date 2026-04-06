import { Canvas } from "@shopify/react-native-skia";
import React, { useCallback, useMemo } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { resolveTheme } from "./theme";
import type { LivelineProps } from "./types";
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
  style,
}: LivelineProps) {
  const palette = useMemo(() => resolveTheme(color, theme), [color, theme]);

  const engine = useLivelineEngine({
    data,
    value,
    window: windowSecs,
    lerpSpeed,
    exaggerate,
    referenceValue: referenceLine?.value,
  });

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      engine.canvasWidth.value = width;
      engine.canvasHeight.value = height;
    },
    [engine.canvasWidth, engine.canvasHeight],
  );

  const bgColor =
    theme === "dark"
      ? `rgb(${palette.bgRgb[0]}, ${palette.bgRgb[1]}, ${palette.bgRgb[2]})`
      : `rgb(${palette.bgRgb[0]}, ${palette.bgRgb[1]}, ${palette.bgRgb[2]})`;

  return (
    <View
      style={[{ flex: 1, backgroundColor: bgColor }, style]}
      onLayout={onLayout}
    >
      <Canvas style={{ flex: 1 }}>
        {/* Rendering layers added in subsequent phases */}
      </Canvas>
    </View>
  );
}
