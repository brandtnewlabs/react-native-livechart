/**
 * Multi-series live chart. Same conceptual role as liveline’s multi-series mode;
 * React Native + Skia implementation (see liveline for the web reference).
 *
 * @see https://github.com/benjitaylor/liveline
 */
import { Canvas, Group, Rect, type SkFont } from "react-native-skia";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
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
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import {
  DEFAULT_ACCENT_COLOR,
  HOLD_TO_SCRUB_MS,
  MAX_MULTI_SERIES,
  SCRUB_OVERLAY_FADE_MS,
} from "../constants";
import { hasMultiSeriesChartData } from "../core/chartDataPresence";
import {
  resolveMultiSeriesLineColorsSnapshot,
  resolveMultiSeriesLineStylesSnapshot,
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
  resolveFling,
  resolveOverscroll,
  resolveReturnToLiveMs,
  resolveScrub,
  resolveSelectionDot,
  resolveTransitions,
  resolveXAxis,
  resolveXAxisGridStyle,
  resolveYAxis,
  resolveZoom,
} from "../core/resolveConfig";
import { useLiveChartSeriesEngine } from "../core/useLiveChartSeriesEngine";
import {
  dotGlowRadialOutset,
  pulseRadialOutset,
  seriesPlotClip,
} from "../draw/line";
import {
  resolveChartLayout,
  shouldMeasureYAxisLabels,
} from "../hooks/resolveChartLayout";
import { useCanvasLayout } from "../hooks/useCanvasLayout";
import { useChartReveal } from "../hooks/useChartReveal";
import { useChartOverlayContext } from "../hooks/useChartOverlayContext";
import { useChartSkiaFont } from "../hooks/useChartSkiaFont";
import { useCrosshairSeries } from "../hooks/useCrosshairSeries";
import { resolveScrubMarkerOptions } from "../hooks/useScrubMarkers";
import { useCrosshairVisibleOpacity } from "../hooks/useCrosshairVisibleOpacity";
import { useLoadingLook } from "../hooks/useLoadingLook";
import { useMarkers } from "../hooks/useMarkers";
import { useMultiSeriesDegen } from "../hooks/useMultiSeriesDegen";
import { useMultiSeriesLinePaths } from "../hooks/useMultiSeriesLinePaths";
import { AXIS_GRAB_MIN_PX, usePanScroll } from "../hooks/usePanScroll";
import { resetPinchZoom, usePinchZoom } from "../hooks/usePinchZoom";
import { useMultiSeriesReverseMorphInputs } from "../hooks/useReverseMorphEngineInputs";
import {
  SERIES_INDICATOR_FADE_MS,
  useSeriesIndicatorOpacity,
} from "../hooks/useSeriesIndicatorOpacity";
import { useVisibleRange } from "../hooks/useVisibleRange";
import { useXAxis } from "../hooks/useXAxis";
import { useYAxisLabelWidth } from "../hooks/useYAxisLabelWidth";
import { useYAxis } from "../hooks/useYAxis";
import {
  useYAxisScaleGesture,
  useYAxisScaleValue,
} from "../hooks/useYAxisScaleGesture";
import {
  formatTime as defaultFormatTime,
  formatValue as defaultFormatValue,
} from "../lib/format";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import { MONO_FONT_FAMILY } from "../lib/monoFontFamily";
import {
  collectReferenceValues,
  referenceLineReactKeys,
} from "../math/referenceLines";
import {
  applyPaletteOverride,
  leftEdgeFadeColorsFromBgRgb,
  resolveTheme,
} from "../theme";
import type {
  LiveChartHandle,
  LiveChartSeriesProps,
  Marker,
  SeriesConfig,
} from "../types";
import { AxisLabelOverlay } from "./AxisLabelOverlay";
import { ChartOverlayLayer } from "./ChartOverlayLayer";
import {
  ExtremaConnectorOverlay,
  labelConnector,
} from "./ExtremaConnectorOverlay";
import { CustomMarkerOverlay } from "./CustomMarkerOverlay";
import {
  CustomReferenceLineOverlay,
  customReferenceLineFlags,
} from "./CustomReferenceLineOverlay";
import { CrosshairLine } from "./CrosshairLine";
import { DegenParticlesOverlay } from "./DegenParticlesOverlay";
import { LeftEdgeFade } from "./LeftEdgeFade";
import { MarkerOverlay } from "./MarkerOverlay";
import { LoadingOverlay } from "./LoadingOverlay";
import { MultiSeriesDots } from "./MultiSeriesDots";
import { MultiSeriesStroke } from "./MultiSeriesStroke";
import { MultiSeriesValueLabels } from "./MultiSeriesValueLabels";
import { MultiSeriesValueLines } from "./MultiSeriesValueLines";
import { PerSeriesTooltipOverlay } from "./PerSeriesTooltipOverlay";
import { ReferenceLineOverlay } from "./ReferenceLineOverlay";
import { SeriesToggleChipsView } from "./SeriesToggleChips";
import { useSeriesPresentation } from "../hooks/useSeriesPresentation";
import { XAxisGridLines, XAxisOverlay } from "./XAxisOverlay";
import { YAxisOverlay } from "./YAxisOverlay";

/**
 * Resolves props → configs → theme/layout → engine → per-frame derived values,
 * overlay hooks and the color/style reaction state, returning a single render
 * model so `SeriesChartStack` and `LiveChartSeries` stay small and presentational.
 */
function resolveLiveChartSeriesInputs({
  series,
  theme = "dark",
  accentColor = DEFAULT_ACCENT_COLOR,
  line: lineProp,
  font: fontProp,
  insets,
  style,
  seriesOpacity,
  canvasMode = "transparent",
  timeWindow = 30,
  paused = false,
  loading = false,
  transitions,
  snapKey,
  smoothing = 0.08,
  rangeAnimation,
  exaggerate = false,
  nonNegative = false,
  maxValue,
  minRange,
  yRangeScale,
  windowBuffer = 0,
  nowOverride,
  presentationTime,
  historyStartTime,
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
  renderOverlay,
  renderReferenceLine,
  renderOffAxisReferenceLine,
  leftEdgeFade = true,
}: LiveChartSeriesProps) {
  const markerClusterCfg = resolveMarkerCluster(markerCluster);
  const markersActive = markers != null;
  const yAxisCfg = resolveYAxis(yAxis);
  const xAxisCfg = resolveXAxis(xAxis);
  const topLabelCfg = resolveAxisLabel(topLabel);
  const bottomLabelCfg = resolveAxisLabel(bottomLabel);
  const scrubCfg = resolveScrub(scrub);
  const scrubEnabled = scrubCfg !== null;
  const seriesTooltipCfg =
    scrubCfg?.tooltip === true ? scrubCfg.seriesTooltip : null;
  const timeScrollEnabled = Boolean(timeScroll);
  const returnToLiveMs = resolveReturnToLiveMs(returnToLive);
  const timeScrollOverscroll = timeScrollEnabled
    ? resolveOverscroll(timeScroll)
    : 0;
  const timeScrollFling = resolveFling(timeScroll);
  const zoomCfg = resolveZoom(zoom);
  const zoomEnabled = zoomCfg !== null;
  const scrollGestureMode =
    typeof timeScroll === "object"
      ? (timeScroll.gesture ?? "holdToScrub")
      : "holdToScrub";
  const timeScrollHoldMs =
    typeof timeScroll === "object" ? timeScroll.scrubHoldMs : undefined;
  const scrubHoldMs =
    timeScrollEnabled && scrollGestureMode === "holdToScrub"
      ? (timeScrollHoldMs ?? (scrubCfg?.panGestureDelay || HOLD_TO_SCRUB_MS))
      : (scrubCfg?.panGestureDelay ?? 0);
  const selectionDotCfg = resolveSelectionDot(selectionDot ?? false);
  const gridStyleCfg = resolveGridStyle(gridStyle);
  const xGridStyleCfg = resolveXAxisGridStyle(
    xAxisCfg?.gridLines ?? null,
    gridStyleCfg,
  );
  const dotCfg = resolveMultiSeriesDot(dotProp);
  const dotOuterRadius = Math.max(
    dotCfg.radius + (dotCfg.ring?.width ?? 0),
    dotCfg.glow ? dotGlowRadialOutset(dotCfg.glow.radius, dotCfg.glow.blur) : 0,
  );
  const legendCfg = resolveLegend(legendProp);
  const degenCfg = resolveDegen(degen);
  const metricsCfg = resolveMetrics(metrics);
  const allRefLines = referenceLines ?? [];
  const refValues = collectReferenceValues(allRefLines);
  const refLineCustom = customReferenceLineFlags(
    allRefLines,
    renderReferenceLine,
  );
  const refLineOffAxisCustom = customReferenceLineFlags(
    allRefLines,
    renderOffAxisReferenceLine,
    "off-axis",
  ).map((custom, index) => custom && !refLineCustom[index]);
  const refLineKeys = referenceLineReactKeys(allRefLines);
  const palette = applyPaletteOverride(
    resolveTheme(accentColor, theme),
    paletteOverride,
  );
  const leftEdgeFadeCfg = resolveLeftEdgeFade(
    leftEdgeFade,
    leftEdgeFadeColorsFromBgRgb(palette.bgRgb),
  );

  return {
    series,
    lineProp,
    fontProp,
    insets,
    style,
    seriesOpacity,
    canvasMode,
    timeWindow,
    paused,
    loading,
    transitions,
    snapKey,
    smoothing,
    rangeAnimation,
    exaggerate,
    nonNegative,
    maxValue,
    minRange,
    yRangeScale,
    windowBuffer,
    nowOverride,
    presentationTime,
    historyStartTime,
    accessibilityLabel,
    accessibilityRole,
    emptyText,
    formatValue,
    formatTime,
    yAxisCfg,
    xAxisCfg,
    topLabelCfg,
    bottomLabelCfg,
    scrubCfg,
    scrubEnabled,
    seriesTooltipCfg,
    timeScrollEnabled,
    returnToLiveMs,
    timeScrollOverscroll,
    timeScrollFling,
    zoomCfg,
    zoomEnabled,
    scrollGestureMode,
    scrubHoldMs,
    selectionDotCfg,
    gridStyleCfg,
    xGridStyleCfg,
    dotCfg,
    dotOuterRadius,
    legendCfg,
    degenCfg,
    metricsCfg,
    allRefLines,
    refValues,
    refLineCustom,
    refLineOffAxisCustom,
    refLineKeys,
    palette,
    leftEdgeFadeCfg,
    onScrub,
    onGestureStart,
    onGestureEnd,
    onVisibleRangeChange,
    onReachStart,
    onSeriesToggle,
    onDegenShake,
    markers,
    onMarkerPress,
    markerHitRadius,
    markerClusterCfg,
    markersActive,
    renderMarker,
    renderOverlay,
    renderReferenceLine,
    renderOffAxisReferenceLine,
  };
}

function resolveSeriesSnapshotLayout(
  snapshot: SeriesConfig[],
  dot: ReturnType<typeof resolveMultiSeriesDot>,
  dotOuterRadius: number,
  font: SkFont,
) {
  const maxLabelWidth = dot.valueLabel
    ? Math.max(
        0,
        ...snapshot.map((item) =>
          measureFontTextWidth(font, item.label ?? item.id),
        ),
      )
    : 0;
  return {
    maxLabelWidth,
    labelInset: dot.valueLabel ? dotOuterRadius + 8 + maxLabelWidth + 8 : 0,
    colors: resolveMultiSeriesLineColorsSnapshot(snapshot),
    styles: resolveMultiSeriesLineStylesSnapshot(snapshot),
  };
}

function composeSeriesRootGesture(
  crosshairGesture: ReturnType<typeof useCrosshairSeries>["gesture"],
  markerTapGesture: ReturnType<typeof useMarkers>["tapGesture"],
  panScrollGesture: ReturnType<typeof usePanScroll>,
  pinchZoomGesture: ReturnType<typeof usePinchZoom>,
  markersActive: boolean,
  timeScrollEnabled: boolean,
  zoomEnabled: boolean,
  scrollGestureMode: "holdToScrub" | "axisDrag",
) {
  let gesture = markersActive
    ? Gesture.Race(crosshairGesture, markerTapGesture)
    : crosshairGesture;
  if (timeScrollEnabled) {
    gesture =
      scrollGestureMode === "axisDrag"
        ? Gesture.Exclusive(panScrollGesture, gesture)
        : Gesture.Race(panScrollGesture, gesture);
  }
  return zoomEnabled
    ? Gesture.Simultaneous(gesture, pinchZoomGesture)
    : gesture;
}

function useLiveChartSeriesController(props: LiveChartSeriesProps) {
  const {
    series,
    lineProp,
    fontProp,
    insets,
    style,
    seriesOpacity,
    canvasMode,
    timeWindow,
    paused,
    loading,
    transitions,
    snapKey,
    smoothing,
    rangeAnimation,
    exaggerate,
    nonNegative,
    maxValue,
    minRange,
    yRangeScale,
    windowBuffer,
    nowOverride,
    presentationTime,
    historyStartTime,
    accessibilityLabel,
    accessibilityRole,
    emptyText,
    formatValue,
    formatTime,
    yAxisCfg,
    xAxisCfg,
    topLabelCfg,
    bottomLabelCfg,
    scrubCfg,
    scrubEnabled,
    seriesTooltipCfg,
    timeScrollEnabled,
    returnToLiveMs,
    timeScrollOverscroll,
    timeScrollFling,
    zoomCfg,
    zoomEnabled,
    scrollGestureMode,
    scrubHoldMs,
    selectionDotCfg,
    gridStyleCfg,
    xGridStyleCfg,
    dotCfg,
    dotOuterRadius,
    legendCfg,
    degenCfg,
    metricsCfg,
    allRefLines,
    refValues,
    refLineCustom,
    refLineOffAxisCustom,
    refLineKeys,
    palette,
    leftEdgeFadeCfg,
    onScrub,
    onGestureStart,
    onGestureEnd,
    onVisibleRangeChange,
    onReachStart,
    onSeriesToggle,
    onDegenShake,
    markers,
    onMarkerPress,
    markerHitRadius,
    markerClusterCfg,
    markersActive,
    renderMarker,
    renderOverlay,
    renderReferenceLine,
    renderOffAxisReferenceLine,
  } = resolveLiveChartSeriesInputs(props);
  const fullSeriesOpacity = useSharedValue(1);
  const resolvedSeriesOpacity = seriesOpacity ?? fullSeriesOpacity;
  const emptyMarkers = useSharedValue<Marker[]>([]);
  const markersSV = markers ?? emptyMarkers;
  // RN custom tags report their measured widths here so the Skia connector can
  // start after the native badge instead of the hidden built-in pill.
  const refLineCustomTagWidths = useSharedValue<number[]>([]);

  const skiaFont = useChartSkiaFont(
    fontProp,
    MONO_FONT_FAMILY,
    palette.labelFontSize,
  );

  const { snapshot: seriesSnapshot, valueLayoutSample, refresh: refreshSeriesPresentation } =
    useSeriesPresentation(series);

  // Mount per-series drawing worklets only for real series. The previous fixed
  // 12-slot render kept 144 derived-value mappers alive for the default stroke,
  // dot, and value-label layers even when a chart contained only one line.
  const activeSeriesCount = Math.min(seriesSnapshot.length, MAX_MULTI_SERIES);

  const {
    maxLabelWidth: maxSeriesLabelWidth,
    labelInset: seriesLabelInset,
    colors: lineColors,
    styles: lineStyles,
  } = resolveSeriesSnapshotLayout(
    seriesSnapshot,
    dotCfg,
    dotOuterRadius,
    skiaFont,
  );

  const [yAxisLabelWidth, setYAxisLabelWidth] = useState<number | undefined>();
  const measureYAxisLabels = shouldMeasureYAxisLabels(yAxisCfg, insets?.right);
  const { strokeWidth, padding: effectivePadding } = resolveChartLayout({
    palette,
    lineWidthOverride: lineProp?.width,
    insetsOverride: insets,
    yAxis: yAxisCfg !== null,
    labelRightMargin: measureYAxisLabels ? yAxisCfg?.labelRightMargin : undefined,
    yAxisLabelWidth,
    dotRadius: dotOuterRadius,
    badge: allRefLines.some(line => typeof line.valueBadge === "object" && line.valueBadge.position === "axis"),
    badgeMetrics: metricsCfg.badge,
    xAxis: xAxisCfg !== null,
    font: skiaFont,
    formatValue,
    currentValue: valueLayoutSample,
    pulse: dotCfg.pulse,
    dotGlow: dotCfg.glow,
    multiSeriesDotRadius: dotOuterRadius,
    multiSeriesValueLabel: dotCfg.valueLabel,
    multiSeriesMaxLabelWidth: maxSeriesLabelWidth,
  });

  const hasData = useDerivedValue(() => {
    "worklet";
    return hasMultiSeriesChartData(series.value);
  });

  // Resolve the loading shell: null = not loading, else the styled config.
  const loadingCfg = resolveLoading(loading);
  const loadingActive = loadingCfg !== null;
  // The shell fades after `loading` turns off: it keeps the last loading
  // config's look instead of the defaults.
  const loadingLook = useLoadingLook(loadingCfg);
  // Multi-series is always lines, so only the reveal transition applies (no
  // candle↔line crossfade); `transitions.mode` is accepted but inert here.
  const transitionsCfg = resolveTransitions(transitions);
  const reveal = useChartReveal(
    loadingActive,
    hasData,
    false,
    transitionsCfg.reveal,
  );
  const seriesIndicatorOpacity = useSeriesIndicatorOpacity(
    resolvedSeriesOpacity,
    transitionsCfg.reveal === 0 ? 0 : SERIES_INDICATOR_FADE_MS,
  );

  const effectiveSeries = useMultiSeriesReverseMorphInputs({
    series,
    hasData,
    morphT: reveal.morphT,
  });

  const effectiveYRangeScale = useYAxisScaleValue(yRangeScale);
  const engine = useLiveChartSeriesEngine({
    series: effectiveSeries,
    timeWindow,
    paused,
    snapKey,
    scrollEnabled: timeScrollEnabled,
    allowFutureViewEnd: timeScrollOverscroll > 0,
    returnToLiveMs,
    smoothing,
    rangeAnimation,
    adaptiveSpeedBoost: metricsCfg.motion.adaptiveSpeedBoost,
    exaggerate,
    referenceValues: refValues,
    nonNegative,
    maxValue,
    minRange,
    yRangeScale: effectiveYRangeScale,
    windowBuffer,
    nowOverride,
    presentationTime,
    historyStartTime,
  });
  const { layoutHeight, onLayout } = useCanvasLayout(engine);
  const linePaths = useMultiSeriesLinePaths(
    engine,
    effectivePadding,
    activeSeriesCount,
    lineProp?.simplify,
  );
  const seriesClip = useDerivedValue(() =>
    seriesPlotClip(
      effectivePadding,
      engine.canvasWidth.get(),
      engine.canvasHeight.get(),
    ),
  );

  // Keep one transform for the drawing stack; the optional particle runtime
  // mounts with its layer instead of allocating 27 SharedValues while off.
  const degenShakeTransform = useSharedValue<[{ translateX: number }, { translateY: number }]>([
    { translateX: 0 }, { translateY: 0 },
  ]);

  const { yAxisEntries } = useYAxis(
    engine,
    effectivePadding,
    formatValue,
    skiaFont,
    yAxisCfg?.minGap ?? 36,
    metricsCfg.grid,
    yAxisCfg?.count ?? 0,
    yAxisCfg?.intervalScale ?? 1,
  );

  useYAxisLabelWidth(yAxisEntries, skiaFont, measureYAxisLabels, setYAxisLabelWidth);

  const { xAxisEntries } = useXAxis(
    engine,
    effectivePadding,
    formatTime,
    skiaFont,
    xAxisCfg?.minGap,
  );

  // Cross-gesture arbitration for the one-finger touch. `Gesture.Race` below is
  // NOT arbitration — RNGH's Race adds no relation between its children, so both
  // pans recognize independently and each can activate while the other already
  // owns the touch. This latch (written by the scroll pan, read by the scrub's
  // long-press guard) makes "the scroll already won" a hard fact; `scrubActive`
  // (written by the crosshair, read by the scroll pan) is the mirror image.
  const scrollActive = useSharedValue(false);
  const axisScaleActive = useSharedValue(false);
  // The tooltip shares the crosshair/path cutoff, including historical edges.
  const tooltipMaxTime = useDerivedValue(
    () => engine.tipTime?.get() ?? engine.currentTime.get(),
  );

  const crosshair = useCrosshairSeries(
    engine,
    effectivePadding,
    scrubEnabled,
    onScrub,
    scrubHoldMs,
    onGestureStart,
    onGestureEnd,
    scrollActive,
    seriesTooltipCfg
      ? {
          config: seriesTooltipCfg,
          formatValue,
          formatTime,
          font: skiaFont,
          colors: lineColors,
          maxTime: tooltipMaxTime,
        }
      : undefined,
    scrubCfg?.clampToPlot ?? false,
    resolveScrubMarkerOptions(scrubCfg, markersSV),
    axisScaleActive,
    timeScrollEnabled && scrollGestureMode === "axisDrag"
      ? Math.max(effectivePadding.bottom, AXIS_GRAB_MIN_PX)
      : 0,
  );

  // Capture only the shared value in the worklets below. Referencing
  // `crosshair.scrubActive` inside a worklet closes over the whole `crosshair`
  // object (which holds a non-serializable `gesture`), throwing
  // "[Worklets] Cannot copy value of type `PanGesture`" on worklets >=0.10.
  const crosshairScrubActive = crosshair.scrubActive;

  // `projected` is used internally by the hit-test gesture; the overlay
  // self-projects, so we only need the gesture here.
  const { tapGesture: markerTapGesture, hitTest: markerHitTest } = useMarkers(
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
    let min = historyStartTime != null && Number.isFinite(historyStartTime)
      ? historyStartTime : Infinity;
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
    overscroll: timeScrollOverscroll,
    fling: timeScrollFling,
    scrollActive,
    // Once a scrub is engaged the chart is locked: scrolling goes inert so the
    // finger only moves the price indicator across a fixed window.
    scrubActive: crosshairScrubActive,
    onScrollStart: () => {
      "worklet";
      crosshairScrubActive.set(false);
    },
  });

  const pinchZoomGesture = usePinchZoom({
    engine,
    padding: effectivePadding,
    minTime: scrollMinTime,
    timeWindow,
    fullHistoryWindow: engine.fullHistoryWindow,
    enabled: zoomEnabled,
    minTimeWindow: zoomCfg?.minTimeWindow,
    maxTimeWindow: zoomCfg?.maxTimeWindow,
    overscroll: timeScrollOverscroll,
    onZoomStart: () => {
      "worklet";
      crosshairScrubActive.set(false);
    },
  });

  useVisibleRange({
    engine,
    minTime: scrollMinTime,
    onVisibleRangeChange,
    onReachStart,
  });

  const plotGesture = composeSeriesRootGesture(
    crosshair.gesture,
    markerTapGesture,
    panScrollGesture,
    pinchZoomGesture,
    markersActive,
    timeScrollEnabled,
    zoomEnabled,
    scrollGestureMode,
  );

  const clearCrosshair = useCallback(() => {
    "worklet";
    crosshairScrubActive.set(false);
  }, [crosshairScrubActive]);
  const rootGesture = useYAxisScaleGesture({
    engine,
    padding: effectivePadding,
    axis: yAxisCfg,
    entries: yAxisEntries,
    font: skiaFont,
    scale: effectiveYRangeScale,
    gesture: plotGesture,
    deferHit: markerHitTest,
    onStart: clearCrosshair,
    active: axisScaleActive,
  });

  const backgroundColor = `rgb(${palette.bgRgb[0]}, ${palette.bgRgb[1]}, ${palette.bgRgb[2]})`;

  // Fade markers + reference lines out while scrubbing when
  // `scrub.hideOverlaysOnScrub` is set. Eased off the scrub-ACTIVE flag (not the
  // crosshair edge fade, which would resurface them near the live dot); only a
  // group opacity animates — the overlay draws stay intact. See `LiveChart`.
  const fadeOverlaysOnScrub =
    scrubCfg !== null && scrubCfg.hideOverlaysOnScrub === true;
  const overlayScrubFade = useDerivedValue(() =>
    fadeOverlaysOnScrub
      ? withTiming(crosshairScrubActive.get() ? 0 : 1, {
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
    seriesOpacity: resolvedSeriesOpacity,
    seriesIndicatorOpacity,
    style,
    canvasMode,
    accessibilityLabel,
    accessibilityRole,
    emptyText,
    formatValue,
    onSeriesToggle,
    // configs
    yAxisCfg,
    xAxisCfg,
    scrubCfg,
    seriesTooltipCfg,
    gridStyleCfg,
    xGridStyleCfg,
    dotCfg,
    dotOuterRadius,
    legendCfg,
    degenCfg,
    onDegenShake,
    metricsCfg,
    allRefLines,
    refLineKeys,
    refLineCustom,
    refLineOffAxisCustom,
    refLineCustomTagWidths,
    leftEdgeFadeCfg,
    // theme / layout / fonts
    palette,
    skiaFont,
    fontProp,
    seriesLabelInset,
    strokeWidth,
    effectivePadding,
    backgroundColor,
    // engine + reveal
    engine,
    reveal,
    loadingActive,
    // loading shell styling (null → not loading)
    loadingLineColor: loadingLook?.color,
    loadingStrokeWidth: loadingLook?.strokeWidth,
    loadingAmplitude: loadingLook?.amplitude,
    loadingSpeed: loadingLook?.speed,
    loadingAxisLabels: loadingLook?.axisLabels ?? true,
    effectiveSeries,
    layoutHeight,
    onLayout,
    seriesSnapshot,
    refreshSeriesPresentation,
    linePaths,
    seriesClip,
    activeSeriesCount,
    lineColors,
    lineStyles,
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
    renderOverlay,
    renderReferenceLine,
    renderOffAxisReferenceLine,
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

/** Share axis configuration between the grid and post-fade label passes. */
function SeriesYAxisLayer({
  model,
  variant,
}: {
  model: LiveChartSeriesModel;
  variant: "all" | "grid" | "labels";
}) {
  const {
    yAxisCfg,
    reveal,
    yAxisEntries,
    engine,
    effectivePadding,
    palette,
    skiaFont,
    seriesLabelInset,
    gridStyleCfg,
  } = model;
  if (!yAxisCfg) return null;
  return (
    <Group opacity={reveal.yAxisOpacity}>
      <YAxisOverlay
        variant={variant}
        side={yAxisCfg.side}
        entries={yAxisEntries}
        engine={engine}
        padding={effectivePadding}
        palette={palette}
        font={skiaFont}
        badge={false}
        seriesLabelInset={seriesLabelInset}
        gridStyle={gridStyleCfg}
        labelRightMargin={yAxisCfg.labelRightMargin}
        gridEndGap={yAxisCfg.gridEndGap}
        minGap={yAxisCfg.minGap}
      />
    </Group>
  );
}

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
    xGridStyleCfg,
    degenCfg,
    markersActive,
    markersSV,
    markerClusterCfg,
    markerGroupOpacity,
    overlayScrubFade,
    renderMarker,
    series,
    seriesOpacity,
    seriesIndicatorOpacity,
    emptyText,
    loadingAxisLabels,
    metricsCfg,
    loadingLineColor,
    loadingStrokeWidth,
    loadingAmplitude,
    loadingSpeed,
    canvasMode,
    activeSeriesCount,
    refLineKeys,
    seriesClip,
  } = model;

  return (
    <Group transform={degenShakeTransform}>
      <SeriesYAxisLayer
        model={model}
        variant={yAxisCfg?.side === "left" ? "grid" : "all"}
      />

      {/* Vertical grid at the time ticks (`xAxis.gridLines`), behind the
          series like the horizontal grid. */}
      {xAxisCfg && xGridStyleCfg && (
        <XAxisGridLines
          entries={xAxisEntries}
          engine={engine}
          padding={effectivePadding}
          palette={palette}
          gridStyle={xGridStyleCfg}
        />
      )}

      {/* Fade group lets `scrub.hideOverlaysOnScrub` ease the lines out. Explicit
          ids keep each reference line mounted when the caller reorders it. */}
      <Group opacity={overlayScrubFade}>
        {allRefLines.map((rl, i) => (
          <ReferenceLineOverlay
            key={refLineKeys[i]}
            engine={engine}
            padding={effectivePadding}
            line={rl}
            valueAxis={{ metrics: model.metricsCfg.badge, fontSize: skiaFont.getSize() }}
            fontProp={model.fontProp}
            palette={palette}
            formatValue={formatValue}
            font={skiaFont}
            yAxisEntries={yAxisEntries}
            labelRightMargin={yAxisCfg?.labelRightMargin}
            gridEndGap={yAxisCfg?.gridEndGap}
          />
        ))}
      </Group>

      <Group opacity={seriesOpacity}>
        {dotCfg.valueLine && (
          <Group opacity={reveal.lineOpacity}>
            <MultiSeriesValueLines
              engine={engine}
              padding={effectivePadding}
              colors={lineColors}
              config={dotCfg.valueLine}
              seriesCount={activeSeriesCount}
            />
          </Group>
        )}

        <Group opacity={reveal.lineOpacity} clip={seriesClip}>
          {Array.from({ length: activeSeriesCount }, (_, i) => (
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
        <Group opacity={seriesIndicatorOpacity}>
          <Group opacity={reveal.dotOpacity}>
            <MultiSeriesDots
              engine={engine}
              padding={effectivePadding}
              colors={lineColors}
              radius={dotCfg.radius}
              ring={dotCfg.ring}
              glow={dotCfg.glow}
              ringColor={palette.badgeOuterBg}
              color={dotCfg.color}
              pulse={dotCfg.pulse}
              viewEnd={engine.viewEnd}
              seriesCount={activeSeriesCount}
            />
          </Group>
        </Group>
      )}

      {/* Value labels are drawn later (after the crosshair layer) so the scrub
          dim — which now covers the dots + pulse rings — never clips them.
          They track each series' live value, not the scrub point. */}

      {degenCfg && <SeriesDegenLayer model={model} config={degenCfg} />}

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
        showAxisLabels={loadingAxisLabels}
        lineColor={loadingLineColor}
        lineStrokeWidth={loadingStrokeWidth}
        waveAmplitude={loadingAmplitude}
        waveSpeed={loadingSpeed}
        opaqueCanvas={canvasMode === "opaque"}
      />
    </Group>
  );
}

/** Allocate particle buffers, config SharedValues, and the frame loop only when enabled. */
function SeriesDegenLayer({ model, config }: {
  model: LiveChartSeriesModel;
  config: NonNullable<LiveChartSeriesModel["degenCfg"]>;
}) {
  const { engine, effectivePadding, onDegenShake, degenShakeTransform, reveal, palette, lineColors } = model;
  const effect = useMultiSeriesDegen(engine, effectivePadding, config, onDegenShake, degenShakeTransform);
  useEffect(() => () => {
    degenShakeTransform.set([{ translateX: 0 }, { translateY: 0 }]);
  }, [degenShakeTransform]);
  return (
    <Group opacity={reveal.dotOpacity}>
      <DegenParticlesOverlay
        pack={effect.pack}
        packRevision={effect.packRevision}
        particleTimestamp={effect.particleTimestamp}
        palette={palette}
        particleSlotCount={config.particleSlotCount}
        particleBurstDurationSec={config.particleBurstDurationSec}
        particleOpacity={config.particleOpacity}
        colors={config.colors ?? lineColors}
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
    seriesOpacity,
    degenShakeTransform,
    activeSeriesCount,
  } = model;
  if (!dotCfg.valueLabel) return null;
  return (
    <Group transform={degenShakeTransform}>
      <Group opacity={seriesOpacity}>
        <Group opacity={reveal.dotOpacity}>
          <MultiSeriesValueLabels
            engine={engine}
            padding={effectivePadding}
            colors={lineColors}
            font={skiaFont}
            dotRadius={dotOuterRadius}
            seriesCount={activeSeriesCount}
          />
        </Group>
      </Group>
    </Group>
  );
}

/** Reference-line badges + labels, drawn ABOVE the left-edge fade so they stay
 *  crisp (the lines/bands render in the base pass inside SeriesChartStack). */
function SeriesRefBadgeLayer({ model }: { model: LiveChartSeriesModel }) {
  const {
    allRefLines,
    refLineKeys,
    refLineCustom,
    refLineOffAxisCustom,
    refLineCustomTagWidths,
    engine,
    effectivePadding,
    palette,
    formatValue,
    skiaFont,
    yAxisCfg,
    yAxisEntries,
    degenShakeTransform,
    overlayScrubFade,
  } = model;
  if (allRefLines.length === 0) return null;
  return (
    <Group transform={degenShakeTransform} opacity={overlayScrubFade}>
      {allRefLines.map((rl, i) => (
        <ReferenceLineOverlay
          key={refLineKeys[i]}
          engine={engine}
          padding={effectivePadding}
          line={rl}
          valueAxis={{ metrics: model.metricsCfg.badge, fontSize: skiaFont.getSize() }}
          fontProp={model.fontProp}
          palette={palette}
          formatValue={formatValue}
          font={skiaFont}
          badgeLayer
          suppressTag={refLineCustom[i]}
          suppressTagWhenOffAxis={refLineOffAxisCustom[i]}
          customTagWidths={refLineCustomTagWidths}
          yAxisEntries={yAxisEntries}
          labelRightMargin={yAxisCfg?.labelRightMargin}
          gridEndGap={yAxisCfg?.gridEndGap}
        />
      ))}
    </Group>
  );
}

/** Owns the price/time projection worklets for the multi-series custom overlay. */
function SeriesCustomConsumerOverlay({
  model,
}: {
  model: LiveChartSeriesModel;
}) {
  const { engine, effectivePadding, renderOverlay } = model;
  const overlayContext = useChartOverlayContext(engine, effectivePadding);
  return <ChartOverlayLayer render={renderOverlay!} context={overlayContext} />;
}

/** Keeps the extra fade mapper opt-in with the per-series tooltip itself. */
function SeriesTooltipLayer({
  model,
  config,
}: {
  model: LiveChartSeriesModel;
  config: NonNullable<LiveChartSeriesModel["seriesTooltipCfg"]>;
}) {
  const {
    crosshair,
    engine,
    effectivePadding,
    scrubCfg,
    skiaFont,
    palette,
    activeSeriesCount,
  } = model;
  const activeOpacity = useCrosshairVisibleOpacity(
    crosshair.scrubX,
    engine.canvasWidth,
    effectivePadding.right,
    crosshair.scrubActive,
    scrubCfg?.crosshairFade ?? true,
    scrubCfg?.crosshairFadeDistance ?? 4,
  );
  const scrubActive = crosshair.scrubActive;
  const alwaysShow = config.alwaysShow;
  const opacity = useDerivedValue(
    () => (scrubActive.get() ? activeOpacity.get() : alwaysShow ? 1 : 0),
    [scrubActive, activeOpacity, alwaysShow],
  );

  return (
    <PerSeriesTooltipOverlay
      layout={crosshair.tooltipLayout}
      font={skiaFont}
      palette={palette}
      config={config}
      seriesCount={activeSeriesCount}
      opacity={opacity}
      tooltipBackground={scrubCfg?.tooltipBackground}
      tooltipColor={scrubCfg?.tooltipColor}
      tooltipBorderColor={scrubCfg?.tooltipBorderColor}
    />
  );
}

function SeriesLegend({
  model,
  position,
}: {
  model: LiveChartSeriesModel;
  position: "top" | "bottom";
}) {
  const { legendCfg, series, palette, onSeriesToggle, seriesSnapshot, refreshSeriesPresentation } = model;
  if (!legendCfg.visible || legendCfg.position !== position) return null;
  return (
    <SeriesToggleChipsView
      snapshot={seriesSnapshot}
      onSnapshotChange={refreshSeriesPresentation}
      series={series}
      legend={legendCfg}
      palette={palette}
      onSeriesToggle={onSeriesToggle}
    />
  );
}

function SeriesCanvas({ model }: { model: LiveChartSeriesModel }) {
  const {
    canvasMode,
    layoutHeight,
    engine,
    backgroundColor,
    effectivePadding,
    topConnector,
    bottomConnector,
    loadingActive,
    topLabelCfg,
    leftEdgeFadeCfg,
    palette,
    scrubCfg,
    seriesTooltipCfg,
    crosshair,
    selectionDot,
    selectionColor,
    dotOuterRadius,
    dotCfg,
  } = model;
  const liveDotExtent = Math.max(
    dotOuterRadius,
    dotCfg.pulse
      ? pulseRadialOutset(dotCfg.pulse.maxRadius, dotCfg.pulse.strokeWidth)
      : 0,
  );
  return (
    <Canvas
      key={canvasMode}
      style={{ flex: 1, minHeight: layoutHeight || 1 }}
      opaque={canvasMode === "opaque"}
    >
      {canvasMode === "opaque" ? (
        <Rect
          x={0}
          y={0}
          width={engine.canvasWidth}
          height={engine.canvasHeight}
          color={backgroundColor}
        />
      ) : null}
      <SeriesChartStack model={model} />
      <ExtremaConnectorOverlay
        engine={engine}
        padding={effectivePadding}
        top={topConnector}
        bottom={bottomConnector}
        hideExtrema={loadingActive}
        suppressBottomWhenCoincident={
          topLabelCfg?.position === "extrema" ||
          topLabelCfg?.position === "extrema-edge"
        }
      />
      {leftEdgeFadeCfg ? (
        <LeftEdgeFade
          paddingLeft={effectivePadding.left}
          fadeWidth={leftEdgeFadeCfg.width}
          startColor={leftEdgeFadeCfg.startColor}
          endColor={leftEdgeFadeCfg.endColor}
          engine={engine}
          opaqueBackgroundRgb={
            canvasMode === "opaque" ? palette.bgRgb : undefined
          }
        />
      ) : null}
      {/* Keep left-gutter labels above the fade, with grid lines behind the series. */}
      {model.yAxisCfg?.side === "left" ? (
        <Group transform={model.degenShakeTransform}>
          <SeriesYAxisLayer model={model} variant="labels" />
        </Group>
      ) : null}
      <SeriesRefBadgeLayer model={model} />
      {scrubCfg ? (
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
          crosshairLineColor={
            seriesTooltipCfg?.guideColor ?? scrubCfg.crosshairLineColor
          }
          crosshairStrokeWidth={
            seriesTooltipCfg?.guideWidth ?? scrubCfg.crosshairStrokeWidth
          }
          crosshairOvershoot={scrubCfg.crosshairOvershoot}
          crosshairFade={scrubCfg.crosshairFade}
          crosshairFadeDistance={scrubCfg.crosshairFadeDistance}
          crosshairLineCap={scrubCfg.crosshairLineCap}
          crosshairDash={
            seriesTooltipCfg
              ? seriesTooltipCfg.guideDashPattern
              : scrubCfg.crosshairDash
          }
          crosshairDimColor={scrubCfg.crosshairDimColor}
          opaqueCanvas={canvasMode === "opaque"}
        />
      ) : null}
      <SeriesValueLabelLayer model={model} />
    </Canvas>
  );
}

function SeriesNativeOverlays({ model }: { model: LiveChartSeriesModel }) {
  const {
    markersActive,
    markersSV,
    markerClusterCfg,
    renderMarker,
    renderOverlay,
    renderReferenceLine,
    renderOffAxisReferenceLine,
    allRefLines,
    refLineCustom,
    refLineOffAxisCustom,
    refLineCustomTagWidths,
    overlayScrubFade,
    engine,
    effectivePadding,
    series,
    formatValue,
    seriesTooltipCfg,
  } = model;
  const overlayFadeStyle = useAnimatedStyle(() => ({
    opacity: overlayScrubFade.get(),
  }));
  const hasCustomAnnotations =
    (markersActive && renderMarker != null) ||
    ((renderReferenceLine != null || renderOffAxisReferenceLine != null) &&
      allRefLines.length > 0);

  return (
    <>
      {hasCustomAnnotations ? (
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, overlayFadeStyle]}
        >
          {markersActive && renderMarker ? (
            <CustomMarkerOverlay
              markers={markersSV}
              renderMarker={renderMarker}
              engine={engine}
              padding={effectivePadding}
              series={series}
              cluster={markerClusterCfg}
            />
          ) : null}
          {renderReferenceLine && allRefLines.length > 0 ? (
            <CustomReferenceLineOverlay
              lines={allRefLines}
              renderReferenceLine={renderReferenceLine}
              custom={refLineCustom}
              engine={engine}
              padding={effectivePadding}
              formatValue={formatValue}
              tagWidths={refLineCustomTagWidths}
            />
          ) : null}
          {renderOffAxisReferenceLine && allRefLines.length > 0 ? (
            <CustomReferenceLineOverlay
              lines={allRefLines}
              renderReferenceLine={renderOffAxisReferenceLine}
              custom={refLineOffAxisCustom}
              engine={engine}
              padding={effectivePadding}
              formatValue={formatValue}
              tagWidths={refLineCustomTagWidths}
              offAxisOnly
            />
          ) : null}
        </Animated.View>
      ) : null}
      {seriesTooltipCfg ? (
        <View
          testID="live-chart-series-tooltip-overlay"
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        >
          <Canvas style={StyleSheet.absoluteFill}>
            <SeriesTooltipLayer model={model} config={seriesTooltipCfg} />
          </Canvas>
        </View>
      ) : null}
      {renderOverlay ? <SeriesCustomConsumerOverlay model={model} /> : null}
    </>
  );
}

export const LiveChartSeries = forwardRef<
  LiveChartHandle,
  LiveChartSeriesProps
>(function LiveChartSeries(props, ref) {
  const model = useLiveChartSeriesController(props);
  const { viewEnd, viewWindow } = model.engine;
  useImperativeHandle(
    ref,
    () => ({
      resetZoom: () => scheduleOnUI(resetPinchZoom, { viewEnd, viewWindow }),
    }),
    [viewEnd, viewWindow],
  );
  const {
    rootGesture,
    backgroundColor,
    style,
    onLayout,
    accessibilityLabel,
    accessibilityRole,
    layoutHeight,
    effectivePadding,
    engine,
    palette,
    formatValue,
    topLabelCfg,
    bottomLabelCfg,
    loadingActive,
  } = model;

  return (
    <View
      style={[{ flex: 1, backgroundColor }, style]}
      accessible={accessibilityLabel != null}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
    >
      <SeriesLegend model={model} position="top" />
      {/* Gesture + layout wrap ONLY the canvas: the legend chips are Pressables
          that must sit outside the scrub gesture to receive taps, and the engine
          canvas height must measure the canvas alone (excluding the legend row),
          else points map into a taller area and the x-axis draws past the edge. */}
      <GestureDetector gesture={rootGesture}>
        <View style={{ flex: 1 }} onLayout={onLayout}>
          <SeriesCanvas model={model} />

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
            hideExtrema={loadingActive}
          />

          <SeriesNativeOverlays model={model} />
        </View>
      </GestureDetector>
      <SeriesLegend model={model} position="bottom" />
    </View>
  );
});
