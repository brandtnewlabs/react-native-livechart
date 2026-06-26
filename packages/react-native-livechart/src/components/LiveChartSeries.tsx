/**
 * Multi-series live chart. Same conceptual role as liveline’s multi-series mode;
 * React Native + Skia implementation (see liveline for the web reference).
 *
 * @see https://github.com/benjitaylor/liveline
 */
import { Canvas, Group } from "@shopify/react-native-skia";
import { useLayoutEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
  DEFAULT_ACCENT_COLOR,
  HOLD_TO_SCRUB_MS,
  MAX_MULTI_SERIES,
  SCRUB_OVERLAY_FADE_MS,
} from "../constants";
import {
  lineColorsSignatureFromArray,
  lineStyleSignatureFromArray,
  resolveMultiSeriesLineColorsSnapshot,
  resolveMultiSeriesLineStylesSnapshot,
  type SeriesLineStyle,
} from "../core/multiSeriesLayout";
import {
  resolveAxisLabel,
  resolveDegen,
  resolveGridStyle,
  resolveLeftEdgeFade,
  resolveLegend,
  resolveLoading,
  resolveMarkerCluster,
  resolveMetrics,
  resolveMultiSeriesDot,
  resolveReturnToLiveMs,
  resolveScrub,
  resolveSelectionDot,
  resolveTransitions,
  resolveXAxis,
  resolveYAxis,
  resolveZoom,
} from "../core/resolveConfig";
import { useLiveChartSeriesEngine } from "../core/useLiveChartSeriesEngine";
import { pulseRadialOutset } from "../draw/line";
import { resolveChartLayout } from "../hooks/resolveChartLayout";
import { useCanvasLayout } from "../hooks/useCanvasLayout";
import { useChartReveal } from "../hooks/useChartReveal";
import { useChartSkiaFont } from "../hooks/useChartSkiaFont";
import { useCrosshairSeries } from "../hooks/useCrosshairSeries";
import { useMarkers } from "../hooks/useMarkers";
import { useMultiSeriesDegen } from "../hooks/useMultiSeriesDegen";
import { useMultiSeriesLinePaths } from "../hooks/useMultiSeriesLinePaths";
import { usePanScroll } from "../hooks/usePanScroll";
import { usePinchZoom } from "../hooks/usePinchZoom";
import { useMultiSeriesReverseMorphInputs } from "../hooks/useReverseMorphEngineInputs";
import { useVisibleRange } from "../hooks/useVisibleRange";
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
import { AxisLabelOverlay } from "./AxisLabelOverlay";
import {
  ExtremaConnectorOverlay,
  labelConnector,
} from "./ExtremaConnectorOverlay";
import { CustomMarkerOverlay } from "./CustomMarkerOverlay";
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

/**
 * Signature of the per-series *config* (colors, stroke styles, labels, count) —
 * everything the snapshot below feeds into layout and rendering. Excludes the
 * per-tick `data`, so the snapshot only refreshes on real config changes.
 */
function seriesConfigSig(s: SharedValue<SeriesConfig[]>) {
  "worklet";
  const arr = s.value;
  let out =
    lineColorsSignatureFromArray(arr) +
    "\x1d" +
    lineStyleSignatureFromArray(arr);
  for (let i = 0; i < arr.length; i++) {
    out += "\x1d" + (arr[i].label ?? arr[i].id);
  }
  return out;
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
  transitions,
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
  topLabel,
  bottomLabel,
  referenceLines,
  gridStyle,
  palette: paletteOverride,
  metrics,
  scrub = true,
  selectionDot,
  timeScroll = false,
  returnToLive,
  zoom = false,
  onScrub,
  onGestureStart,
  onGestureEnd,
  onVisibleRangeChange,
  onReachStart,
  onSeriesToggle,
  dot: dotProp,
  legend: legendProp,
  degen,
  onDegenShake,
  markers,
  onMarkerPress,
  markerHitRadius = 16,
  markerCluster,
  renderMarker,
  leftEdgeFade = true,
}: LiveChartSeriesProps) {
  const emptyMarkers = useSharedValue<Marker[]>([]);
  const markersSV = markers ?? emptyMarkers;
  const markerClusterCfg = resolveMarkerCluster(markerCluster);
  const markersActive = markers != null;
  const yAxisCfg = resolveYAxis(yAxis);
  const xAxisCfg = resolveXAxis(xAxis);
  const topLabelCfg = resolveAxisLabel(topLabel);
  const bottomLabelCfg = resolveAxisLabel(bottomLabel);
  const scrubCfg = resolveScrub(scrub);
  const scrubEnabled = scrubCfg !== null;

  // Time-scroll + pinch-zoom (mirrors LiveChart). LiveChartSeries has no static
  // mode, so these gate on the props alone. `holdToScrub` requires the scrub
  // gesture to wait for a press-and-hold so a quick drag scrolls instead — the
  // hold delay is threaded into `useCrosshairSeries` below.
  const timeScrollEnabled = Boolean(timeScroll);
  // Return-to-live glide duration (0 = instant); sibling of `timeScroll` so it
  // survives `timeScroll={false}` (the disable that triggers it). See #164.
  const returnToLiveMs = resolveReturnToLiveMs(returnToLive);
  const zoomCfg = resolveZoom(zoom);
  const zoomEnabled = zoomCfg !== null;
  const scrollGestureMode =
    typeof timeScroll === "object"
      ? (timeScroll.gesture ?? "holdToScrub")
      : "holdToScrub";
  const timeScrollHoldMs =
    typeof timeScroll === "object" ? timeScroll.scrubHoldMs : undefined;
  // Precedence: explicit scrubHoldMs, then scrub.panGestureDelay, then default.
  // `||` (not `??`) skips the resolved panGestureDelay's 0 default.
  const scrubHoldMs =
    timeScrollEnabled && scrollGestureMode === "holdToScrub"
      ? (timeScrollHoldMs ?? (scrubCfg?.panGestureDelay || HOLD_TO_SCRUB_MS))
      : (scrubCfg?.panGestureDelay ?? 0);

  const selectionDotCfg = resolveSelectionDot(selectionDot);
  const gridStyleCfg = resolveGridStyle(gridStyle);
  const dotCfg = resolveMultiSeriesDot(dotProp);
  // Outer footprint of a dot (the color-filled radius plus the halo ring).
  // Used to keep the gutter labels clear of the haloed dot.
  const dotOuterRadius = dotCfg.radius + (dotCfg.ring?.width ?? 0);
  const legendCfg = resolveLegend(legendProp);
  const degenCfg = resolveDegen(degen);
  const metricsCfg = resolveMetrics(metrics);

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

  // Snapshot of the series config (colors, styles, labels) for layout + line
  // rendering. Seeded off the render path below and refreshed by the reaction
  // further down — reading the `series` SharedValue during render trips
  // Reanimated's strict-mode warning. React flushes layout-effect state before
  // paint, so the seed causes no flash.
  const [seriesSnapshot, setSeriesSnapshot] = useState<SeriesConfig[]>([]);
  // react-doctor-disable-next-line react-doctor/no-derived-state-effect -- Reanimated: series must be read off the render path
  useLayoutEffect(() => {
    // `.get()` (not `.value`): React Compiler hoists the `.value` getter read into
    // render scope for memoization, which trips Reanimated's strict-mode warning;
    // it leaves the `.get()` method call inside the effect.
    // react-doctor-disable-next-line react-hooks-js/set-state-in-effect -- Reanimated: seeding from a SharedValue off render is the warning-free path
    setSeriesSnapshot(series.get().slice());
  }, [series]);

  const maxSeriesLabelWidth = dotCfg.valueLabel
    ? Math.max(
        0,
        ...seriesSnapshot.map((s) =>
          measureFontTextWidth(skiaFont, s.label ?? s.id),
        ),
      )
    : 0;

  const seriesLabelInset = dotCfg.valueLabel
    ? dotOuterRadius + 8 + maxSeriesLabelWidth + 8
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
    badgeMetrics: metricsCfg.badge,
    xAxis: xAxisCfg !== null,
    font: skiaFont,
    formatValue,
    currentValue: representativeValue,
    pulse: dotCfg.pulse,
    multiSeriesDotRadius: dotOuterRadius,
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

  // Resolve the loading shell: null = not loading, else the styled config.
  const loadingCfg = resolveLoading(loading);
  const loadingActive = loadingCfg !== null;
  // Multi-series is always lines, so only the reveal transition applies (no
  // candle↔line crossfade); `transitions.mode` is accepted but inert here.
  const transitionsCfg = resolveTransitions(transitions);
  const reveal = useChartReveal(
    loadingActive,
    hasData,
    false,
    transitionsCfg.reveal,
  );

  const effectiveSeries = useMultiSeriesReverseMorphInputs({
    series,
    hasData,
    morphT: reveal.morphT,
  });

  const engine = useLiveChartSeriesEngine({
    series: effectiveSeries,
    timeWindow,
    paused,
    scrollEnabled: timeScrollEnabled,
    returnToLiveMs,
    smoothing,
    adaptiveSpeedBoost: metricsCfg.motion.adaptiveSpeedBoost,
    exaggerate,
    referenceValues: refValues,
    nonNegative,
    maxValue,
    windowBuffer,
    nowOverride,
  });
  const { layoutHeight, onLayout } = useCanvasLayout(engine);
  const linePaths = useMultiSeriesLinePaths(engine, effectivePadding);

  // Per-series colors and stroke styles, derived from the off-render snapshot
  // (React state — so no Reanimated read-during-render). The reaction below
  // refreshes the snapshot when the series config signature changes. Plain
  // derivations — React Compiler memoizes them, so no manual useMemo.
  const lineColors = resolveMultiSeriesLineColorsSnapshot(seriesSnapshot);
  const lineStyles = resolveMultiSeriesLineStylesSnapshot(seriesSnapshot);

  // Read the `series` prop from closure, not a SharedValue passed through
  // `scheduleOnRN`: the handle serialized across the worklet→JS boundary keeps
  // the native `.value` accessor but loses the `.get()` method (`.get()` on it
  // throws). Reading the prop directly is robust to either accessor.
  const syncSnapshot = () => {
    setSeriesSnapshot(series.get().slice());
  };

  useAnimatedReaction(
    () => seriesConfigSig(series),
    /* istanbul ignore next -- scheduleOnRN from UI-thread reaction */
    (sig, prev) => {
      if (sig !== prev) scheduleOnRN(syncSnapshot);
    },
    [series, syncSnapshot],
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
    metricsCfg.grid,
    yAxisCfg?.count ?? 0,
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
    scrubHoldMs,
    onGestureStart,
    onGestureEnd,
  );

  // `projected` is used internally by the hit-test gesture; the overlay
  // self-projects, so we only need the gesture here.
  const { tapGesture: markerTapGesture } = useMarkers(
    engine,
    effectivePadding,
    markersSV,
    markersActive,
    markerHitRadius,
    onMarkerPress,
    series,
    undefined, // lineData — multi-series anchors by seriesId
    true, // autostart
    false, // lineLinear — per-series curve handled in projection
    markerClusterCfg,
  );

  // Earliest retained time across all series — clamps how far the window pans
  // back, and the `onReachStart` reference. Falls back to the live edge (no
  // scrollable history) so panning is a no-op.
  const scrollMinTime = useDerivedValue(() => {
    const s = engine.series.get();
    let min = Infinity;
    for (let i = 0; i < s.length; i++) {
      const d = s[i].data;
      if (d.length > 0 && d[0].time < min) min = d[0].time;
    }
    return min === Infinity ? engine.liveEdge.get() : min;
  });

  const panScrollGesture = usePanScroll({
    engine,
    padding: effectivePadding,
    minTime: scrollMinTime,
    enabled: timeScrollEnabled,
    mode: scrollGestureMode,
    onScrollStart: () => {
      "worklet";
      crosshair.scrubActive.set(false);
    },
  });

  const pinchZoomGesture = usePinchZoom({
    engine,
    padding: effectivePadding,
    minTime: scrollMinTime,
    timeWindow,
    enabled: zoomEnabled,
    minTimeWindow: zoomCfg?.minTimeWindow,
    maxTimeWindow: zoomCfg?.maxTimeWindow,
    onZoomStart: () => {
      "worklet";
      crosshair.scrubActive.set(false);
    },
  });

  useVisibleRange({
    engine,
    minTime: scrollMinTime,
    onVisibleRangeChange,
    onReachStart,
  });

  let rootGesture = markersActive
    ? Gesture.Race(crosshair.gesture, markerTapGesture)
    : crosshair.gesture;

  // holdToScrub races the scrub (quick drag scrolls; press-hold scrubs);
  // axisDrag goes first via Exclusive (fails fast outside the bottom band).
  if (timeScrollEnabled) {
    rootGesture =
      scrollGestureMode === "axisDrag"
        ? Gesture.Exclusive(panScrollGesture, rootGesture)
        : Gesture.Race(panScrollGesture, rootGesture);
  }
  // Pinch runs alongside (two-finger, disjoint from the one-finger gestures).
  if (zoomEnabled) {
    rootGesture = Gesture.Simultaneous(rootGesture, pinchZoomGesture);
  }

  const backgroundColor = `rgb(${palette.bgRgb[0]}, ${palette.bgRgb[1]}, ${palette.bgRgb[2]})`;

  // Fade markers + reference lines out while scrubbing when
  // `scrub.hideOverlaysOnScrub` is set. Eased off the scrub-ACTIVE flag (not the
  // crosshair edge fade, which would resurface them near the live dot); only a
  // group opacity animates — the overlay draws stay intact. See `LiveChart`.
  const fadeOverlaysOnScrub =
    scrubCfg !== null && scrubCfg.hideOverlaysOnScrub === true;
  const overlayScrubFade = useDerivedValue(() =>
    fadeOverlaysOnScrub
      ? withTiming(crosshair.scrubActive.get() ? 0 : 1, {
          duration: SCRUB_OVERLAY_FADE_MS,
        })
      : 1,
  );
  const markerGroupOpacity = useDerivedValue(
    () => reveal.dotOpacity.get() * overlayScrubFade.get(),
  );

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
    dotOuterRadius,
    legendCfg,
    degenCfg,
    metricsCfg,
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
    // loading shell styling (null → not loading)
    loadingLineColor: loadingCfg?.color,
    loadingStrokeWidth: loadingCfg?.strokeWidth,
    loadingAmplitude: loadingCfg?.amplitude,
    loadingSpeed: loadingCfg?.speed,
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
    markerClusterCfg,
    markerGroupOpacity,
    overlayScrubFade,
    renderMarker,
    // selection dot: resolved config + fallback color (the leading series' color)
    selectionDot: selectionDotCfg,
    selectionColor: lineColors[0],
    // RN axis edge labels (floated over the canvas as a sibling layer)
    topLabelCfg,
    bottomLabelCfg,
    // Skia connector lines for "extrema-edge" labels (dot → edge readout).
    topConnector: labelConnector(topLabelCfg, palette.gridLabel),
    bottomConnector: labelConnector(bottomLabelCfg, palette.gridLabel),
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
    markerClusterCfg,
    markerGroupOpacity,
    overlayScrubFade,
    renderMarker,
    series,
    emptyText,
    metricsCfg,
    loadingLineColor,
    loadingStrokeWidth,
    loadingAmplitude,
    loadingSpeed,
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

      {/* Index keys: reference lines are a positional array and two may share
          value + label (e.g. duplicate working orders at the same price), which a
          content-derived key would collapse to one. Fade group lets
          `scrub.hideOverlaysOnScrub` ease the lines out while scrubbing. */}
      <Group opacity={overlayScrubFade}>
        {allRefLines.map((rl, i) => (
          <ReferenceLineOverlay
            key={i}
            engine={engine}
            padding={effectivePadding}
            line={rl}
            palette={palette}
            formatValue={formatValue}
            font={skiaFont}
          />
        ))}
      </Group>

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

      {dotCfg.show && (
        <Group opacity={reveal.dotOpacity}>
          <MultiSeriesDots
            engine={engine}
            padding={effectivePadding}
            colors={lineColors}
            radius={dotCfg.radius}
            ring={dotCfg.ring}
            ringColor={palette.badgeOuterBg}
            color={dotCfg.color}
            pulse={dotCfg.pulse}
            viewEnd={engine.viewEnd}
          />
        </Group>
      )}

      {/* Value labels are drawn later (after the crosshair layer) so the scrub
          dim — which now covers the dots + pulse rings — never clips them.
          They track each series' live value, not the scrub point. */}

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
        <Group opacity={markerGroupOpacity}>
          <MarkerOverlay
            markers={markersSV}
            engine={engine}
            padding={effectivePadding}
            palette={palette}
            font={skiaFont}
            series={series}
            renderMarker={renderMarker}
            cluster={markerClusterCfg}
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
        emptyMetrics={metricsCfg.emptyState}
        lineColor={loadingLineColor}
        lineStrokeWidth={loadingStrokeWidth}
        waveAmplitude={loadingAmplitude}
        waveSpeed={loadingSpeed}
      />
    </Group>
  );
}

/** Per-series live-value labels, drawn above the scrub dim so the dim (which
 *  covers the dots + pulse rings) never clips them. Keeps the degen shake
 *  transform so they track the shaken stack. */
function SeriesValueLabelLayer({ model }: { model: LiveChartSeriesModel }) {
  const {
    dotCfg,
    dotOuterRadius,
    engine,
    effectivePadding,
    lineColors,
    skiaFont,
    reveal,
    degenShakeTransform,
  } = model;
  if (!dotCfg.valueLabel) return null;
  return (
    <Group transform={degenShakeTransform}>
      <Group opacity={reveal.dotOpacity}>
        <MultiSeriesValueLabels
          engine={engine}
          padding={effectivePadding}
          colors={lineColors}
          font={skiaFont}
          dotRadius={dotOuterRadius}
        />
      </Group>
    </Group>
  );
}

/** Reference-line badges + labels, drawn ABOVE the left-edge fade so they stay
 *  crisp (the lines/bands render in the base pass inside SeriesChartStack). */
function SeriesRefBadgeLayer({ model }: { model: LiveChartSeriesModel }) {
  const {
    allRefLines,
    engine,
    effectivePadding,
    palette,
    formatValue,
    skiaFont,
    degenShakeTransform,
    overlayScrubFade,
  } = model;
  if (allRefLines.length === 0) return null;
  return (
    <Group transform={degenShakeTransform} opacity={overlayScrubFade}>
      {allRefLines.map((rl, i) => (
        <ReferenceLineOverlay
          key={i}
          engine={engine}
          padding={effectivePadding}
          line={rl}
          palette={palette}
          formatValue={formatValue}
          font={skiaFont}
          badgeLayer
        />
      ))}
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
    dotCfg,
    dotOuterRadius,
    selectionDot,
    selectionColor,
    formatValue,
    topLabelCfg,
    bottomLabelCfg,
    topConnector,
    bottomConnector,
    markersActive,
    markersSV,
    markerClusterCfg,
    renderMarker,
    overlayScrubFade,
  } = model;

  // Mirror the Skia overlay fade onto the RN custom-marker sibling so
  // `scrub.hideOverlaysOnScrub` hides it with the Skia markers.
  const overlayFadeStyle = useAnimatedStyle(() => ({
    opacity: overlayScrubFade.get(),
  }));

  // Extend the scrub dim past the plot's right edge to fully cover the series
  // dots (with their halo) and pulse rings, all centered on that edge. The
  // gutter reserves room beyond this for the value/Y-axis labels, drawn on top.
  const liveDotExtent = Math.max(
    dotOuterRadius,
    dotCfg.pulse
      ? pulseRadialOutset(dotCfg.pulse.maxRadius, dotCfg.pulse.strokeWidth)
      : 0,
  );

  const legend =
    legendCfg.position === "top" || legendCfg.position === "bottom" ? (
      <SeriesToggleChips
        series={series}
        legend={legendCfg}
        palette={palette}
        onSeriesToggle={onSeriesToggle}
      />
    ) : null;

  return (
    <View
      style={[{ flex: 1, backgroundColor }, style]}
      accessible={accessibilityLabel != null}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
    >
      {legendCfg.position === "top" ? legend : null}
      {/* Gesture + layout wrap ONLY the canvas: the legend chips are Pressables
          that must sit outside the scrub gesture to receive taps, and the engine
          canvas height must measure the canvas alone (excluding the legend row),
          else points map into a taller area and the x-axis draws past the edge. */}
      <GestureDetector gesture={rootGesture}>
        <View style={{ flex: 1 }} onLayout={onLayout}>
          <Canvas style={{ flex: 1, minHeight: layoutHeight || 1 }}>
            <SeriesChartStack model={model} />

            {/* "extrema-edge" connector lines (dot → edge readout). Outside the
                stack's degen-shake group so they track the (unshaken) RN dot. */}
            <ExtremaConnectorOverlay
              engine={engine}
              padding={effectivePadding}
              top={topConnector}
              bottom={bottomConnector}
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

            {/* Reference-line badges + labels above the fade so they stay crisp. */}
            <SeriesRefBadgeLayer model={model} />

            {scrubCfg && (
              <CrosshairLine
                scrubX={crosshair.scrubX}
                crosshairOpacity={crosshair.crosshairOpacity}
                engine={engine}
                padding={effectivePadding}
                palette={palette}
                selectionDot={selectionDot}
                selectionY={crosshair.scrubDotY}
                scrubActive={crosshair.scrubActive}
                selectionColor={selectionColor}
                dimOpacity={scrubCfg.dimOpacity}
                liveDotExtent={liveDotExtent}
                crosshairLineColor={scrubCfg.crosshairLineColor}
                crosshairDash={scrubCfg.crosshairDash}
                crosshairDimColor={scrubCfg.crosshairDimColor}
              />
            )}

            {/* Per-series value labels on top of the scrub dim so the dim never
                clips them (they track each series' live value, not the scrub). */}
            <SeriesValueLabelLayer model={model} />
          </Canvas>

          {/* RN labels floated over the canvas (sibling of <Canvas>, an RN
              view). Inside the canvas wrapper so its top/bottom edges align
              with the plot area, not the legend row. */}
          <AxisLabelOverlay
            topLabel={topLabelCfg}
            bottomLabel={bottomLabelCfg}
            engine={engine}
            formatValue={formatValue}
            defaultColor={palette.gridLabel}
            padding={effectivePadding}
          />

          {/* Custom-rendered markers — RN views floated over the canvas
              (non-Skia), pinned to each marker's live position. Box-none fade
              wrapper so `scrub.hideOverlaysOnScrub` hides them with the Skia
              markers (full-bleed; children keep their own absolute positions). */}
          {markersActive && renderMarker && (
            <Animated.View
              pointerEvents="box-none"
              style={[StyleSheet.absoluteFill, overlayFadeStyle]}
            >
              <CustomMarkerOverlay
                markers={markersSV}
                renderMarker={renderMarker}
                engine={engine}
                padding={effectivePadding}
                series={series}
                cluster={markerClusterCfg}
              />
            </Animated.View>
          )}
        </View>
      </GestureDetector>
      {legendCfg.position === "bottom" ? legend : null}
    </View>
  );
}
