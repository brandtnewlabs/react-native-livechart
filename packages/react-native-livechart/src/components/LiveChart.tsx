import { useLayoutEffect, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";

/**
 * Single-series live chart. UX and prop vocabulary parallel Benji Taylor’s
 * `liveline` for React; implemented here with Skia, Reanimated, and Gesture Handler.
 *
 * @see https://github.com/benjitaylor/liveline
 */
import {
  Canvas,
  Group,
  LinearGradient,
  Path,
  vec,
} from "@shopify/react-native-skia";

import { DEFAULT_ACCENT_COLOR } from "../constants";
import {
  resolveAxisLabel,
  resolveBadge,
  resolveDegen,
  resolveDot,
  resolveGradient,
  resolveGridStyle,
  resolveLeftEdgeFade,
  resolveMetrics,
  resolvePulse,
  resolveScrub,
  resolveScrubAction,
  resolveSelectionDot,
  resolveThreshold,
  resolveTradeStream,
  resolveValueLine,
  resolveXAxis,
  resolveYAxis,
} from "../core/resolveConfig";
import type { ResolvedThresholdConfig } from "../core/resolveConfig";
import { resolveSegment } from "../core/resolveSegment";
import { useLiveChartEngine } from "../core/useLiveChartEngine";
import { pulseRadialOutset } from "../draw/line";
import { resolveChartLayout } from "../hooks/resolveChartLayout";
import { useBadge } from "../hooks/useBadge";
import { useCandlePaths } from "../hooks/useCandlePaths";
import { useCanvasLayout } from "../hooks/useCanvasLayout";
import { useChartColors } from "../hooks/useChartColors";
import { useChartPaths } from "../hooks/useChartPaths";
import { useChartReveal } from "../hooks/useChartReveal";
import { useChartSkiaFont } from "../hooks/useChartSkiaFont";
import { useCrosshair } from "../hooks/useCrosshair";
import { useDegen } from "../hooks/useDegen";
import { useLiveChartHasData } from "../hooks/useLiveChartHasData";
import { useLiveDot } from "../hooks/useLiveDot";
import { useMarkers } from "../hooks/useMarkers";
import { useReferenceLinePress } from "../hooks/useReferenceLinePress";
import { useModeBlend } from "../hooks/useModeBlend";
import { useMomentum } from "../hooks/useMomentum";
import { useSegmentLineGradient } from "../hooks/useSegmentLineGradient";
import { useSingleChartReverseMorphInputs } from "../hooks/useReverseMorphEngineInputs";
import { useThreshold } from "../hooks/useThreshold";
import { useTradeStream } from "../hooks/useTradeStream";
import { useXAxis } from "../hooks/useXAxis";
import { useYAxis } from "../hooks/useYAxis";
import {
  formatTime as defaultFormatTime,
  formatValue as defaultFormatValue,
} from "../lib/format";
import { MONO_FONT_FAMILY } from "../lib/monoFontFamily";
import { collectReferenceValues } from "../math/referenceLines";
import {
  applyPaletteOverride,
  leftEdgeFadeColorsFromBgRgb,
  parseColorRgb,
  resolveTheme,
} from "../theme";
import type {
  LiveChartPalette,
  LiveChartProps,
  Marker,
  TradeEvent,
} from "../types";
import {
  ThresholdBadgeOverlay,
  ThresholdLineOverlay,
} from "./ThresholdLineOverlay";
import { AxisLabelOverlay } from "./AxisLabelOverlay";
import {
  ExtremaConnectorOverlay,
  labelConnector,
} from "./ExtremaConnectorOverlay";
import { CustomMarkerOverlay } from "./CustomMarkerOverlay";
import { CustomTooltipOverlay } from "./CustomTooltipOverlay";
import { BadgeOverlay } from "./BadgeOverlay";
import { CrosshairOverlay } from "./CrosshairOverlay";
import { DegenParticlesOverlay } from "./DegenParticlesOverlay";
import { DotOverlay } from "./DotOverlay";
import { LeftEdgeFade } from "./LeftEdgeFade";
import { LoadingOverlay } from "./LoadingOverlay";
import { MarkerOverlay } from "./MarkerOverlay";
import { MultiSeriesTooltipStack } from "./MultiSeriesTooltipStack";
import { ValueTextOverlay } from "./ValueTextOverlay";
import { ReferenceLineOverlay } from "./ReferenceLineOverlay";
import { ScrubActionOverlay } from "./ScrubActionOverlay";
import { SegmentDividerOverlay } from "./SegmentDividerOverlay";
import { TradeStreamOverlay } from "./TradeStreamOverlay";
import { ValueLineOverlay } from "./ValueLineOverlay";
import { XAxisOverlay } from "./XAxisOverlay";
import { YAxisOverlay } from "./YAxisOverlay";

/** Translucent fill alpha for the threshold profit/loss band. */
const THRESHOLD_FILL_OPACITY = 0.16;

/**
 * Color stops for the threshold's hard-split vertical gradient. Both arrays pair
 * with the `[0, t, t, 1]` split positions: index 0–1 paint above the split,
 * 2–3 below. `stroke` is full-strength; `fill` is the same hues at
 * {@link THRESHOLD_FILL_OPACITY} for the band. Defaults to the palette's semantic
 * up-green / down-red when colors are omitted.
 */
function thresholdStops(
  cfg: ResolvedThresholdConfig,
  palette: LiveChartPalette,
): { stroke: string[]; fill: string[] } {
  const above = cfg.aboveColor ?? palette.candleUp;
  const below = cfg.belowColor ?? palette.candleDown;
  const [ar, ag, ab] = parseColorRgb(above);
  const [br, bg, bb] = parseColorRgb(below);
  const aboveFill = `rgba(${ar}, ${ag}, ${ab}, ${THRESHOLD_FILL_OPACITY})`;
  const belowFill = `rgba(${br}, ${bg}, ${bb}, ${THRESHOLD_FILL_OPACITY})`;
  return {
    stroke: [above, above, below, below],
    fill: [aboveFill, aboveFill, belowFill, belowFill],
  };
}

/**
 * Resolves props → configs → theme/layout → engine → per-frame derived values and
 * overlay hooks, returning a single render model. All the chart's wiring lives
 * here so the rendered pieces (`ChartStack`, `ChartScrubLayer`, `LiveChart`) stay
 * small and presentational.
 */
function useLiveChartController({
  // ── Data ────────────────────────────────────────────────────────────────
  data,
  value,

  // ── Appearance ──────────────────────────────────────────────────────────
  theme = "dark",
  accentColor = DEFAULT_ACCENT_COLOR,
  gradient = true,
  line: lineProp,
  font: fontProp,
  insets,
  style,

  // ── Candlestick ─────────────────────────────────────────────────────────
  mode = "line",
  candles,
  candleWidth = 60,
  liveCandle,

  // ── Behaviour ───────────────────────────────────────────────────────────
  timeWindow = 30,
  paused = false,
  loading = false,
  // `static` is a reserved word — alias it so the destructure parses.
  static: isStatic = false,
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

  // ── Overlays ────────────────────────────────────────────────────────────
  yAxis = true,
  xAxis = true,
  topLabel,
  bottomLabel,
  badge = true,
  momentum = true,
  pulse = true,
  dot,
  valueLine = true,
  showValue = false,
  valueMomentumColor = false,
  referenceLines,
  segments,
  threshold,
  gridStyle,
  palette: paletteOverride,
  metrics,
  scrub = true,
  scrubAction,
  selectionDot,
  tradeStream,
  degen,
  markers,
  onMarkerHover,
  markerHitRadius = 16,
  renderMarker,
  renderTooltip,
  leftEdgeFade = true,

  // ── Callbacks ───────────────────────────────────────────────────────────
  onScrub,
  onScrubAction,
  onReferenceLinePress,
  onGestureStart,
  onGestureEnd,
  onDegenShake,
}: LiveChartProps) {
  const emptyTradeStream = useSharedValue<TradeEvent[]>([]);
  const tradeStreamSV = tradeStream ?? emptyTradeStream;
  const emptyMarkers = useSharedValue<Marker[]>([]);
  const markersSV = markers ?? emptyMarkers;
  // Stand-in threshold value so `useThreshold` can be called unconditionally
  // (hooks can't be); the geometry is ignored when no threshold is configured.
  const emptyThresholdValue = useSharedValue(0);
  const isCandle = mode === "candle";

  // ── Resolve feature configs ────────────────────────────────────────────
  const yAxisCfg = resolveYAxis(yAxis);
  const xAxisCfg = resolveXAxis(xAxis);
  const topLabelCfg = resolveAxisLabel(topLabel);
  const bottomLabelCfg = resolveAxisLabel(bottomLabel);
  const badgeCfg = resolveBadge(badge);
  const scrubCfg = resolveScrub(scrub);
  // Static charts run no gestures, so scrub-action (tap/drag to lock a price) is off.
  const scrubActionCfg = isStatic ? null : resolveScrubAction(scrubAction);
  const gradientCfg = isCandle ? null : resolveGradient(gradient);
  // Threshold split is a line-mode feature (candle bodies carry their own up/down
  // colors), so it's inert in candle mode — same as the area gradient.
  const thresholdCfg = isCandle ? null : resolveThreshold(threshold);
  const valueLineCfg = resolveValueLine(valueLine);
  // Static charts run zero loops: force the pulse off so its `withRepeat`-driven
  // ring never starts (the DotOverlay reads `pulseCfg`, so null = no pulse).
  const pulseCfg = isStatic ? null : resolvePulse(pulse);
  const dotCfg = resolveDot(dot);
  const selectionDotCfg = resolveSelectionDot(selectionDot);
  // Outer footprint of the dot (color-filled radius plus the halo ring).
  const dotOuterRadius = dotCfg.radius + (dotCfg.ring?.width ?? 0);
  const gridStyleCfg = resolveGridStyle(gridStyle);
  // Static charts run zero loops: force degen off so `useDegen`'s frame callback
  // never starts (also passed `isStatic` below as a belt-and-braces autostart gate).
  const degenCfg = isStatic ? null : resolveDegen(degen);
  const tradeStreamResolved = resolveTradeStream(tradeStream);
  const metricsCfg = resolveMetrics(metrics);

  const allRefLines = referenceLines ?? [];
  const refValues = collectReferenceValues(allRefLines);

  const badgeUsesRightGutter =
    badgeCfg !== null && (badgeCfg.position ?? "right") === "right";

  // ── Theme, font and layout ─────────────────────────────────────────────
  const palette = applyPaletteOverride(
    resolveTheme(accentColor, theme),
    paletteOverride,
  );

  // Time-range segments (sessions, after-hours, …). Resolved once per render like
  // reference lines; the divider/label/muted colors default to the chart palette
  // (no per-segment base color needed). `hasRecolorSegments` is a render-time gate
  // for the line-recolor gradient pass (per-frame visibility is handled by the
  // gradient's transparent stops, not by mounting/unmounting the Path).
  const resolvedSegments = (segments ?? []).map((s) =>
    resolveSegment(s, {
      muted: palette.gridLabel,
      divider: palette.refLine,
      label: palette.refLabel,
    }),
  );
  const hasRecolorSegments = resolvedSegments.some((s) => s.recolorLine);

  const leftEdgeFadeCfg = resolveLeftEdgeFade(
    leftEdgeFade,
    leftEdgeFadeColorsFromBgRgb(palette.bgRgb),
  );

  const skiaFont = useChartSkiaFont(
    fontProp,
    MONO_FONT_FAMILY,
    palette.labelFontSize,
  );

  // Larger font for the optional live-value text overlay (showValue).
  const valueFont = useChartSkiaFont(
    fontProp,
    MONO_FONT_FAMILY,
    palette.valueFontSize * 2,
  );

  const pulseConfig = pulseCfg
    ? {
        maxRadius: pulseCfg.maxRadius,
        strokeWidth: pulseCfg.strokeWidth,
      }
    : null;

  // Snapshot the live value off the render path to size the right gutter to the
  // value label. Reading a SharedValue during render trips Reanimated's
  // strict-mode warning, and the gutter only needs a representative magnitude —
  // so read it in a layout effect (re-measures before paint, no visible reflow)
  // once on mount, re-synced if the `value` SharedValue identity changes.
  // react-doctor's "derive during render" fix is exactly what Reanimated forbids
  // here, so suppress its effect-read rules at this seed.
  const [valueLayoutSample, setValueLayoutSample] = useState<
    number | undefined
  >(undefined);
  // react-doctor-disable-next-line react-doctor/no-derived-state-effect -- Reanimated: must read the SharedValue off the render path
  useLayoutEffect(() => {
    // react-doctor-disable-next-line react-hooks-js/set-state-in-effect -- Reanimated: seeding from a SharedValue off render is the warning-free path
    setValueLayoutSample(value.get());
  }, [value]);

  const { strokeWidth, padding: effectivePadding } = resolveChartLayout({
    palette,
    lineWidthOverride: lineProp?.width,
    insetsOverride: insets,
    yAxis: yAxisCfg !== null,
    badge: badgeCfg !== null,
    badgeMetrics: metricsCfg.badge,
    badgeUsesRightGutter,
    badgeShowTail: badgeCfg?.tail ?? true,
    xAxis: xAxisCfg !== null,
    font: skiaFont,
    formatValue,
    currentValue: valueLayoutSample,
    pulse: pulseConfig,
  });

  // ── Reveal state ────────────────────────────────────────────
  // ≥2 line points or ≥2 committed candles; morphT=1 only when !loading && hasData.
  const { hasData } = useLiveChartHasData({
    isCandle,
    data,
    candles,
  });

  const reveal = useChartReveal(loading, hasData, isStatic);

  // After data clears, keep last snapshot until morphT finishes dropping (web parity).
  const { lineEngineData, candlesEngine, liveEngine } =
    useSingleChartReverseMorphInputs({
      isCandle,
      data,
      candles,
      liveCandle,
      hasData,
      morphT: reveal.morphT,
    });

  // ── Engine ─────────────────────────────────────────────────────────────
  // Line mode: tick + paths use `lineEngineData` (stash when reversing). Candle mode:
  // parent `data` stays tick/line-morph input; OHLC uses candlesEngine + liveEngine.
  const engine = useLiveChartEngine({
    data: isCandle ? data : lineEngineData,
    value,
    timeWindow,
    paused,
    static: isStatic,
    smoothing,
    adaptiveSpeedBoost: metricsCfg.motion.adaptiveSpeedBoost,
    exaggerate,
    referenceValues: refValues,
    nonNegative,
    maxValue,
    windowBuffer,
    nowOverride,
    mode,
    candles: isCandle ? candlesEngine : candles,
    liveCandle: isCandle ? liveEngine : liveCandle,
  });

  // ── Mode crossfade (line ↔ candle) ──────────────────────────────────
  const { lineGroupOpacity, candleGroupOpacity } = useModeBlend(
    isCandle,
    reveal.lineOpacity,
  );

  // ── Per-frame derived values ───────────────────────────────────────────
  const { layoutWidth, layoutHeight, onLayout } = useCanvasLayout(engine);

  // Threshold split geometry (shared by stroke gradient, fill band, marker line).
  // Called unconditionally with a stand-in value when no threshold is set.
  const thresholdGeom = useThreshold(
    engine,
    effectivePadding,
    thresholdCfg?.value ?? emptyThresholdValue,
  );
  const thresholdStopColors = thresholdCfg
    ? thresholdStops(thresholdCfg, palette)
    : null;

  const { linePath, fillPath, thresholdFillPath } = useChartPaths(
    engine,
    effectivePadding,
    reveal.morphT,
    // Only build the band path when the fill is actually on.
    thresholdCfg?.fill ? thresholdGeom.lineY : undefined,
    // Straight polyline instead of the monotone cubic when line.curve === "linear".
    lineProp?.curve === "linear",
  );
  const { upBodiesPath, downBodiesPath, upWicksPath, downWicksPath } =
    useCandlePaths(
      engine,
      effectivePadding,
      // Match engine: stashed candles while reverse-morphing in candle mode.
      isCandle ? candlesEngine : candles,
      isCandle ? liveEngine : liveCandle,
      candleWidth,
      isCandle,
      metricsCfg.candle,
      !isStatic, // static: no candle-width lerp loop
    );
  const { dotX, dotY } = useLiveDot(engine, effectivePadding);

  const momentumSV = useMomentum(engine, momentum);

  const tradeMarkers = useTradeStream(
    engine,
    tradeStreamSV,
    effectivePadding,
    !isStatic && tradeStreamResolved !== null,
    !isStatic, // static: no trade-tape loop
  );

  const {
    pack: degenPack,
    packRevision: degenPackRevision,
    shakeTransform: degenShakeTransform,
  } = useDegen(engine, dotX, dotY, momentumSV, degenCfg, onDegenShake, isStatic);

  // ── Overlay hooks ─────────────────────────────────────────────────────
  const { yAxisEntries } = useYAxis(
    engine,
    effectivePadding,
    formatValue,
    skiaFont,
    yAxisCfg?.minGap ?? 36,
    metricsCfg.grid,
  );

  const { xAxisEntries } = useXAxis(
    engine,
    effectivePadding,
    formatTime,
    skiaFont,
  );

  const badgeData = useBadge(
    engine,
    effectivePadding,
    palette,
    formatValue,
    skiaFont,
    badgeCfg?.variant ?? "default",
    badgeCfg?.tail ?? true,
    momentumSV,
    badgeCfg?.position ?? "right",
    badgeCfg?.background,
    metricsCfg.badge,
    metricsCfg.motion.badgeColorSpeed,
  );

  // Scrub/crosshair must see the same stash-backed candles as the engine.
  const candleOpts = isCandle
    ? {
        mode,
        candles: candlesEngine,
        liveCandle: liveEngine,
        candleWidthSecs: candleWidth,
      }
    : undefined;

  const markersActive = markers != null;
  // `projected` is used internally by the hit-test gesture; the overlay
  // self-projects, so we only need the gesture + hit-test here. Built BEFORE
  // `useCrosshair` so the scrub-action tap can defer to a marker under the finger.
  const { tapGesture: markerTapGesture, hitTest: markerHitTest } = useMarkers(
    engine,
    effectivePadding,
    markersSV,
    !isStatic && markersActive,
    markerHitRadius,
    onMarkerHover,
    undefined, // seriesSV — single-series has none
    engine.data, // anchor value-less markers to the line
    !isStatic, // static: no marker-projection loop
  );

  // Pressable reference-line badges (working orders / alerts). Built before
  // `useCrosshair` so the scrub-action tap can defer to a badge under the finger.
  const refPressActive = onReferenceLinePress != null && allRefLines.length > 0;
  const { tapGesture: refLineTapGesture, hitTest: refLineHitTest } =
    useReferenceLinePress(
      engine,
      effectivePadding,
      allRefLines,
      skiaFont,
      formatValue,
      !isStatic && refPressActive,
      markerHitRadius,
      onReferenceLinePress,
    );

  // Combined "defer" hit-test for the scrub-action place-tap: yield to a marker or
  // a pressable badge under the finger so the tap is routed there instead of
  // dropping a reticle. (Both hit-tests return false when their feature is off.)
  /* istanbul ignore next -- worklet runs on the UI thread, not in Jest */
  const deferTapHit = (x: number, y: number): boolean => {
    "worklet";
    return markerHitTest(x, y) || refLineHitTest(x, y);
  };

  const crosshair = useCrosshair(
    engine,
    effectivePadding,
    palette,
    formatValue,
    formatTime,
    skiaFont,
    // Static charts have an inert pan gesture — no scrub work on the UI thread.
    // Scrub-action also needs the gesture live even when plain scrub is off.
    !isStatic && (scrubCfg !== null || scrubActionCfg !== null),
    onScrub,
    candleOpts,
    scrubCfg?.panGestureDelay ?? 0,
    onGestureStart,
    onGestureEnd,
    scrubActionCfg,
    onScrubAction,
    metricsCfg.badge,
    markersActive || refPressActive ? deferTapHit : undefined,
    scrubCfg?.tooltipPlacement ?? "side",
    scrubCfg?.tooltipShowValue ?? true,
    scrubCfg?.tooltipShowTime ?? true,
    scrubCfg?.tooltipMargin ?? 8,
  );

  // Scrub-action composes a Tap (place/move the reticle, press the badge, dismiss)
  // ahead of the pan via Exclusive, so a tap is tried first and only becomes a
  // drag (live-scrub, or lock-adjust once placed) if the finger moves. `Exclusive`
  // (not `Race`) prevents a jittery tap from being swallowed by the pan.
  const baseGesture =
    scrubActionCfg !== null && crosshair.tapGesture
      ? Gesture.Exclusive(crosshair.tapGesture, crosshair.gesture)
      : crosshair.gesture;

  // Overlay taps that hit-test discrete targets (marker dots, reference-line
  // badges). They must all see each tap, so they're combined with `Simultaneous`
  // (not `Race`, which cancels the loser and would drop one). The scrub-action
  // action tap defers to them via `deferTapHit`, so a tap on an overlay is routed
  // there instead of placing a reticle.
  const overlayTaps = [
    markersActive ? markerTapGesture : null,
    refPressActive ? refLineTapGesture : null,
  ].filter((g): g is NonNullable<typeof g> => g !== null);

  let rootGesture = baseGesture;
  if (overlayTaps.length > 0) {
    const tapGroup =
      overlayTaps.length === 1
        ? overlayTaps[0]
        : Gesture.Simultaneous(overlayTaps[0], overlayTaps[1]);
    // With scrub-action the action tap shares the gesture space with the overlay
    // taps (Simultaneous); without it the pan only needs to race the tap group.
    rootGesture =
      scrubActionCfg !== null
        ? Gesture.Simultaneous(baseGesture, tapGroup)
        : Gesture.Race(baseGesture, tapGroup);
  }

  // ── Derived render values ──────────────────────────────────────────────
  const {
    backgroundColor,
    gradientEnd,
    gradientTopColor,
    gradientBottomColor,
    gradientColors,
    gradientPositions,
  } = useChartColors(
    palette,
    gradientCfg,
    accentColor,
    layoutHeight,
    effectivePadding,
  );

  // Scrub-focus gradient painted onto the line stroke: uniform at rest, and while
  // scrubbing (or with an `active` segment) the focused segment stays full while
  // the others are de-emphasized. Declared after `crosshair` so it can read the
  // live scrub state.
  const segmentGradient = useSegmentLineGradient(
    engine,
    resolvedSegments,
    effectivePadding,
    lineProp?.color ?? palette.line,
    crosshair.scrubX,
    crosshair.scrubActive,
  );

  // Hide the live dot while scrubbing when a selection dot is marking the scrub
  // point instead — otherwise both dots show at once.
  const selectionDotDuringScrub =
    !isStatic && scrubCfg !== null && selectionDotCfg !== null;
  const liveDotOpacity = useDerivedValue(
    () =>
      reveal.dotOpacity.value *
      (selectionDotDuringScrub && crosshair.scrubActive.value ? 0 : 1),
  );

  return {
    // passthrough props the render needs
    style,
    accessibilityLabel,
    accessibilityRole,
    emptyText,
    showValue,
    valueMomentumColor,
    lineProp,
    formatValue,
    isCandle,
    // Half a candle width (seconds) so an "extrema" axis label's dot lands on the
    // candle's drawn center, not its bucket-start (left) edge. 0 in line mode.
    extremaTimeOffset: isCandle ? candleWidth / 2 : 0,
    // configs
    yAxisCfg,
    xAxisCfg,
    badgeCfg,
    scrubCfg,
    scrubActionCfg,
    gradientCfg,
    valueLineCfg,
    pulseCfg,
    dotCfg,
    dotOuterRadius,
    gridStyleCfg,
    degenCfg,
    tradeStreamResolved,
    leftEdgeFadeCfg,
    metricsCfg,
    allRefLines,
    resolvedSegments,
    hasRecolorSegments,
    segmentGradient,
    thresholdCfg,
    thresholdGeom,
    thresholdStrokeColors: thresholdStopColors?.stroke ?? null,
    thresholdFillColors: thresholdStopColors?.fill ?? null,
    badgeUsesRightGutter,
    // theme / layout / fonts
    palette,
    skiaFont,
    valueFont,
    strokeWidth,
    effectivePadding,
    // engine + reveal
    engine,
    reveal,
    // derived render values
    backgroundColor,
    gradientEnd,
    gradientTopColor,
    gradientBottomColor,
    gradientColors,
    gradientPositions,
    lineGroupOpacity,
    candleGroupOpacity,
    layoutWidth,
    onLayout,
    linePath,
    fillPath,
    thresholdFillPath,
    upBodiesPath,
    downBodiesPath,
    upWicksPath,
    downWicksPath,
    dotX,
    dotY,
    liveDotOpacity,
    momentumSV,
    tradeMarkers,
    degenPack,
    degenPackRevision,
    degenShakeTransform,
    yAxisEntries,
    xAxisEntries,
    badgeData,
    crosshair,
    rootGesture,
    markersActive,
    markersSV,
    renderMarker,
    renderTooltip,
    // selection dot: resolved config + fallback color (the chart line/accent color)
    selectionDot: selectionDotCfg,
    selectionColor: lineProp?.color ?? palette.line,
    // RN axis edge labels (floated over the canvas as a sibling layer)
    topLabelCfg,
    bottomLabelCfg,
    // Skia connector lines for "extrema-edge" labels (dot → edge readout).
    topConnector: labelConnector(topLabelCfg, palette.gridLabel),
    bottomConnector: labelConnector(bottomLabelCfg, palette.gridLabel),
  };
}

type LiveChartModel = ReturnType<typeof useLiveChartController>;

/**
 * Background fills drawn BENEATH the left-edge fade: the y-axis grid, the area
 * gradient, and the threshold profit/loss band. Split out from `ChartStack` so
 * the fade's `dstOut` only softens the fills — the line and everything above it
 * (drawn in `ChartStack`, after the fade) stay crisp at the left edge.
 */
function ChartFillLayer({ model }: { model: LiveChartModel }) {
  const {
    degenShakeTransform,
    yAxisCfg,
    reveal,
    yAxisEntries,
    engine,
    effectivePadding,
    palette,
    skiaFont,
    badgeUsesRightGutter,
    badgeCfg,
    gridStyleCfg,
    metricsCfg,
    gradientCfg,
    fillPath,
    gradientEnd,
    gradientColors,
    gradientPositions,
    thresholdCfg,
    thresholdGeom,
    thresholdFillPath,
    thresholdFillColors,
  } = model;

  return (
    <Group transform={degenShakeTransform}>
      {/* Y-axis grid */}
      {yAxisCfg && (
        <Group opacity={reveal.yAxisOpacity}>
          <YAxisOverlay
            entries={yAxisEntries}
            engine={engine}
            padding={effectivePadding}
            palette={palette}
            font={skiaFont}
            badge={badgeUsesRightGutter}
            badgeTail={badgeCfg?.tail ?? true}
            badgeMetrics={metricsCfg.badge}
            gridStyle={gridStyleCfg}
          />
        </Group>
      )}

      {/* Area gradient fill */}
      {gradientCfg && (
        <Group opacity={reveal.fillOpacity}>
          <Path path={fillPath} style="fill">
            <LinearGradient
              start={vec(0, effectivePadding.top)}
              end={vec(0, gradientEnd)}
              colors={gradientColors}
              positions={gradientPositions}
            />
          </Path>
        </Group>
      )}

      {/* Threshold profit/loss band — the area between the line and the threshold,
          hard-split at the threshold Y into the above/below colors. Independent of
          the baseline area fill above (set `gradient={false}` for the band alone). */}
      {thresholdCfg?.fill && thresholdFillColors && (
        <Group opacity={reveal.fillOpacity}>
          <Path path={thresholdFillPath} style="fill">
            <LinearGradient
              start={vec(0, 0)}
              end={thresholdGeom.gradientEnd}
              colors={thresholdFillColors}
              positions={thresholdGeom.splitPositions}
            />
          </Path>
        </Group>
      )}
    </Group>
  );
}

/** Main shaken chart stack drawn ABOVE the left-edge fade so the line stays crisp:
 *  segment dividers, value/reference lines, the line/candles, axes, dot, degen,
 *  markers, and the loading/empty art. Background fills are in `ChartFillLayer`
 *  (below the fade); the live value text is `ChartValueOverlay` (above the fade). */
function ChartStack({ model }: { model: LiveChartModel }) {
  const {
    degenShakeTransform,
    reveal,
    engine,
    effectivePadding,
    palette,
    skiaFont,
    badgeCfg,
    valueLineCfg,
    dotY,
    allRefLines,
    resolvedSegments,
    hasRecolorSegments,
    segmentGradient,
    thresholdCfg,
    thresholdGeom,
    thresholdStrokeColors,
    formatValue,
    lineGroupOpacity,
    linePath,
    strokeWidth,
    lineProp,
    candleGroupOpacity,
    upWicksPath,
    downWicksPath,
    upBodiesPath,
    downBodiesPath,
    xAxisCfg,
    xAxisEntries,
    dotX,
    liveDotOpacity,
    pulseCfg,
    dotCfg,
    degenCfg,
    degenPack,
    degenPackRevision,
    markersActive,
    markersSV,
    renderMarker,
    emptyText,
    metricsCfg,
    layoutWidth,
  } = model;

  return (
    <Group transform={degenShakeTransform}>
      {/* Segment dividers + labels (behind the line). The scrub-focus emphasis is
          painted on the line stroke itself, below — this overlay draws no fill. */}
      {resolvedSegments.map((seg, i) => (
        <SegmentDividerOverlay
          key={`seg-${seg.from ?? "start"}-${seg.to ?? "end"}-${i}`}
          engine={engine}
          padding={effectivePadding}
          segment={seg}
          font={skiaFont}
        />
      ))}

      {/* Value line + reference line (behind chart line) */}
      {valueLineCfg && (
        <Group opacity={reveal.lineOpacity}>
          <ValueLineOverlay
            dotY={dotY}
            engine={engine}
            padding={effectivePadding}
            strokeWidth={valueLineCfg.strokeWidth}
            intervals={valueLineCfg.intervals}
            color={valueLineCfg.color ?? palette.dashLine}
          />
        </Group>
      )}

      {/* Index keys: reference lines are a positional array and two may share
          value + label (e.g. duplicate working orders at the same price), which a
          content-derived key would collapse to one. */}
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

      {/* Threshold marker line + label (behind the chart line). */}
      {thresholdCfg?.line && (
        <ThresholdLineOverlay
          engine={engine}
          padding={effectivePadding}
          lineY={thresholdGeom.lineY}
          visible={thresholdGeom.visible}
          value={thresholdCfg.value}
          cfg={thresholdCfg.line}
          palette={palette}
          font={skiaFont}
          formatValue={formatValue}
        />
      )}

      {/* Chart line (fades out in candle mode). When segments recolor the line, a
          full-width gradient paints the base color outside segments and each
          segment's color within — so the line itself is recolored/faded (alpha in
          the segment color reduces the line's opacity), not covered by an overlay. */}
      <Group opacity={lineGroupOpacity}>
        <Path
          path={linePath}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap={lineProp?.cap ?? "round"}
          strokeJoin={lineProp?.join ?? "round"}
          color={lineProp?.color ?? palette.line}
        >
          {thresholdCfg && thresholdStrokeColors ? (
            // Vertical hard split at the threshold Y — supersedes line.colors and
            // segment recoloring for the stroke while a threshold is set.
            <LinearGradient
              start={vec(0, 0)}
              end={thresholdGeom.gradientEnd}
              colors={thresholdStrokeColors}
              positions={thresholdGeom.splitPositions}
            />
          ) : hasRecolorSegments ? (
            <LinearGradient
              start={vec(0, 0)}
              end={segmentGradient.gradientEnd}
              colors={segmentGradient.colors}
              positions={segmentGradient.positions}
            />
          ) : lineProp?.colors?.length ? (
            <LinearGradient
              start={vec(0, 0)}
              end={vec(layoutWidth, 0)}
              colors={lineProp.colors}
            />
          ) : null}
        </Path>
      </Group>

      {/* Candle bodies/wicks (fades in in candle mode) */}
      <Group opacity={candleGroupOpacity}>
        <Path
          path={upWicksPath}
          style="stroke"
          strokeWidth={1}
          color={palette.wickUp}
        />
        <Path
          path={downWicksPath}
          style="stroke"
          strokeWidth={1}
          color={palette.wickDown}
        />
        <Path path={upBodiesPath} style="fill" color={palette.candleUp} />
        <Path
          path={downBodiesPath}
          style="fill"
          color={palette.candleDown}
        />
      </Group>

      {/* X-axis time labels */}
      {xAxisCfg && (
        <XAxisOverlay
          entries={xAxisEntries}
          engine={engine}
          padding={effectivePadding}
          palette={palette}
          font={skiaFont}
        />
      )}

      {/* Live dot — the badge is drawn later (after the scrub layer) so the
          scrub dim never clips the live-price badge's left edge. Hidden while
          scrubbing when a selection dot marks the scrub point instead. */}
      {dotCfg.show && (
        <Group opacity={liveDotOpacity}>
          <DotOverlay
            dotX={dotX}
            dotY={dotY}
            palette={palette}
            engine={engine}
            pulse={pulseCfg}
            radius={dotCfg.radius}
            ring={dotCfg.ring}
            color={dotCfg.color}
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
            colors={degenCfg.colors}
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
            lineData={engine.data}
            renderMarker={renderMarker}
          />
        </Group>
      )}

      {/* Threshold label badge — on top of the line/dot/markers so it's never
          painted over (the dashed marker line itself stays behind the line, above). */}
      {thresholdCfg?.line && (
        <ThresholdBadgeOverlay
          engine={engine}
          padding={effectivePadding}
          lineY={thresholdGeom.lineY}
          visible={thresholdGeom.visible}
          value={thresholdCfg.value}
          cfg={thresholdCfg.line}
          palette={palette}
          font={skiaFont}
          formatValue={formatValue}
        />
      )}

      {/* Loading / empty state — drawn with the line stack (above the fade) so the
          squiggle/empty art stays crisp, consistent with the line. */}
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
        badge={badgeCfg !== null}
        badgeTail={badgeCfg?.tail ?? true}
        badgeMetrics={metricsCfg.badge}
        emptyMetrics={metricsCfg.emptyState}
      />
    </Group>
  );
}

/** Trade-tape labels and the scrub crosshair/tooltip (drawn in canvas space, on
 *  top of the shaken stack). */
function ChartScrubLayer({ model }: { model: LiveChartModel }) {
  const {
    tradeStreamResolved,
    scrubCfg,
    degenShakeTransform,
    tradeMarkers,
    palette,
    effectivePadding,
    skiaFont,
    reveal,
    crosshair,
    isCandle,
    pulseCfg,
    dotOuterRadius,
    selectionDot,
    selectionColor,
    renderTooltip,
  } = model;

  // A custom tooltip is an RN overlay (sibling of <Canvas>), so the built-in
  // Skia tooltip is suppressed here while it's active — the line pill in line
  // mode, and the OHLC stack in candle mode (see the stack gate below).
  const customTooltipActive = renderTooltip != null;

  if (!tradeStreamResolved && !scrubCfg) return null;

  // Extend the scrub dim past the plot's right edge to fully cover the live dot
  // (with its halo) and pulse ring, all centered on that edge. The gutter
  // reserves an 8px gap beyond this for the Y-axis labels, so they stay readable.
  const liveDotExtent = Math.max(
    dotOuterRadius,
    pulseCfg ? pulseRadialOutset(pulseCfg.maxRadius, pulseCfg.strokeWidth) : 0,
  );

  return (
    <Group transform={degenShakeTransform}>
      {tradeStreamResolved && (
        <TradeStreamOverlay
          markers={tradeMarkers}
          palette={palette}
          padding={effectivePadding}
          font={skiaFont}
          opacity={reveal.dotOpacity}
          labelOffsetX={tradeStreamResolved.labelOffsetX}
        />
      )}

      {scrubCfg && (
        <CrosshairOverlay
          scrubX={crosshair.scrubX}
          crosshairOpacity={crosshair.crosshairOpacity}
          tooltipLayout={crosshair.tooltipLayout}
          engine={model.engine}
          padding={effectivePadding}
          palette={palette}
          font={skiaFont}
          showTooltip={scrubCfg.tooltip && !customTooltipActive}
          lineTop={crosshair.tooltipLineTop}
          selectionDot={selectionDot}
          selectionY={crosshair.scrubDotY}
          scrubActive={crosshair.scrubActive}
          selectionColor={selectionColor}
          dimOpacity={scrubCfg.dimOpacity}
          liveDotExtent={liveDotExtent}
          crosshairLineColor={scrubCfg.crosshairLineColor}
          crosshairDash={scrubCfg.crosshairDash}
          crosshairDimColor={scrubCfg.crosshairDimColor}
          tooltipBackground={scrubCfg.tooltipBackground}
          tooltipColor={scrubCfg.tooltipColor}
          tooltipBorderColor={scrubCfg.tooltipBorderColor}
          tooltipBorderRadius={scrubCfg.tooltipBorderRadius}
          tooltipShowValue={scrubCfg.tooltipShowValue}
          tooltipShowTime={scrubCfg.tooltipShowTime}
        >
          {/* Candle charts render a multi-line OHLC tooltip; the line
              chart falls back to CrosshairOverlay's default value/time
              body. Composed as children rather than a JSX-valued prop.
              Suppressed when a custom `renderTooltip` owns the readout. */}
          {isCandle && !customTooltipActive ? (
            <MultiSeriesTooltipStack
              tooltipLayout={crosshair.tooltipLayout}
              font={skiaFont}
              palette={palette}
            />
          ) : null}
        </CrosshairOverlay>
      )}
    </Group>
  );
}

/** Live-value text drawn as its own canvas layer, above both the area gradient
 *  and the left-edge fade, so the large number stays crisp at the left edge
 *  instead of being washed out by the fade's `dstOut` blend. */
function ChartValueOverlay({ model }: { model: LiveChartModel }) {
  const {
    showValue,
    degenShakeTransform,
    engine,
    effectivePadding,
    palette,
    valueFont,
    formatValue,
    momentumSV,
    valueMomentumColor,
    reveal,
  } = model;

  if (!showValue) return null;

  return (
    <Group transform={degenShakeTransform}>
      <Group opacity={reveal.lineOpacity}>
        <ValueTextOverlay
          engine={engine}
          padding={effectivePadding}
          palette={palette}
          font={valueFont}
          formatValue={formatValue}
          momentum={momentumSV}
          momentumColor={valueMomentumColor}
        />
      </Group>
    </Group>
  );
}

/** Live-price badge, drawn above the scrub dim so the dim never clips its left
 *  edge. Shares the degen shake transform so it tracks the shaken stack. */
function ChartBadgeLayer({ model }: { model: LiveChartModel }) {
  const { badgeCfg, badgeData, skiaFont, reveal, degenShakeTransform } = model;
  if (!badgeCfg) return null;
  return (
    <Group transform={degenShakeTransform}>
      <Group opacity={reveal.badgeOpacity}>
        <BadgeOverlay badge={badgeData} font={skiaFont} />
      </Group>
    </Group>
  );
}

/** Reference-line badges + labels, drawn ABOVE the left-edge fade so a
 *  left-pinned badge (off-axis / `labelBadge`) and any label stay crisp instead
 *  of being erased by the fade's dstOut. The lines/bands themselves render in the
 *  base pass inside ChartStack (behind the chart content). */
function ChartRefBadgeLayer({ model }: { model: LiveChartModel }) {
  const {
    allRefLines,
    engine,
    effectivePadding,
    palette,
    formatValue,
    skiaFont,
    degenShakeTransform,
  } = model;
  if (allRefLines.length === 0) return null;
  return (
    <Group transform={degenShakeTransform}>
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

/** Scrub-action ("order ticket") reticle + action badge. Drawn OUTSIDE the degen
 *  shake group so the rendered badge stays aligned with the untransformed tap
 *  hit-test; it tracks the locked reticle, not the shaken stack. */
function ChartScrubActionLayer({ model }: { model: LiveChartModel }) {
  const { scrubActionCfg, crosshair, engine, effectivePadding, palette, skiaFont } =
    model;
  if (
    !scrubActionCfg ||
    !crosshair.lockActive ||
    !crosshair.lockX ||
    !crosshair.lockY ||
    !crosshair.actionBadge
  ) {
    return null;
  }
  return (
    <ScrubActionOverlay
      lockActive={crosshair.lockActive}
      lockX={crosshair.lockX}
      lockY={crosshair.lockY}
      actionBadge={crosshair.actionBadge}
      timeBadge={crosshair.timeBadge}
      engine={engine}
      padding={effectivePadding}
      palette={palette}
      font={skiaFont}
      icon={scrubActionCfg.icon}
      lineColor={scrubActionCfg.lineColor}
      background={scrubActionCfg.background}
      iconColor={scrubActionCfg.iconColor}
    />
  );
}

export function LiveChart(props: LiveChartProps) {
  const model = useLiveChartController(props);
  const {
    rootGesture,
    backgroundColor,
    style,
    onLayout,
    accessibilityLabel,
    accessibilityRole,
    leftEdgeFadeCfg,
    effectivePadding,
    engine,
    palette,
    formatValue,
    topLabelCfg,
    bottomLabelCfg,
    markersActive,
    markersSV,
    renderMarker,
    renderTooltip,
    scrubCfg,
    crosshair,
    isCandle,
    extremaTimeOffset,
    topConnector,
    bottomConnector,
  } = model;

  return (
    <GestureDetector gesture={rootGesture}>
      <View
        style={[{ flex: 1, backgroundColor }, style]}
        onLayout={onLayout}
        accessible={accessibilityLabel != null}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
      >
        <Canvas style={{ flex: 1 }}>
          {/* Background fills first, then the left-edge fade (a canvas-space sibling
              so dstOut blends correctly), then the line stack on top — so the fade
              softens only the fills and the line stays crisp at the left edge. */}
          <ChartFillLayer model={model} />

          {leftEdgeFadeCfg && (
            <LeftEdgeFade
              paddingLeft={effectivePadding.left}
              fadeWidth={leftEdgeFadeCfg.width}
              startColor={leftEdgeFadeCfg.startColor}
              endColor={leftEdgeFadeCfg.endColor}
              engine={engine}
            />
          )}

          {/* Line stack above the fade so the line stays crisp at the left edge. */}
          <ChartStack model={model} />

          {/* "extrema-edge" connector lines (dot → edge readout), above the chart
              content so the dashed guide reads over the line / candles. */}
          <ExtremaConnectorOverlay
            engine={engine}
            padding={effectivePadding}
            extremaTimeOffset={extremaTimeOffset}
            top={topConnector}
            bottom={bottomConnector}
          />

          {/* Reference-line badges + labels above the fade so they stay crisp. */}
          <ChartRefBadgeLayer model={model} />

          <ChartValueOverlay model={model} />

          <ChartScrubLayer model={model} />

          {/* Live-price badge on top of the scrub dim so the dim never clips
              its left edge (the badge tracks the live value, not the scrub). */}
          <ChartBadgeLayer model={model} />

          {/* Scrub-action reticle + action badge — top-most, no shake transform. */}
          <ChartScrubActionLayer model={model} />
        </Canvas>

        {/* RN labels floated over the canvas (sibling of <Canvas>, an RN view).
            Pinned to the plot's top/bottom edges via the resolved padding. */}
        <AxisLabelOverlay
          topLabel={topLabelCfg}
          bottomLabel={bottomLabelCfg}
          engine={engine}
          formatValue={formatValue}
          defaultColor={palette.gridLabel}
          padding={effectivePadding}
          extremaTimeOffset={extremaTimeOffset}
        />

        {/* Custom-rendered markers — RN views floated over the canvas (non-Skia),
            pinned to each marker's live position. Sibling of <Canvas>. */}
        {markersActive && renderMarker && (
          <CustomMarkerOverlay
            markers={markersSV}
            renderMarker={renderMarker}
            engine={engine}
            padding={effectivePadding}
            lineData={engine.data}
          />
        )}

        {/* Custom scrub tooltip — an RN view floated over the canvas (non-Skia),
            positioned on the UI thread. Sibling of <Canvas>. Works in line and
            candle mode (candle exposes the OHLC via `scrubCandle`). */}
        {scrubCfg && renderTooltip && (
          <CustomTooltipOverlay
            renderTooltip={renderTooltip}
            scrubX={crosshair.scrubX}
            scrubValue={crosshair.scrubValue}
            scrubTime={crosshair.scrubTime}
            scrubActive={crosshair.scrubActive}
            scrubCandle={crosshair.scrubCandle}
            crosshairOpacity={crosshair.crosshairOpacity}
            tooltipLayout={crosshair.tooltipLayout}
            engine={engine}
            padding={effectivePadding}
            placement={scrubCfg.tooltipPlacement}
            margin={scrubCfg.tooltipMargin}
            lineTop={crosshair.tooltipLineTop}
          />
        )}
      </View>
    </GestureDetector>
  );
}
