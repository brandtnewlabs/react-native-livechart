import {
  Canvas,
  Circle,
  LinearGradient,
  Path,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { useDerivedValue } from "react-native-reanimated";
import { buildLinePoints, DEFAULT_PADDING } from "./draw/line";
import { drawSpline } from "./math/spline";
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
  fill = true,
  lineWidth: lineWidthProp,
  style,
}: LivelineProps) {
  const palette = resolveTheme(color, theme);
  const strokeWidth = lineWidthProp ?? palette.lineWidth;

  const engine = useLivelineEngine({
    data,
    value,
    window: windowSecs,
    lerpSpeed,
    exaggerate,
    referenceValue: referenceLine?.value,
  });

  const [layoutHeight, setLayoutHeight] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    engine.canvasWidth.value = width;
    engine.canvasHeight.value = height;
    setLayoutHeight(height);
  };

  // ─── Derived paths (UI thread, react to shared value changes) ──────

  const flatPts = useDerivedValue(() =>
    buildLinePoints(
      engine.data.value,
      engine.displayValue.value,
      engine.timestamp.value,
      engine.displayWindow.value,
      engine.displayMin.value,
      engine.displayMax.value,
      engine.canvasWidth.value,
      engine.canvasHeight.value,
      DEFAULT_PADDING,
    ),
  );

  const linePath = useDerivedValue(() => {
    const pts = flatPts.value;
    const path = Skia.Path.Make();
    const n = pts.length >> 1;
    if (n < 2) return path;
    path.moveTo(pts[0], pts[1]);
    drawSpline(path, pts);
    return path;
  });

  const fillPath = useDerivedValue(() => {
    const pts = flatPts.value;
    const path = Skia.Path.Make();
    const n = pts.length >> 1;
    if (n < 2) return path;
    path.moveTo(pts[0], pts[1]);
    drawSpline(path, pts);
    const bottom = engine.canvasHeight.value - DEFAULT_PADDING.bottom;
    path.lineTo(pts[(n - 1) * 2], bottom);
    path.lineTo(pts[0], bottom);
    path.close();
    return path;
  });

  const dotX = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    if (w === 0) return -100;
    return w - DEFAULT_PADDING.right;
  });

  const dotY = useDerivedValue(() => {
    const h = engine.canvasHeight.value;
    if (h === 0) return -100;
    const chartH = h - DEFAULT_PADDING.top - DEFAULT_PADDING.bottom;
    const dMin = engine.displayMin.value;
    const dMax = engine.displayMax.value;
    const valRange = dMax - dMin;
    if (valRange === 0) return DEFAULT_PADDING.top + chartH / 2;
    return (
      DEFAULT_PADDING.top +
      ((dMax - engine.displayValue.value) / valRange) * chartH
    );
  });

  // ─── Render ────────────────────────────────────────────────────────

  const bgColor = `rgb(${palette.bgRgb[0]}, ${palette.bgRgb[1]}, ${palette.bgRgb[2]})`;
  const gradientEnd = Math.max(1, layoutHeight - DEFAULT_PADDING.bottom);

  return (
    <View
      style={[{ flex: 1, backgroundColor: bgColor }, style]}
      onLayout={onLayout}
    >
      <Canvas style={{ flex: 1 }}>
        {fill && (
          <Path path={fillPath} style="fill">
            <LinearGradient
              start={vec(0, DEFAULT_PADDING.top)}
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
