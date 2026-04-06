import { Canvas, Group, matchFont } from "@shopify/react-native-skia";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import {
  useAnimatedReaction,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { CrosshairOverlay } from "./components/CrosshairOverlay";
import { LeftEdgeFade } from "./components/LeftEdgeFade";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { MultiSeriesDots } from "./components/MultiSeriesDots";
import { MultiSeriesStroke } from "./components/MultiSeriesStroke";
import { MultiSeriesTooltipStack } from "./components/MultiSeriesTooltipStack";
import { ReferenceLineOverlay } from "./components/ReferenceLineOverlay";
import { SeriesToggleChips } from "./components/SeriesToggleChips";
import { XAxisOverlay } from "./components/XAxisOverlay";
import { YAxisOverlay } from "./components/YAxisOverlay";
import { MAX_MULTI_SERIES } from "./constants";
import {
  formatTime as defaultFormatTime,
  formatValue as defaultFormatValue,
} from "./format";
import {
  resolveChartLayout,
  useCanvasLayout,
  useChartReveal,
  useCrosshairMulti,
  useMultiSeriesLinePaths,
  useMultiSeriesReverseMorphInputs,
  useReferenceLine,
  useXAxis,
  useYAxis,
} from "./hooks";
import {
  lineColorsSignatureFromArray,
  resolveMultiSeriesLineColorsSnapshot,
} from "./multiSeriesLayout";
import {
  resolveFontConfig,
  resolveLeftEdgeFade,
  resolveReferenceLineConfig,
  resolveScrub,
  resolveXAxis,
  resolveYAxis,
} from "./resolveConfig";
import { MONO_FONT_FAMILY } from "./monoFontFamily";
import { leftEdgeFadeColorsFromBgRgb, resolveTheme } from "./theme";
import type { LiveChartSeriesProps, SeriesConfig } from "./types";
import { useLiveChartSeriesEngine } from "./useLiveChartSeriesEngine";

function lineColorsSig(s: SharedValue<SeriesConfig[]>) {
  "worklet";
  return lineColorsSignatureFromArray(s.value);
}

export function LiveChartSeries({
  series,
  theme = "dark",
  accentColor = "#3b82f6",
  line: lineProp,
  font: fontProp,
  insets,
  style,
  timeWindow = 30,
  paused = false,
  loading = false,
  smoothing = 0.08,
  exaggerate = false,
  emptyText = "No data",
  formatValue = defaultFormatValue,
  formatTime = defaultFormatTime,
  yAxis = true,
  xAxis = true,
  referenceLine,
  scrub = false,
  onScrub,
  onSeriesToggle,
  seriesToggleCompact,
  leftEdgeFade = true,
}: LiveChartSeriesProps) {
  const yAxisCfg = resolveYAxis(yAxis);
  const xAxisCfg = resolveXAxis(xAxis);
  const scrubCfg = resolveScrub(scrub);
  const refLineCfg = resolveReferenceLineConfig(referenceLine);

  const palette = resolveTheme(accentColor, theme);

  const leftEdgeFadeCfg = resolveLeftEdgeFade(
    leftEdgeFade,
    leftEdgeFadeColorsFromBgRgb(palette.bgRgb),
  );

  const skiaFont = matchFont(
    resolveFontConfig(
      fontProp,
      MONO_FONT_FAMILY,
      palette.labelFontSize,
    ),
  );

  const { strokeWidth, padding: effectivePadding } = resolveChartLayout({
    palette,
    lineWidthOverride: lineProp?.width,
    insetsOverride: insets,
    yAxis: yAxisCfg !== null,
    badge: false,
    xAxis: xAxisCfg !== null,
    font: skiaFont,
    formatValue,
    currentValue: 0,
  });

  const hasData = useDerivedValue(() =>
    series.value.some((s) => s.data.length >= 2),
  );

  const morphInitRef = useRef<number | null>(null);
  if (morphInitRef.current === null) {
    const anyReady = series.value.some((s) => s.data.length >= 2);
    morphInitRef.current = loading ? 0 : anyReady ? 1 : 0;
  }

  const reveal = useChartReveal(loading, hasData, morphInitRef.current);

  // Stash last multi-series snapshot while morphT collapses (reverse morph).
  const effectiveSeries = useMultiSeriesReverseMorphInputs({
    series,
    hasData,
    morphT: reveal.morphT,
  });

  // Engine + strokes read effectiveSeries; chips/onSeriesToggle still use prop `series`.
  const engine = useLiveChartSeriesEngine({
    series: effectiveSeries,
    timeWindow,
    paused,
    smoothing,
    exaggerate,
    referenceValue: referenceLine?.value,
  });
  const { layoutHeight, onLayout } = useCanvasLayout(engine);
  const linePaths = useMultiSeriesLinePaths(engine, effectivePadding);

  const [lineColors, setLineColors] = useState<string[]>(() =>
    Array.from({ length: MAX_MULTI_SERIES }, () => "#ffffff"),
  );

  const syncColors = useCallback((sv: SharedValue<SeriesConfig[]>) => {
    setLineColors(resolveMultiSeriesLineColorsSnapshot(sv.value));
  }, []);

  useAnimatedReaction(
    () => lineColorsSig(series),
    /* istanbul ignore next -- scheduleOnRN from UI-thread reaction */
    (sig, prev) => {
      if (sig !== prev) scheduleOnRN(syncColors, series);
    },
    [series, syncColors],
  );

  useEffect(() => {
    syncColors(series);
  }, [series, syncColors]);

  const referenceLineLayout = useReferenceLine(
    engine,
    effectivePadding,
    referenceLine,
    formatValue,
    skiaFont,
  );

  const { yAxisEntries } = useYAxis(
    engine,
    effectivePadding,
    formatValue,
    skiaFont,
    yAxisCfg?.minGap ?? 36,
  );

  const { xAxisEntries } = useXAxis(
    engine,
    effectivePadding,
    formatTime,
    skiaFont,
  );

  const crosshair = useCrosshairMulti(
    engine,
    effectivePadding,
    palette,
    formatValue,
    formatTime,
    skiaFont,
    scrubCfg !== null,
    onScrub,
  );

  const backgroundColor = `rgb(${palette.bgRgb[0]}, ${palette.bgRgb[1]}, ${palette.bgRgb[2]})`;

  return (
    <GestureDetector gesture={crosshair.gesture}>
      <View style={[{ flex: 1, backgroundColor }, style]} onLayout={onLayout}>
        <SeriesToggleChips
          series={series}
          compact={seriesToggleCompact}
          onSeriesToggle={onSeriesToggle}
        />
        <Canvas style={{ flex: 1, minHeight: layoutHeight || 1 }}>
          {yAxisCfg && (
            <Group opacity={reveal.yAxisOpacity}>
              <YAxisOverlay
                entries={yAxisEntries}
                engine={engine}
                padding={effectivePadding}
                palette={palette}
                font={skiaFont}
                badge={false}
              />
            </Group>
          )}

          {refLineCfg && (
            <ReferenceLineOverlay
              layout={referenceLineLayout}
              strokeWidth={refLineCfg.strokeWidth}
              intervals={refLineCfg.intervals}
              color={refLineCfg.color ?? palette.refLine}
              labelColor={palette.refLabel}
              font={skiaFont}
            />
          )}

          <Group opacity={reveal.lineOpacity}>
            {Array.from({ length: MAX_MULTI_SERIES }, (_, i) => (
              <MultiSeriesStroke
                key={i}
                index={i}
                paths={linePaths}
                opacities={engine.seriesOpacities}
                series={effectiveSeries}
                strokeWidth={strokeWidth}
              />
            ))}
          </Group>

          {xAxisCfg && (
            <XAxisOverlay
              entries={xAxisEntries}
              engine={engine}
              padding={effectivePadding}
              palette={palette}
              font={skiaFont}
            />
          )}

          <Group opacity={reveal.dotOpacity}>
            <MultiSeriesDots
              engine={engine}
              padding={effectivePadding}
              colors={lineColors}
            />
          </Group>

          <LoadingOverlay
            engine={engine}
            padding={effectivePadding}
            palette={palette}
            font={skiaFont}
            morphT={reveal.morphT}
            isLoading={reveal.isLoading}
            isEmpty={reveal.isEmpty}
            emptyText={emptyText}
            strokeWidth={strokeWidth}
            badge={false}
          />

          {leftEdgeFadeCfg && (
            <LeftEdgeFade
              paddingLeft={effectivePadding.left}
              fadeWidth={leftEdgeFadeCfg.width}
              startColor={leftEdgeFadeCfg.startColor}
              endColor={leftEdgeFadeCfg.endColor}
              engine={engine}
            />
          )}

          {scrubCfg && (
            <CrosshairOverlay
              scrubX={crosshair.scrubX}
              crosshairOpacity={crosshair.crosshairOpacity}
              tooltipLayout={crosshair.tooltipLayout}
              engine={engine}
              padding={effectivePadding}
              palette={palette}
              font={skiaFont}
              showTooltip={scrubCfg.tooltip}
              tooltipBody={
                <MultiSeriesTooltipStack
                  tooltipLayout={crosshair.tooltipLayout}
                  font={skiaFont}
                  palette={palette}
                />
              }
            />
          )}
        </Canvas>
      </View>
    </GestureDetector>
  );
}
