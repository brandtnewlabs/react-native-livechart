import {
  Canvas,
  LinearGradient,
  Path,
  matchFont,
  vec,
} from "@shopify/react-native-skia";
import { Platform, View } from "react-native";
import {
  formatTime as defaultFormatTime,
  formatValue as defaultFormatValue,
} from "./format";
import {
  resolveChartLayout,
  useBadge,
  useCanvasLayout,
  useChartPaths,
  useCrosshair,
  useGrid,
  useLiveDot,
  useMomentum,
  useTimeAxis,
} from "./hooks";

import { BadgeOverlay } from "./components/BadgeOverlay";
import { CrosshairOverlay } from "./components/CrosshairOverlay";
import { DotOverlay } from "./components/DotOverlay";
import { GestureDetector } from "react-native-gesture-handler";
import { GridOverlay } from "./components/GridOverlay";
import type { LivelineProps } from "./types";
import { TimeAxisOverlay } from "./components/TimeAxisOverlay";
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
  grid = true,
  gridMinGap = 36,
  badge = true,
  badgeVariant = "default",
  badgeTail = true,
  momentum = true,
  pulse = true,
  scrub = false,
  scrubTooltip = true,
  lineWidth: lineWidthProp,
  formatValue = defaultFormatValue,
  formatTime = defaultFormatTime,
  backgroundColor,
  padding,
  onScrub,
  style,
}: LivelineProps) {
  const palette = resolveTheme(color, theme);

  const font = matchFont({
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: palette.labelFontSize,
    fontWeight: "500",
  });

  const { strokeWidth, padding: effectivePadding } = resolveChartLayout({
    palette,
    lineWidthOverride: lineWidthProp,
    paddingOverride: padding,
    grid,
    badge,
    font,
    formatValue,
    currentValue: value.value,
  });

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
  const momentumSV = useMomentum(engine, momentum);
  const { gridEntries } = useGrid(
    engine,
    effectivePadding,
    formatValue,
    font,
    gridMinGap,
  );
  const { timeEntries } = useTimeAxis(
    engine,
    effectivePadding,
    formatTime,
    font,
  );
  const badgeData = useBadge(
    engine,
    effectivePadding,
    palette,
    formatValue,
    font,
    badgeVariant,
    badgeTail,
    momentumSV,
  );

  const crosshair = useCrosshair(
    engine,
    effectivePadding,
    palette,
    formatValue,
    formatTime,
    font,
    scrub,
    onScrub,
  );

  const bgColor =
    backgroundColor ??
    `rgb(${palette.bgRgb[0]}, ${palette.bgRgb[1]}, ${palette.bgRgb[2]})`;
  const gradientEnd = Math.max(1, layoutHeight - effectivePadding.bottom);

  return (
    <GestureDetector gesture={crosshair.gesture}>
      <View
        style={[{ flex: 1, backgroundColor: bgColor }, style]}
        onLayout={onLayout}
      >
        <Canvas style={{ flex: 1 }}>
          {grid && (
            <GridOverlay
              entries={gridEntries}
              engine={engine}
              padding={effectivePadding}
              palette={palette}
              font={font}
              badge={badge}
            />
          )}

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

          <TimeAxisOverlay
            entries={timeEntries}
            engine={engine}
            padding={effectivePadding}
            palette={palette}
            font={font}
          />

          {badge && <BadgeOverlay badge={badgeData} font={font} />}

          <DotOverlay
            dotX={dotX}
            dotY={dotY}
            momentum={momentumSV}
            palette={palette}
            engine={engine}
            pulse={pulse}
          />

          {scrub && (
            <CrosshairOverlay
              scrubX={crosshair.scrubX}
              crosshairOpacity={crosshair.crosshairOpacity}
              tooltipLayout={crosshair.tooltipLayout}
              engine={engine}
              padding={effectivePadding}
              palette={palette}
              font={font}
              showTooltip={scrubTooltip}
            />
          )}
        </Canvas>
      </View>
    </GestureDetector>
  );
}
