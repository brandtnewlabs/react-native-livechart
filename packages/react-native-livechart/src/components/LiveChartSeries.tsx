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
import { MAX_MULTI_SERIES } from "../constants";
import {
  lineColorsSignatureFromArray,
  resolveMultiSeriesLineColorsSnapshot,
} from "../core/multiSeriesLayout";
import {
  resolveFontConfig,
  resolveLeftEdgeFade,
  resolveLegend,
  resolveMultiSeriesDot,
  resolveReferenceLineConfig,
  resolveScrub,
  resolveXAxis,
  resolveYAxis,
} from "../core/resolveConfig";
import { useLiveChartSeriesEngine } from "../core/useLiveChartSeriesEngine";
import {
  resolveChartLayout,
  useCanvasLayout,
  useChartReveal,
  useCrosshairSeries,
  useMultiSeriesLinePaths,
  useMultiSeriesReverseMorphInputs,
  useReferenceLine,
  useXAxis,
  useYAxis,
} from "../hooks";
import {
  formatTime as defaultFormatTime,
  formatValue as defaultFormatValue,
} from "../lib/format";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import { MONO_FONT_FAMILY } from "../lib/monoFontFamily";
import { leftEdgeFadeColorsFromBgRgb, resolveTheme } from "../theme";
import type { LiveChartSeriesProps, SeriesConfig } from "../types";
import { CrosshairLine } from "./CrosshairLine";
import { LeftEdgeFade } from "./LeftEdgeFade";
import { LoadingOverlay } from "./LoadingOverlay";
import { MultiSeriesDots } from "./MultiSeriesDots";
import { MultiSeriesStroke } from "./MultiSeriesStroke";
import { MultiSeriesValueLabels } from "./MultiSeriesValueLabels";
import { MultiSeriesValueLines } from "./MultiSeriesValueLines";
import { ReferenceLineOverlay } from "./ReferenceLineOverlay";
import { SeriesToggleChips } from "./SeriesToggleChips";
import { XAxisOverlay } from "./XAxisOverlay";
import { YAxisOverlay } from "./YAxisOverlay";

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
  dot: dotProp,
  legend: legendProp,
  leftEdgeFade = true,
}: LiveChartSeriesProps) {
  const yAxisCfg = resolveYAxis(yAxis);
  const xAxisCfg = resolveXAxis(xAxis);
  const scrubCfg = resolveScrub(scrub);
  const scrubEnabled = scrubCfg !== null;
  const refLineCfg = resolveReferenceLineConfig(referenceLine);
  const dotCfg = resolveMultiSeriesDot(dotProp);
  const legendCfg = resolveLegend(legendProp, seriesToggleCompact);

  const palette = resolveTheme(accentColor, theme);

  const leftEdgeFadeCfg = resolveLeftEdgeFade(
    leftEdgeFade,
    leftEdgeFadeColorsFromBgRgb(palette.bgRgb),
  );

  const skiaFont = matchFont(
    resolveFontConfig(fontProp, MONO_FONT_FAMILY, palette.labelFontSize),
  );

  const seriesSnapshot = series.value;
  const maxSeriesLabelWidth = dotCfg.valueLabel
    ? Math.max(
        0,
        ...seriesSnapshot.map((s) =>
          measureFontTextWidth(skiaFont, s.label ?? s.id),
        ),
      )
    : 0;

  const seriesLabelInset = dotCfg.valueLabel
    ? dotCfg.radius + 8 + maxSeriesLabelWidth + 8
    : 0;

  const representativeValue =
    seriesSnapshot.length > 0
      ? Math.max(...seriesSnapshot.map((s) => s.value))
      : 0;

  const { strokeWidth, padding: effectivePadding } = resolveChartLayout({
    palette,
    lineWidthOverride: lineProp?.width,
    insetsOverride: insets,
    yAxis: yAxisCfg !== null,
    badge: false,
    xAxis: xAxisCfg !== null,
    font: skiaFont,
    formatValue,
    currentValue: representativeValue,
    pulse: dotCfg.pulse,
    multiSeriesDotRadius: dotCfg.radius,
    multiSeriesValueLabel: dotCfg.valueLabel,
    multiSeriesMaxLabelWidth: maxSeriesLabelWidth,
  });

  const hasData = useDerivedValue(() => {
    "worklet";
    const arr = series.value;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].data.length >= 2) return true;
    }
    return false;
  });

  const morphInitRef = useRef<number | null>(null);
  if (morphInitRef.current === null) {
    const anyReady = series.value.some((s) => s.data.length >= 2);
    morphInitRef.current = loading ? 0 : anyReady ? 1 : 0;
  }

  const reveal = useChartReveal(loading, hasData, morphInitRef.current);

  const effectiveSeries = useMultiSeriesReverseMorphInputs({
    series,
    hasData,
    morphT: reveal.morphT,
  });

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

  const crosshair = useCrosshairSeries(
    engine,
    effectivePadding,
    scrubEnabled,
    onScrub,
  );

  const backgroundColor = `rgb(${palette.bgRgb[0]}, ${palette.bgRgb[1]}, ${palette.bgRgb[2]})`;

  const legendTop =
    legendCfg.position === "top" ? (
      <SeriesToggleChips
        series={series}
        legend={legendCfg}
        onSeriesToggle={onSeriesToggle}
      />
    ) : null;

  const legendBottom =
    legendCfg.position === "bottom" ? (
      <SeriesToggleChips
        series={series}
        legend={legendCfg}
        onSeriesToggle={onSeriesToggle}
      />
    ) : null;

  return (
    <GestureDetector gesture={crosshair.gesture}>
      <View style={[{ flex: 1, backgroundColor }, style]} onLayout={onLayout}>
        {legendTop}
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
                seriesLabelInset={seriesLabelInset}
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

          {dotCfg.valueLine && (
            <Group opacity={reveal.lineOpacity}>
              <MultiSeriesValueLines
                engine={engine}
                padding={effectivePadding}
                colors={lineColors}
                config={dotCfg.valueLine}
              />
            </Group>
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
              radius={dotCfg.radius}
              pulse={dotCfg.pulse}
            />
          </Group>

          {dotCfg.valueLabel && (
            <Group opacity={reveal.dotOpacity}>
              <MultiSeriesValueLabels
                engine={engine}
                padding={effectivePadding}
                colors={lineColors}
                font={skiaFont}
                dotRadius={dotCfg.radius}
              />
            </Group>
          )}

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
            <CrosshairLine
              scrubX={crosshair.scrubX}
              crosshairOpacity={crosshair.crosshairOpacity}
              engine={engine}
              padding={effectivePadding}
              palette={palette}
              crosshairLineColor={scrubCfg.crosshairLineColor}
              crosshairDimColor={scrubCfg.crosshairDimColor}
            />
          )}
        </Canvas>
        {legendBottom}
      </View>
    </GestureDetector>
  );
}
