/**
 * Multi-series live chart. Same conceptual role as liveline’s multi-series mode;
 * React Native + Skia implementation (see liveline for the web reference).
 *
 * @see https://github.com/benjitaylor/liveline
 */
import { Canvas, Group } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { MAX_MULTI_SERIES } from "../constants";
import {
  lineColorsSignatureFromArray,
  lineStyleSignatureFromArray,
  resolveMultiSeriesLineColorsSnapshot,
  resolveMultiSeriesLineStylesSnapshot,
  type SeriesLineStyle,
} from "../core/multiSeriesLayout";
import {
  resolveDegen,
  resolveGridStyle,
  resolveLeftEdgeFade,
  resolveLegend,
  resolveMultiSeriesDot,
  resolveScrub,
  resolveXAxis,
  resolveYAxis,
} from "../core/resolveConfig";
import { useLiveChartSeriesEngine } from "../core/useLiveChartSeriesEngine";
import {
  resolveChartLayout,
  useCanvasLayout,
  useChartReveal,
  useChartSkiaFont,
  useCrosshairSeries,
  useMarkers,
  useMultiSeriesDegen,
  useMultiSeriesLinePaths,
  useMultiSeriesReverseMorphInputs,
  useXAxis,
  useYAxis,
} from "../hooks";
import {
  formatTime as defaultFormatTime,
  formatValue as defaultFormatValue,
} from "../lib/format";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import { MONO_FONT_FAMILY } from "../lib/monoFontFamily";
import { collectReferenceValues } from "../math/referenceLines";
import {
  applyPaletteOverride,
  leftEdgeFadeColorsFromBgRgb,
  resolveTheme,
} from "../theme";
import type { LiveChartSeriesProps, Marker, SeriesConfig } from "../types";
import { CrosshairLine } from "./CrosshairLine";
import { DegenParticlesOverlay } from "./DegenParticlesOverlay";
import { LeftEdgeFade } from "./LeftEdgeFade";
import { MarkerOverlay } from "./MarkerOverlay";
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
  nonNegative = false,
  maxValue,
  windowBuffer = 0,
  nowOverride,
  accessibilityLabel,
  accessibilityRole = "image",
  emptyText = "No data",
  formatValue = defaultFormatValue,
  formatTime = defaultFormatTime,
  yAxis = true,
  xAxis = true,
  referenceLine,
  referenceLines,
  gridStyle,
  palette: paletteOverride,
  scrub = false,
  onScrub,
  onSeriesToggle,
  seriesToggleCompact,
  dot: dotProp,
  legend: legendProp,
  degen,
  onDegenShake,
  markers,
  onMarkerHover,
  markerHitRadius = 16,
  leftEdgeFade = true,
}: LiveChartSeriesProps) {
  const emptyMarkers = useSharedValue<Marker[]>([]);
  const markersSV = markers ?? emptyMarkers;
  const markersActive = markers != null;
  const yAxisCfg = resolveYAxis(yAxis);
  const xAxisCfg = resolveXAxis(xAxis);
  const scrubCfg = resolveScrub(scrub);
  const scrubEnabled = scrubCfg !== null;
  const gridStyleCfg = resolveGridStyle(gridStyle);
  const dotCfg = resolveMultiSeriesDot(dotProp);
  const legendCfg = resolveLegend(legendProp, seriesToggleCompact);
  const degenCfg = resolveDegen(degen);

  const allRefLines = useMemo(
    () => [
      ...(referenceLine ? [referenceLine] : []),
      ...(referenceLines ?? []),
    ],
    [referenceLine, referenceLines],
  );
  const refValues = useMemo(
    () => collectReferenceValues(allRefLines),
    [allRefLines],
  );

  const palette = applyPaletteOverride(
    resolveTheme(accentColor, theme),
    paletteOverride,
  );

  const leftEdgeFadeCfg = resolveLeftEdgeFade(
    leftEdgeFade,
    leftEdgeFadeColorsFromBgRgb(palette.bgRgb),
  );

  const skiaFont = useChartSkiaFont(
    fontProp,
    MONO_FONT_FAMILY,
    palette.labelFontSize,
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
    referenceValues: refValues,
    nonNegative,
    maxValue,
    windowBuffer,
    nowOverride,
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

  // Per-series stroke style (dash / width / glow) — synced to React state when
  // the style signature changes (not on every data tick), like the colors above.
  const [lineStyles, setLineStyles] = useState<SeriesLineStyle[]>(() =>
    resolveMultiSeriesLineStylesSnapshot([]),
  );

  const syncStyles = useCallback((sv: SharedValue<SeriesConfig[]>) => {
    setLineStyles(resolveMultiSeriesLineStylesSnapshot(sv.value));
  }, []);

  useAnimatedReaction(
    () => lineStyleSignatureFromArray(series.value),
    /* istanbul ignore next -- scheduleOnRN from UI-thread reaction */
    (sig, prev) => {
      if (sig !== prev) scheduleOnRN(syncStyles, series);
    },
    [series, syncStyles],
  );

  useEffect(() => {
    syncStyles(series);
  }, [series, syncStyles]);

  const {
    pack: degenPack,
    packRevision: degenPackRevision,
    shakeTransform: degenShakeTransform,
  } = useMultiSeriesDegen(engine, effectivePadding, degenCfg, onDegenShake);

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

  // `projected` is used internally by the hit-test gesture; the overlay
  // self-projects, so we only need the gesture here.
  const { tapGesture: markerTapGesture } = useMarkers(
    engine,
    effectivePadding,
    markersSV,
    markersActive,
    markerHitRadius,
    onMarkerHover,
    series,
  );

  const rootGesture = markersActive
    ? Gesture.Race(crosshair.gesture, markerTapGesture)
    : crosshair.gesture;

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
    <GestureDetector gesture={rootGesture}>
      <View
        style={[{ flex: 1, backgroundColor }, style]}
        onLayout={onLayout}
        accessible={accessibilityLabel != null}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
      >
        {legendTop}
        <Canvas style={{ flex: 1, minHeight: layoutHeight || 1 }}>
          <Group transform={degenShakeTransform}>
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
                gridStyle={gridStyleCfg}
              />
            </Group>
          )}

          {allRefLines.map((rl, i) => (
            <ReferenceLineOverlay
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              engine={engine}
              padding={effectivePadding}
              line={rl}
              palette={palette}
              formatValue={formatValue}
              font={skiaFont}
            />
          ))}

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
                lineStyle={lineStyles[i]}
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

          {degenCfg && (
            <Group opacity={reveal.dotOpacity}>
              <DegenParticlesOverlay
                pack={degenPack}
                packRevision={degenPackRevision}
                engine={engine}
                palette={palette}
                particleSlotCount={degenCfg.particleSlotCount}
                particleBurstDurationSec={degenCfg.particleBurstDurationSec}
                particleOpacity={degenCfg.particleOpacity}
                colors={degenCfg.colors ?? lineColors}
              />
            </Group>
          )}

          {markersActive && (
            <Group opacity={reveal.dotOpacity}>
              <MarkerOverlay
                markers={markersSV}
                engine={engine}
                padding={effectivePadding}
                palette={palette}
                font={skiaFont}
                series={series}
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
          </Group>

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
