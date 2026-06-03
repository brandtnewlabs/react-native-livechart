/**
 * Multi-series live chart. Same conceptual role as liveline’s multi-series mode;
 * React Native + Skia implementation (see liveline for the web reference).
 *
 * @see https://github.com/benjitaylor/liveline
 */
import { Canvas, Group } from "@shopify/react-native-skia";
import { useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { DEFAULT_ACCENT_COLOR, MAX_MULTI_SERIES } from "../constants";
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
import { resolveChartLayout } from "../hooks/resolveChartLayout";
import { useCanvasLayout } from "../hooks/useCanvasLayout";
import { useChartReveal } from "../hooks/useChartReveal";
import { useChartSkiaFont } from "../hooks/useChartSkiaFont";
import { useCrosshairSeries } from "../hooks/useCrosshairSeries";
import { useMarkers } from "../hooks/useMarkers";
import { useMultiSeriesDegen } from "../hooks/useMultiSeriesDegen";
import { useMultiSeriesLinePaths } from "../hooks/useMultiSeriesLinePaths";
import { useMultiSeriesReverseMorphInputs } from "../hooks/useReverseMorphEngineInputs";
import { useXAxis } from "../hooks/useXAxis";
import { useYAxis } from "../hooks/useYAxis";
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

/**
 * Resolves props → configs → theme/layout → engine → per-frame derived values,
 * overlay hooks and the color/style reaction state, returning a single render
 * model so `SeriesChartStack` and `LiveChartSeries` stay small and presentational.
 */
function useLiveChartSeriesController({
  series,
  theme = "dark",
  accentColor = DEFAULT_ACCENT_COLOR,
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
  referenceLines,
  gridStyle,
  palette: paletteOverride,
  scrub = false,
  onScrub,
  onSeriesToggle,
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
  const legendCfg = resolveLegend(legendProp);
  const degenCfg = resolveDegen(degen);

  const allRefLines = referenceLines ?? [];
  const refValues = collectReferenceValues(allRefLines);

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

  const [initialMorphT] = useState<number>(() => {
    const anyReady = series.value.some((s) => s.data.length >= 2);
    return loading ? 0 : anyReady ? 1 : 0;
  });

  const reveal = useChartReveal(loading, hasData, initialMorphT);

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

  // Seed from the current series at mount; the reaction below keeps it in sync.
  const [lineColors, setLineColors] = useState<string[]>(() =>
    resolveMultiSeriesLineColorsSnapshot(series.value),
  );

  // Read the `series` prop from closure, not a SharedValue passed through
  // `scheduleOnRN`: the handle serialized across the worklet→JS boundary keeps
  // the native `.value` accessor but loses the `.get()` method (`.get()` on it
  // throws). Reading the prop directly is robust to either accessor.
  const syncColors = () => {
    setLineColors(resolveMultiSeriesLineColorsSnapshot(series.value));
  };

  useAnimatedReaction(
    () => lineColorsSig(series),
    /* istanbul ignore next -- scheduleOnRN from UI-thread reaction */
    (sig, prev) => {
      if (sig !== prev) scheduleOnRN(syncColors);
    },
    [series, syncColors],
  );

  // Per-series stroke style (dash / width / glow) — synced to React state when
  // the style signature changes (not on every data tick), like the colors above.
  const [lineStyles, setLineStyles] = useState<SeriesLineStyle[]>(() =>
    resolveMultiSeriesLineStylesSnapshot(series.value),
  );

  const syncStyles = () => {
    setLineStyles(resolveMultiSeriesLineStylesSnapshot(series.value));
  };

  useAnimatedReaction(
    () => lineStyleSignatureFromArray(series.value),
    /* istanbul ignore next -- scheduleOnRN from UI-thread reaction */
    (sig, prev) => {
      if (sig !== prev) scheduleOnRN(syncStyles);
    },
    [series, syncStyles],
  );

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

  return {
    // passthrough props the render needs
    series,
    style,
    accessibilityLabel,
    accessibilityRole,
    emptyText,
    formatValue,
    onSeriesToggle,
    // configs
    yAxisCfg,
    xAxisCfg,
    scrubCfg,
    gridStyleCfg,
    dotCfg,
    legendCfg,
    degenCfg,
    allRefLines,
    leftEdgeFadeCfg,
    // theme / layout / fonts
    palette,
    skiaFont,
    seriesLabelInset,
    strokeWidth,
    effectivePadding,
    backgroundColor,
    // engine + reveal
    engine,
    reveal,
    effectiveSeries,
    layoutHeight,
    onLayout,
    linePaths,
    lineColors,
    lineStyles,
    degenPack,
    degenPackRevision,
    degenShakeTransform,
    yAxisEntries,
    xAxisEntries,
    crosshair,
    rootGesture,
    markersActive,
    markersSV,
  };
}

type LiveChartSeriesModel = ReturnType<typeof useLiveChartSeriesController>;

/** The shaken multi-series stack: grid, reference/value lines, per-series strokes,
 *  axis, dots, value labels, degen, markers, and the loading/empty art. */
function SeriesChartStack({ model }: { model: LiveChartSeriesModel }) {
  const {
    degenShakeTransform,
    yAxisCfg,
    reveal,
    yAxisEntries,
    engine,
    effectivePadding,
    palette,
    skiaFont,
    seriesLabelInset,
    gridStyleCfg,
    allRefLines,
    formatValue,
    dotCfg,
    lineColors,
    linePaths,
    effectiveSeries,
    strokeWidth,
    lineStyles,
    xAxisCfg,
    xAxisEntries,
    degenCfg,
    degenPack,
    degenPackRevision,
    markersActive,
    markersSV,
    series,
    emptyText,
  } = model;

  return (
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

      {allRefLines.map((rl) => (
        <ReferenceLineOverlay
          key={`${rl.value ?? ""}:${rl.valueFrom ?? ""}:${rl.valueTo ?? ""}:${rl.from ?? ""}:${rl.to ?? ""}:${rl.label ?? ""}`}
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
  );
}

export function LiveChartSeries(props: LiveChartSeriesProps) {
  const model = useLiveChartSeriesController(props);
  const {
    rootGesture,
    backgroundColor,
    style,
    onLayout,
    accessibilityLabel,
    accessibilityRole,
    layoutHeight,
    legendCfg,
    series,
    onSeriesToggle,
    leftEdgeFadeCfg,
    effectivePadding,
    engine,
    scrubCfg,
    crosshair,
    palette,
  } = model;

  const legend =
    legendCfg.position === "top" || legendCfg.position === "bottom" ? (
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
        {legendCfg.position === "top" ? legend : null}
        <Canvas style={{ flex: 1, minHeight: layoutHeight || 1 }}>
          <SeriesChartStack model={model} />

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
        {legendCfg.position === "bottom" ? legend : null}
      </View>
    </GestureDetector>
  );
}
