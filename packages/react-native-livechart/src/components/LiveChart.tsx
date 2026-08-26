import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

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
  Rect,
  vec,
} from "@shopify/react-native-skia";

import {
  DEFAULT_ACCENT_COLOR,
  HOLD_TO_SCRUB_MS,
  SCRUB_OVERLAY_FADE_MS,
} from "../constants";
import {
  resolveAreaDots,
  resolveAxisLabel,
  resolveBadge,
  resolveCandleGaps,
  resolveDegen,
  resolveDot,
  resolveGradient,
  resolveGridStyle,
  resolveLeftEdgeFade,
  resolveLoading,
  resolveMarkerCluster,
  resolveMetrics,
  resolvePulse,
  resolveScrub,
  resolveScrubAction,
  resolveTransitions,
  resolveFling,
  resolveOverscroll,
  resolveReturnToLiveMs,
  resolveSelectionDot,
  resolveThreshold,
  THRESHOLD_FILL_OPACITY_DEFAULT,
  resolveTradeStream,
  resolveValueLine,
  resolveVolume,
  resolveZoom,
  resolveXAxis,
  resolveYAxis,
} from "../core/resolveConfig";
import type {
  ResolvedCandleGapsConfig,
  ResolvedThresholdConfig,
} from "../core/resolveConfig";
import {
  liveIndicatorScrollOpacity,
  resolveHideLiveOnScrollBack,
} from "../core/liveIndicatorVisibility";
import { resolveSegment, type ResolvedSegment } from "../core/resolveSegment";
import { useLiveChartEngine } from "../core/useLiveChartEngine";
import {
  computeCandleFocusPassOpacity,
  computeCandleFocusClip,
  HIDDEN_CANDLE_FOCUS_CLIP,
} from "../draw/candle";
import { dotGlowRadialOutset, pulseRadialOutset } from "../draw/line";
import { resolveChartLayout } from "../hooks/resolveChartLayout";
import { useBadge } from "../hooks/useBadge";
import { useCandleGapPaths } from "../hooks/useCandleGapPaths";
import { useCandlePaths, useCandleWidthLerp } from "../hooks/useCandlePaths";
import { useCanvasLayout } from "../hooks/useCanvasLayout";
import { useChartColors } from "../hooks/useChartColors";
import { useChartOverlayContext } from "../hooks/useChartOverlayContext";
import { useChartPaths } from "../hooks/useChartPaths";
import { useChartReveal } from "../hooks/useChartReveal";
import { useChartSkiaFont } from "../hooks/useChartSkiaFont";
import { useCrosshair } from "../hooks/useCrosshair";
import { useDegen } from "../hooks/useDegen";
import { useLiveChartHasData } from "../hooks/useLiveChartHasData";
import { useLiveDot } from "../hooks/useLiveDot";
import { useLineGapPaths } from "../hooks/useLineGapPaths";
import { useMarkers } from "../hooks/useMarkers";
import { useReferenceDrag } from "../hooks/useReferenceDrag";
import { useReferenceLinePress } from "../hooks/useReferenceLinePress";
import { useModeBlend } from "../hooks/useModeBlend";
import { resolveMomentumProp, useMomentum } from "../hooks/useMomentum";
import { AXIS_GRAB_MIN_PX, usePanScroll } from "../hooks/usePanScroll";
import { resetPinchZoom, usePinchZoom } from "../hooks/usePinchZoom";
import {
  SERIES_INDICATOR_FADE_MS,
  useSeriesIndicatorOpacity,
} from "../hooks/useSeriesIndicatorOpacity";
import { useVisibleRange } from "../hooks/useVisibleRange";
import { useSingleChartReverseMorphInputs } from "../hooks/useReverseMorphEngineInputs";
import {
  useThreshold,
  useThresholdSeries,
  useThresholdSplitUniforms,
} from "../hooks/useThreshold";
import { useTradeStream } from "../hooks/useTradeStream";
import { useXAxis } from "../hooks/useXAxis";
import { useYAxis } from "../hooks/useYAxis";
import {
  formatTime as defaultFormatTime,
  formatValue as defaultFormatValue,
} from "../lib/format";
import { MONO_FONT_FAMILY } from "../lib/monoFontFamily";
import {
  candleGapBucketStartAtTime,
  candleGapDefaultLabel,
} from "../math/candleGaps";
import { computeScrubDotY } from "../hooks/crosshairShared";
import {
  groupReferenceLines,
  type ReferenceGrouping,
} from "../math/referenceGroup";
import {
  collectReferenceValues,
  referenceLineForm,
  referenceLineReactKeys,
  resolveReferenceGroupBadge,
} from "../math/referenceLines";
import {
  applyPaletteOverride,
  leftEdgeFadeColorsFromBgRgb,
  parseColorRgb,
  parseColorRgba,
  resolveTheme,
} from "../theme";
import type {
  CandlePoint,
  LiveChartHandle,
  LiveChartPalette,
  LiveChartPoint,
  LiveChartProps,
  Marker,
  ReferenceLine,
} from "../types";
import {
  ThresholdBadgeOverlay,
  ThresholdLineOverlay,
} from "./ThresholdLineOverlay";
import {
  THRESHOLD_SPLIT_AVAILABLE,
  ThresholdSplitShader,
} from "./ThresholdSplitShader";
import { AreaDotsOverlay } from "./AreaDotsOverlay";
import { AxisLabelOverlay } from "./AxisLabelOverlay";
import {
  ExtremaConnectorOverlay,
  labelConnector,
} from "./ExtremaConnectorOverlay";
import { CustomMarkerOverlay } from "./CustomMarkerOverlay";
import {
  CustomReferenceLineOverlay,
  customReferenceLineFlags,
} from "./CustomReferenceLineOverlay";
import { CustomTooltipOverlay } from "./CustomTooltipOverlay";
import { BadgeOverlay } from "./BadgeOverlay";
import { ChartOverlayLayer } from "./ChartOverlayLayer";
import { CrosshairOverlay } from "./CrosshairOverlay";
import { DegenParticlesOverlay } from "./DegenParticlesOverlay";
import { DotOverlay } from "./DotOverlay";
import { LeftEdgeFade } from "./LeftEdgeFade";
import { LoadingOverlay } from "./LoadingOverlay";
import { MarkerOverlay } from "./MarkerOverlay";
import { MultiSeriesTooltipStack } from "./MultiSeriesTooltipStack";
import { ValueTextOverlay } from "./ValueTextOverlay";
import { ReferenceLineGroupOverlay } from "./ReferenceLineGroupOverlay";
import { ReferenceLineOverlay } from "./ReferenceLineOverlay";
import { ScrubActionOverlay } from "./ScrubActionOverlay";
import { SegmentDividerOverlay } from "./SegmentDividerOverlay";
import { SegmentLineGradient } from "./SegmentLineGradient";
import { TradeStreamOverlay } from "./TradeStreamOverlay";
import { ValueLineOverlay } from "./ValueLineOverlay";
import { XAxisOverlay } from "./XAxisOverlay";
import { YAxisOverlay } from "./YAxisOverlay";

/** Stable empty grouping result (identity-stable so downstream worklets don't
 *  re-run) used when reference-line grouping is off. */
const EMPTY_GROUPING: ReferenceGrouping = { hidden: [], groups: [] };

/** Stable empty number array so the live-reference-values worklet stays
 *  referentially stable (no engine re-fit) when no line is draggable. */
const EMPTY_NUMS: number[] = [];

/**
 * Color stops for the threshold's hard-split vertical gradient. Both arrays pair
 * with the `[0, t, t, 1]` split positions: index 0–1 paint above the split,
 * 2–3 below. `stroke` is full-strength; `fill` is the same hues at the config's
 * band opacity (`fill: { opacity }`, default `0.16`). Defaults to the palette's
 * semantic up-green / down-red when colors are omitted.
 */
function thresholdStops(
  cfg: ResolvedThresholdConfig,
  palette: LiveChartPalette,
): { stroke: string[]; fill: string[] } {
  const above = cfg.aboveColor ?? palette.candleUp;
  const below = cfg.belowColor ?? palette.candleDown;
  const [ar, ag, ab] = parseColorRgb(above);
  const [br, bg, bb] = parseColorRgb(below);
  const aboveFill = `rgba(${ar}, ${ag}, ${ab}, ${cfg.fillOpacity})`;
  const belowFill = `rgba(${br}, ${bg}, ${bb}, ${cfg.fillOpacity})`;
  return {
    stroke: [above, above, below, below],
    fill: [aboveFill, aboveFill, belowFill, belowFill],
  };
}

/** Stand-in split color when no threshold is set (the shader is never rendered then). */
const THRESHOLD_FALLBACK_COLOR = [0, 0, 0, 1];

/**
 * Above/below split colors as straight-alpha `[r, g, b, a]` vec4s (channels 0..1)
 * for the time-varying {@link ThresholdSplitShader}: full-strength `stroke*` for
 * the line, band-opacity `fill*` for the band — the vec4 equivalent of
 * {@link thresholdStops}' gradient color array. Takes the already
 * palette-defaulted color strings; an rgba() alpha carries into the stroke and
 * multiplies the band opacity (matching what the constant gradient's raw-string
 * stroke does).
 */
function thresholdSplitColorVecs(
  above: string,
  below: string,
  fillOpacity: number,
): {
  strokeAbove: number[];
  strokeBelow: number[];
  fillAbove: number[];
  fillBelow: number[];
} {
  const [ar, ag, ab, aa] = parseColorRgba(above);
  const [br, bg, bb, ba] = parseColorRgba(below);
  const a = [ar / 255, ag / 255, ab / 255];
  const b = [br / 255, bg / 255, bb / 255];
  return {
    strokeAbove: [a[0], a[1], a[2], aa],
    strokeBelow: [b[0], b[1], b[2], ba],
    fillAbove: [a[0], a[1], a[2], aa * fillOpacity],
    fillBelow: [b[0], b[1], b[2], ba * fillOpacity],
  };
}

/** Transparent vec4 — the band shader's "threshold ended" rest color. */
const TRANSPARENT_VEC4 = [0, 0, 0, 0];

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
  areaDots,
  line: lineProp,
  font: fontProp,
  insets,
  style,
  seriesOpacity,
  canvasMode = "transparent",

  // ── Candlestick ─────────────────────────────────────────────────────────
  mode = "line",
  candles,
  candleWidth = 60,
  liveCandle,
  candleGaps,
  lineGaps,
  volume,

  // ── Behaviour ───────────────────────────────────────────────────────────
  timeWindow = 30,
  paused = false,
  loading = false,
  transitions,
  // `static` is a reserved word — alias it so the destructure parses.
  static: isStatic = false,
  snapKey,
  smoothing = 0.08,
  exaggerate = false,
  nonNegative = false,
  maxValue,
  yRangeScale,
  windowBuffer = 0,
  nowOverride,
  timeScroll = false,
  returnToLive,
  zoom = false,
  accessibilityLabel,
  accessibilityRole = "image",
  emptyText = "No data",
  formatValue = defaultFormatValue,
  formatTime = defaultFormatTime,

  // ── Overlays ────────────────────────────────────────────────────────────
  yAxis = true,
  xAxis = true,
  axisAutoHide = false,
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
  onMarkerPress,
  markerHitRadius = 16,
  markerCluster,
  renderMarker,
  renderTooltip,
  renderOverlay,
  renderReferenceLine,
  renderOffAxisReferenceLine,
  referenceLineGrouping,
  leftEdgeFade = true,

  // ── Callbacks ───────────────────────────────────────────────────────────
  onScrub,
  onScrubAction,
  onReferenceLinePress,
  onGestureStart,
  onGestureEnd,
  onVisibleRangeChange,
  onReachStart,
  onDegenShake,
}: LiveChartProps) {
  const fullSeriesOpacity = useSharedValue(1);
  const resolvedSeriesOpacity = seriesOpacity ?? fullSeriesOpacity;
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
  // Scrub + scrub-action are on-demand touch gestures (event-driven, no per-frame
  // loop), so they stay live on static charts — `static` suppresses the continuous
  // render loop, not interaction. A still sparkline in a list can still be scrubbed.
  const scrubActionCfg = resolveScrubAction(scrubAction);
  // Volume bars sit below the candles — a candle-mode-only feature (inert in
  // line mode, like the candle paths themselves).
  const volumeCfg = isCandle ? resolveVolume(volume) : null;
  const chartGapsCfg = resolveCandleGaps(isCandle ? candleGaps : lineGaps);
  const candleGapsCfg = isCandle ? chartGapsCfg : null;
  const lineGapsCfg = isCandle ? null : chartGapsCfg;
  const volumeBandHeight = volumeCfg?.maxHeight ?? 0;
  const gradientCfg = isCandle ? null : resolveGradient(gradient);
  // Dot-lattice area fill (clipped to the under-line region). Inert in candle
  // mode, same as the gradient fill.
  const areaDotsCfg = isCandle ? null : resolveAreaDots(areaDots);
  // Threshold split is a line-mode feature (candle bodies carry their own up/down
  // colors), so it's inert in candle mode — same as the area gradient.
  const thresholdCfg = isCandle ? null : resolveThreshold(threshold);
  const thresholdSeriesSV = thresholdCfg?.series ?? null;
  const thresholdIsSeries =
    thresholdSeriesSV !== null || Array.isArray(thresholdCfg?.value);
  const valueLineCfg = resolveValueLine(valueLine);
  // Static charts run zero loops: force the pulse off so its `withRepeat`-driven
  // ring never starts (the DotOverlay reads `pulseCfg`, so null = no pulse).
  const pulseCfg = isStatic ? null : resolvePulse(pulse);
  const dotCfg = resolveDot(dot);
  // `badge.followViewEdge` wins over `dot.trackWhileParked`: an edge-pinned dot
  // must stay aligned with its badge, so the tracking flag is ignored.
  const dotTracksParked =
    dotCfg.trackWhileParked && !(badgeCfg?.followViewEdge ?? false);
  const selectionDotCfg = resolveSelectionDot(selectionDot);
  // Outer visible footprint of the dot, including its crisp ring and optional
  // blurred glow. Used by scrub dimming so neither effect leaks through.
  const dotOuterRadius = Math.max(
    dotCfg.radius + (dotCfg.ring?.width ?? 0),
    dotCfg.glow ? dotGlowRadialOutset(dotCfg.glow.radius, dotCfg.glow.blur) : 0,
  );
  const gridStyleCfg = resolveGridStyle(gridStyle);
  // Static charts run zero loops: force degen off so `useDegen`'s frame callback
  // never starts (also passed `isStatic` below as a belt-and-braces autostart gate).
  const degenCfg = isStatic ? null : resolveDegen(degen);
  const tradeStreamResolved = resolveTradeStream(tradeStream);
  const metricsCfg = resolveMetrics(metrics);

  const chartGapBands: ReferenceLine[] =
    chartGapsCfg?.gaps.flatMap((gap) => {
      const gapStyle = chartGapsCfg.styles[gap.kind];
      const band = gapStyle.band;
      if (band === null) return [];
      const label = gapStyle.label;
      return [
        {
          id: `chart-gap:${gap.kind}:${gap.from}:${gap.to}`,
          from: gap.from,
          to: gap.to,
          label:
            label === null
              ? undefined
              : (gap.label ?? candleGapDefaultLabel(gap.kind)),
          color: band.borderColor,
          fillColor: band.fillColor,
          fillOpacity: band.fillOpacity,
          strokeOpacity: band.borderOpacity,
          strokeWidth: band.borderWidth > 0 ? band.borderWidth : undefined,
          intervals: band.intervals,
          labelColor: label?.color,
          labelPosition: label?.position,
        },
      ];
    }) ?? [];
  // Gap bands append after consumer reference lines so public line indices stay
  // stable for callbacks. Time bands contribute no Y values or press targets.
  const allRefLines = [...(referenceLines ?? []), ...chartGapBands];
  const refValues = collectReferenceValues(allRefLines);

  // Per-line live value overrides + drag flags for draggable lines and the custom
  // `renderReferenceLine` slot. One array SharedValue each (the line count varies,
  // so a single SharedValue beats N hooks). Seeded from each line's static `value`;
  // the drag gesture overwrites a slot, and the effect re-seeds slots not being
  // dragged when the props change (so a controlled `value` flows back in).
  const dragValues = useSharedValue<number[]>([]);
  const dragActive = useSharedValue<boolean[]>([]);
  // Last `value` props used to seed each slot, so reconciliation can tell a
  // controlled prop change (adopt it) from an unchanged prop (keep the dragged
  // value — uncontrolled persistence) without resetting a drop on every re-render.
  const seededRef = useRef<(number | undefined)[]>([]);
  const refValueSig = allRefLines.map((l) => l.value ?? "_").join(",");
  useEffect(() => {
    const active = dragActive.get();
    const cur = dragValues.get();
    const seeded = seededRef.current;
    dragValues.set(
      allRefLines.map((l, i) => {
        const prop = l.value ?? 0;
        if (active[i]) return cur[i] ?? prop; // mid-drag → keep the dragged value
        if (l.value !== seeded[i]) return prop; // prop changed → adopt (controlled)
        return cur[i] ?? prop; // unchanged → keep current (uncontrolled persist)
      }),
    );
    seededRef.current = allRefLines.map((l) => l.value);
    if (dragActive.get().length !== allRefLines.length) {
      dragActive.set(allRefLines.map((_, i) => active[i] ?? false));
    }
    // allRefLines is rebuilt every render; key off the value signature + length.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refValueSig, allRefLines.length]);

  // Form-A lines a custom `renderReferenceLine` owns → suppress their built-in tag
  // (no double-draw). Probed on the JS thread, index-aligned with `allRefLines`.
  // Semantic gap bands are library-owned annotations: do not leak them through
  // the consumer's reference-line renderer or change its callback cardinality.
  const consumerRefLines = referenceLines ?? [];
  const refLineCustom = [
    ...customReferenceLineFlags(consumerRefLines, renderReferenceLine),
    ...chartGapBands.map(() => false),
  ];
  // An off-axis renderer replaces only the edge-pinned tag. A full custom tag
  // takes precedence for the same line to avoid mounting two native tags.
  const refLineOffAxisCustom = [
    ...customReferenceLineFlags(
      consumerRefLines,
      renderOffAxisReferenceLine,
      "off-axis",
    ),
    ...chartGapBands.map(() => false),
  ].map((custom, index) => custom && !refLineCustom[index]);
  const refLineKeys = referenceLineReactKeys(allRefLines);
  // RN custom tags report their measured widths here so the Skia connector can
  // start after the native badge instead of the hidden built-in pill.
  const refLineCustomTagWidths = useSharedValue<number[]>([]);

  // Live Y values of the *draggable* Form-A lines, folded into the engine's
  // axis-range fit so dragging a line toward / past the visible edge expands the
  // range and the axis follows the finger in one motion (the committed values are
  // already in `refValues`). `excludeFromRange` lines opt out, matching the static
  // fit. Identity-stable (no re-fit) when nothing is draggable.
  //
  // `threshold.includeInRange` rides the same channel: the constant benchmark
  // contributes its live value; a series contributes its window min/max
  // (respecting `extendToNow`), so an off-range break-even expands the axis and
  // stays on-plot like a reference line would.
  const draggableRefIdx: number[] = [];
  for (let i = 0; i < allRefLines.length; i++) {
    const line = allRefLines[i];
    if (
      line.draggable &&
      !line.excludeFromRange &&
      referenceLineForm(line) === "line"
    ) {
      draggableRefIdx.push(i);
    }
  }
  const thresholdInRange = thresholdCfg?.includeInRange === true;
  // Constant benchmark → its live value rides this channel. A series threshold
  // is folded inside the engine tick instead (`thresholdRangePoints`), which
  // already knows the window bounds for the min/max.
  const thresholdRangeValueSV =
    thresholdInRange &&
    thresholdCfg?.value != null &&
    !Array.isArray(thresholdCfg.value)
      ? thresholdCfg.value
      : null;
  const liveRefValues = useDerivedValue<number[]>(() => {
    if (draggableRefIdx.length === 0 && thresholdRangeValueSV === null)
      return EMPTY_NUMS;
    const out: number[] = [];
    if (draggableRefIdx.length > 0) {
      const dv = dragValues.get();
      for (let k = 0; k < draggableRefIdx.length; k++) {
        const v = dv[draggableRefIdx[k]];
        if (v != null) out.push(v);
      }
    }
    if (thresholdRangeValueSV !== null) {
      const v = thresholdRangeValueSV.get();
      if (Number.isFinite(v)) out.push(v);
    }
    return out;
  });

  // Reference-line grouping (collapse near-value handles). Resolved once; the
  // per-frame clustering runs on the UI thread (see ReferenceLineGroupOverlay).
  const refGroupingCfg =
    typeof referenceLineGrouping === "object"
      ? referenceLineGrouping
      : undefined;
  const refGroupingRadius = referenceLineGrouping
    ? (refGroupingCfg?.radius ?? 18)
    : null;
  // Count-pill styling (same style/shape config as a per-line badge) + count
  // formatter. Resolved once; theme color defaults are applied in the overlay.
  const refGroupBadge = resolveReferenceGroupBadge(refGroupingCfg?.badge);
  const refGroupFormat = refGroupingCfg?.format;

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

  // Per-badge font (size/family/weight) override; reuses the chart font when
  // none of the badge font knobs are set, so the gutter sizing is unchanged.
  const badgeHasFontOverride =
    badgeCfg?.fontSize != null ||
    badgeCfg?.fontFamily != null ||
    badgeCfg?.fontWeight != null;
  const badgeFontOverride = useChartSkiaFont(
    badgeHasFontOverride
      ? {
          ...fontProp,
          fontFamily: badgeCfg?.fontFamily ?? fontProp?.fontFamily,
          fontSize: badgeCfg?.fontSize ?? fontProp?.fontSize,
          fontWeight: badgeCfg?.fontWeight ?? fontProp?.fontWeight,
        }
      : fontProp,
    MONO_FONT_FAMILY,
    palette.labelFontSize,
  );
  const badgeFont = badgeHasFontOverride ? badgeFontOverride : skiaFont;

  // Per-badge font for the grouping count pill (same override pattern as above).
  const refGroupBadgeHasFont =
    refGroupBadge.fontSize != null ||
    refGroupBadge.fontFamily != null ||
    refGroupBadge.fontWeight != null;
  const refGroupBadgeFontOverride = useChartSkiaFont(
    refGroupBadgeHasFont
      ? {
          ...fontProp,
          fontFamily: refGroupBadge.fontFamily ?? fontProp?.fontFamily,
          fontSize: refGroupBadge.fontSize ?? fontProp?.fontSize,
          fontWeight: refGroupBadge.fontWeight ?? fontProp?.fontWeight,
        }
      : fontProp,
    MONO_FONT_FAMILY,
    palette.labelFontSize,
  );
  const refGroupBadgeFont = refGroupBadgeHasFont
    ? refGroupBadgeFontOverride
    : skiaFont;

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reanimated: seed from the SharedValue outside render to avoid strict-mode access warnings
    setValueLayoutSample(value.get());
  }, [value]);

  // `scrolledBack` mirrors the UI-thread scroll state (engine.viewEnd != null)
  // onto the JS thread (set by the reaction below, after the engine exists).
  const [scrolledBack, setScrolledBack] = useState(false);
  const timeScrollEnabled = Boolean(timeScroll) && !isStatic;
  // Glide duration for the return-to-live animation (0 = instant). A sibling of
  // `timeScroll` so it survives `timeScroll={false}` (the disable that triggers it).
  const returnToLiveMs = resolveReturnToLiveMs(returnToLive);
  // Overscroll fraction ([0, 1)) — how far pan/zoom may travel past the data
  // bounds into blank space. 0 (the default) keeps the classic hard stops.
  const timeScrollOverscroll = timeScrollEnabled
    ? resolveOverscroll(timeScroll)
    : 0;
  // Release inertia (fling) — `timeScroll.fling: false` stops the pan dead.
  const timeScrollFling = resolveFling(timeScroll);
  const zoomCfg = resolveZoom(zoom);
  const zoomEnabled = zoomCfg !== null && !isStatic;

  const yAxisFloat = yAxisCfg?.float ?? false;
  // With timeScroll, the floating full-width plot engages only while scrolled
  // back; at the live edge the chart keeps a normal right gutter so the
  // line/candles don't sit under the floating y-axis labels + badge. Without
  // timeScroll, float behaves as before (always full-width).
  const effectiveYAxisFloat =
    yAxisFloat && (!timeScrollEnabled || scrolledBack);
  const { strokeWidth, padding: effectivePadding } = resolveChartLayout({
    palette,
    lineWidthOverride: lineProp?.width,
    insetsOverride: insets,
    yAxis: yAxisCfg !== null,
    yAxisFloat: effectiveYAxisFloat,
    badge: badgeCfg !== null,
    badgeMetrics: metricsCfg.badge,
    badgeUsesRightGutter,
    badgeShowTail: badgeCfg?.tail ?? true,
    xAxis: xAxisCfg !== null,
    font: skiaFont,
    formatValue,
    currentValue: valueLayoutSample,
    pulse: pulseConfig,
    dotGlow: dotCfg.glow,
    volumeBandHeight,
  });

  // ── Reveal state ────────────────────────────────────────────
  // ≥2 line points or ≥2 committed candles; morphT=1 only when !loading && hasData.
  const { hasData } = useLiveChartHasData({
    isCandle,
    data,
    candles,
  });

  // Resolve the loading shell: null = not loading, else the styled config (a
  // non-null result is the "is loading" flag and carries the look).
  const loadingCfg = resolveLoading(loading);
  const loadingActive = loadingCfg !== null;
  const transitionsCfg = resolveTransitions(transitions);
  const reveal = useChartReveal(
    loadingActive,
    hasData,
    isStatic,
    transitionsCfg.reveal,
  );
  const seriesIndicatorOpacity = useSeriesIndicatorOpacity(
    resolvedSeriesOpacity,
    isStatic || transitionsCfg.reveal === 0 ? 0 : SERIES_INDICATOR_FADE_MS,
  );

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
    snapKey,
    scrollEnabled: timeScrollEnabled,
    allowFutureViewEnd: timeScrollOverscroll > 0,
    returnToLiveMs,
    smoothing,
    adaptiveSpeedBoost: metricsCfg.motion.adaptiveSpeedBoost,
    exaggerate,
    referenceValues: refValues,
    liveReferenceValues: liveRefValues,
    // Series threshold with `includeInRange`: the tick folds its window min/max
    // into the Y-range fit (the constant form rides `liveReferenceValues`).
    thresholdRangePoints:
      thresholdInRange && thresholdIsSeries
        ? (thresholdSeriesSV ?? (thresholdCfg?.value as LiveChartPoint[]))
        : undefined,
    thresholdRangeExtendToNow: thresholdCfg?.extendToNow ?? true,
    nonNegative,
    maxValue,
    yRangeScale,
    windowBuffer,
    nowOverride,
    mode,
    candles: isCandle ? candlesEngine : candles,
    liveCandle: isCandle ? liveEngine : liveCandle,
    candleGaps: candleGapsCfg?.gaps,
    candleGapBridgeNoTrades:
      Boolean(candleGapsCfg?.styles["no-trades"].bridge),
    candleGapBridgeUnavailable:
      Boolean(candleGapsCfg?.styles.unavailable.bridge),
    candleGapBridgeUnknown:
      Boolean(candleGapsCfg?.styles.unknown.bridge),
  });

  // Mirror the UI-thread scroll state to React so the floating y-axis can keep
  // a right gutter at the live edge and collapse it only while scrolled back.
  // Fires once per null↔frozen transition. `viewEnd` is only non-null while
  // time-scroll is enabled and actively scrolled (the engine resets it to null
  // when time-scroll is disabled — see #164), so we don't gate on
  // `timeScrollEnabled` here: that would strand `scrolledBack` at `true` after a
  // disable-while-scrolled, wrongly floating the y-axis on a later re-enable.
  useAnimatedReaction(
    () => engine.viewEnd.value != null,
    /* istanbul ignore next -- Reanimated reaction; state mirrored on the JS thread, not exercised under Jest */
    (isScrolled, prev) => {
      if (isScrolled !== prev && yAxisFloat) {
        scheduleOnRN(setScrolledBack, isScrolled);
      }
    },
  );

  // ── Mode crossfade (line ↔ candle) ──────────────────────────────────
  const { lineGroupOpacity, candleGroupOpacity } = useModeBlend(
    isCandle,
    reveal.lineOpacity,
    transitionsCfg.mode,
  );

  // ── Per-frame derived values ───────────────────────────────────────────
  const { layoutWidth, layoutHeight, onLayout } = useCanvasLayout(engine);

  // Reference-line grouping: cluster Form-A lines by their per-frame value-Y so a
  // stack of nearby orders collapses into one count handle. `groupHidden` suppresses
  // the clustered lines' individual tags; the count pills read `refGroupResult`.
  // Identity-stable (no work) when grouping is off.
  const refGroupResult = useDerivedValue<ReferenceGrouping>(() => {
    if (refGroupingRadius == null) return EMPTY_GROUPING;
    const ch = engine.canvasHeight.get();
    const dMin = engine.displayMin.get();
    const dMax = engine.displayMax.get();
    const top = effectivePadding.top;
    const bottom = ch - effectivePadding.bottom;
    const ys: number[] = [];
    for (let i = 0; i < allRefLines.length; i++) {
      const l = allRefLines[i];
      // Skip bands and lines a custom `renderReferenceLine` owns — a custom tag
      // draws itself and isn't suppressed by grouping, so folding it into a
      // built-in count pill would double-count it (counted *and* still shown).
      if (
        referenceLineForm(l) !== "line" ||
        l.value === undefined ||
        refLineCustom[i] ||
        refLineOffAxisCustom[i]
      ) {
        ys.push(-1);
        continue;
      }
      const v = dragValues.get()[i] ?? l.value;
      const y = computeScrubDotY(
        v,
        dMin,
        dMax,
        ch,
        top,
        effectivePadding.bottom,
      );
      ys.push(y < 0 ? -1 : Math.min(bottom, Math.max(top, y)));
    }
    return groupReferenceLines(ys, refGroupingRadius);
  });
  const groupHidden = useDerivedValue<boolean[]>(
    () => refGroupResult.get().hidden,
  );

  // Threshold split geometry. Two forms, picked at render by `Array.isArray` (no
  // SharedValue read): a constant `SharedValue<number>` benchmark drives the
  // vertical hard-stop gradient (`thresholdGeom`); a time-varying `LiveChartPoint[]`
  // series drives the per-fragment split shader (`thresholdSeriesGeom`). Both hooks
  // run unconditionally — the unused one short-circuits cheaply on the UI thread.
  const thresholdValue = thresholdCfg?.value ?? emptyThresholdValue;
  // An empty series (e.g. threshold history not fetched yet) must not paint: no
  // band, no shader-forced stroke color — unlike the constant form, "no points
  // yet" is a reachable state and should look like "no threshold". For the live
  // `series` SharedValue form the emptiness lives on the UI thread, so mirror it
  // to React state (fires only on empty↔non-empty transitions).
  const [svSeriesNonEmpty, setSvSeriesNonEmpty] = useState(false);
  useAnimatedReaction(
    () => (thresholdSeriesSV ? thresholdSeriesSV.get().length > 0 : false),
    /* istanbul ignore next -- Reanimated reaction; state mirrored on the JS thread, not exercised under Jest */
    (hasPts, prev) => {
      if (hasPts !== prev) scheduleOnRN(setSvSeriesNonEmpty, hasPts);
    },
  );
  const thresholdSeriesHasPoints = thresholdSeriesSV
    ? svSeriesNonEmpty
    : Array.isArray(thresholdCfg?.value) && thresholdCfg.value.length > 0;
  const thresholdGeom = useThreshold(engine, effectivePadding, thresholdValue);
  const thresholdSeriesGeom = useThresholdSeries(
    engine,
    effectivePadding,
    thresholdValue,
    thresholdSeriesSV,
    thresholdCfg?.extendToNow ?? true,
  );
  const thresholdStopColors = thresholdCfg
    ? thresholdStops(thresholdCfg, palette)
    : null;

  // Split colors as vec4s for the series shader, memoized on the *resolved*
  // color strings + opacity (so a threshold added after mount with default
  // colors still computes, and the per-frame uniforms worklet isn't rebuilt
  // every render). `strokeRest` is the plain line color painted right of the
  // `extendToNow: false` cutoff.
  const thresholdSplitAbove = thresholdCfg
    ? (thresholdCfg.aboveColor ?? palette.candleUp)
    : null;
  const thresholdSplitBelow = thresholdCfg
    ? (thresholdCfg.belowColor ?? palette.candleDown)
    : null;
  const thresholdFillOpacity =
    thresholdCfg?.fillOpacity ?? THRESHOLD_FILL_OPACITY_DEFAULT;
  const thresholdLineColorStr = lineProp?.color ?? palette.line;
  const thresholdVecs = useMemo(
    () =>
      thresholdSplitAbove !== null && thresholdSplitBelow !== null
        ? {
            ...thresholdSplitColorVecs(
              thresholdSplitAbove,
              thresholdSplitBelow,
              thresholdFillOpacity,
            ),
            strokeRest: (() => {
              const [r, g, b, a] = parseColorRgba(thresholdLineColorStr);
              return [r / 255, g / 255, b / 255, a];
            })(),
          }
        : null,
    [
      thresholdSplitAbove,
      thresholdSplitBelow,
      thresholdFillOpacity,
      thresholdLineColorStr,
    ],
  );
  const thresholdStrokeUniforms = useThresholdSplitUniforms(
    thresholdSeriesGeom.samples,
    engine,
    effectivePadding,
    thresholdVecs?.strokeAbove ?? THRESHOLD_FALLBACK_COLOR,
    thresholdVecs?.strokeBelow ?? THRESHOLD_FALLBACK_COLOR,
    thresholdVecs?.strokeRest ?? THRESHOLD_FALLBACK_COLOR,
    thresholdSeriesGeom.clipRightX,
  );
  const thresholdFillUniforms = useThresholdSplitUniforms(
    thresholdSeriesGeom.samples,
    engine,
    effectivePadding,
    thresholdVecs?.fillAbove ?? THRESHOLD_FALLBACK_COLOR,
    thresholdVecs?.fillBelow ?? THRESHOLD_FALLBACK_COLOR,
    TRANSPARENT_VEC4,
    thresholdSeriesGeom.clipRightX,
  );

  // Marker line + badge sources: the series anchors at the value-at-now (flat-
  // extended past its last point); the constant case at the single benchmark Y.
  // The badge gets its own visibility — it's pinned at the value-at-now Y, which
  // can be off-plot while older polyline segments are still visible.
  const thresholdMarkerLineY = thresholdIsSeries
    ? thresholdSeriesGeom.currentLineY
    : thresholdGeom.lineY;
  const thresholdMarkerVisible = thresholdIsSeries
    ? thresholdSeriesGeom.visible
    : thresholdGeom.visible;
  const thresholdBadgeVisible = thresholdIsSeries
    ? thresholdSeriesGeom.currentVisible
    : thresholdGeom.visible;
  const thresholdMarkerValue =
    thresholdCfg && !thresholdIsSeries && !Array.isArray(thresholdCfg.value)
      ? (thresholdCfg.value ?? thresholdSeriesGeom.currentValue)
      : thresholdSeriesGeom.currentValue;
  const thresholdSeriesPts = thresholdIsSeries
    ? thresholdSeriesGeom.screenPts
    : undefined;

  // Straight polyline instead of the monotone cubic when line.curve === "linear".
  // Shared by the path builders and the marker anchoring so glyphs sit on the
  // rendered line rather than the phantom spline.
  const lineIsLinear = lineProp?.curve === "linear";

  const { linePath, fillPath, thresholdFillPath } = useChartPaths(
    engine,
    effectivePadding,
    reveal.morphT,
    // Constant threshold band closes at a single Y (the series closes along the
    // polyline passed as the last arg below).
    thresholdCfg?.fill && !thresholdIsSeries ? thresholdGeom.lineY : undefined,
    lineIsLinear,
    // The plotted line independently selects the visible edge while historical;
    // badge/live-indicator options affect overlays only.
    // Match the standalone loading squiggle's wave during the reveal morph.
    loadingCfg?.amplitude,
    loadingCfg?.speed,
    // Time-varying threshold band: bottom edge built from the shader's samples
    // (so the band matches the shader and doesn't bleed at step risers). An empty
    // series builds no band (its samples are all the far-below fallback, which
    // would tint the entire area under the line).
    thresholdCfg?.fill && thresholdSeriesHasPoints
      ? thresholdSeriesGeom.samples
      : undefined,
    lineProp?.simplify,
    lineGapsCfg?.gaps,
  );

  // Area-dots fill shader color as a vec4 (channels 0..1), with the config
  // `opacity` folded into the alpha. Defaults to a faint tint of the line/accent
  // color (theme-aware) so out-of-the-box dots read as a subtle field.
  const areaDotRgb = parseColorRgb(lineProp?.color ?? palette.line);
  const [adR, adG, adB, adA] = parseColorRgba(
    areaDotsCfg?.color ??
      `rgba(${areaDotRgb[0]}, ${areaDotRgb[1]}, ${areaDotRgb[2]}, 0.22)`,
  );
  const areaDotColorVec = [
    adR / 255,
    adG / 255,
    adB / 255,
    adA * (areaDotsCfg?.opacity ?? 1),
  ];

  const { dotX, dotY } = useLiveDot(
    engine,
    effectivePadding,
    engine.edgeValue,
    badgeCfg?.followViewEdge ?? false,
    dotCfg.trackWhileParked,
  );

  const momentumSV = useMomentum(engine, momentum);
  // A follow-edge badge must derive its color from the same historical point
  // as its value and position. While following live, reuse the normal momentum
  // result; while scrolled back, detect against the data prefix ending at the
  // visible right-edge timestamp so incoming live ticks cannot change the pill.
  const badgeMomentumSV = useDerivedValue(() =>
    badgeCfg?.followViewEdge && engine.viewEnd.value !== null
      ? resolveMomentumProp(momentum, engine.data.value, engine.timestamp.value)
      : momentumSV.value,
  );

  // Width bridge lives here (outer tree), not in ChartCandleLayer: canvas
  // children commit one frame behind, which would lag the width target behind
  // the engine's framing snap on a timeframe switch. See useCandleWidthLerp.
  const displayCandleWidth = useCandleWidthLerp(
    candleWidth,
    transitionsCfg.candleLerpSpeed,
    !isStatic,
    isCandle,
  );

  // ── Overlay hooks ─────────────────────────────────────────────────────
  // Scrub/crosshair must see the same stash-backed candles as the engine.
  const crosshairChartOpts = isCandle
    ? {
        mode,
        candles: candlesEngine,
        liveCandle: liveEngine,
        candleWidthSecs: candleWidth,
        gaps: candleGapsCfg?.gaps,
        bridgeNoTrades:
          Boolean(candleGapsCfg?.styles["no-trades"].bridge),
        bridgeUnavailable:
          Boolean(candleGapsCfg?.styles.unavailable.bridge),
        bridgeUnknown: Boolean(candleGapsCfg?.styles.unknown.bridge),
      }
    : lineGapsCfg
      ? {
          mode,
          gaps: lineGapsCfg.gaps,
          bridgeNoTrades: Boolean(lineGapsCfg.styles["no-trades"].bridge),
          bridgeUnavailable: Boolean(lineGapsCfg.styles.unavailable.bridge),
          bridgeUnknown: Boolean(lineGapsCfg.styles.unknown.bridge),
        }
      : undefined;

  const markersActive = markers != null;
  const markerClusterCfg = resolveMarkerCluster(markerCluster);
  // `projected` is used internally by the hit-test gesture; the overlay
  // self-projects, so we only need the gesture + hit-test here. Built BEFORE
  // `useCrosshair` so the scrub-action tap can defer to a marker under the finger.
  const { tapGesture: markerTapGesture, hitTest: markerHitTest } = useMarkers(
    engine,
    effectivePadding,
    markersSV,
    !isStatic && markersActive,
    markerHitRadius,
    onMarkerPress,
    undefined, // seriesSV — single-series has none
    engine.data, // anchor value-less markers to the line
    !isStatic, // static: no marker-projection loop
    lineIsLinear, // match marker anchoring to the rendered curve
    markerClusterCfg, // co-located marker stacking / collapse
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
      dragValues,
    );

  // Draggable reference lines: a per-line vertical pan that grabs a line near its
  // value and drags it along the Y-axis (with snap / bounds / callbacks). Built
  // unconditionally for stable hook order (and before `useCrosshair` so the scrub
  // can defer to a line under the finger); the gesture self-disables when no line
  // opts in, and it's only composed into the root when `refDragEnabled`.
  const refDragEnabled =
    !isStatic && allRefLines.some((l) => l.draggable === true);
  const { gesture: refDragGesture, hitTest: refDragHitTest } = useReferenceDrag(
    engine,
    effectivePadding,
    allRefLines,
    dragValues,
    dragActive,
    !isStatic,
  );

  // Combined "defer" hit-test: the scrub-action place-tap and the live scrub both
  // yield to a marker, a pressable badge, or a draggable line under the finger — so
  // a press there is routed to that overlay / drag instead of dropping a reticle or
  // crosshair. (Each hit-test returns false when its feature is off.)
  /* istanbul ignore next -- worklet runs on the UI thread, not in Jest */
  const deferTapHit = (x: number, y: number): boolean => {
    "worklet";
    return markerHitTest(x, y) || refLineHitTest(x, y) || refDragHitTest(x, y);
  };

  // Time-scroll activation. `holdToScrub`: a quick one-finger drag scrolls while
  // scrub engages on press-and-hold — so the scrub gesture needs a long-press
  // delay (unless the caller set its own `panGestureDelay`). `timeScrollEnabled`
  // is computed earlier (it gates the float gutter).
  const scrollGestureMode =
    typeof timeScroll === "object"
      ? (timeScroll.gesture ?? "holdToScrub")
      : "holdToScrub";
  // In holdToScrub the scrub MUST require a hold so a quick drag scrolls instead.
  // Precedence: explicit timeScroll.scrubHoldMs, then scrub.panGestureDelay, then
  // the default. `||` (not `??`) skips the resolved panGestureDelay's 0 default.
  const timeScrollHoldMs =
    typeof timeScroll === "object" ? timeScroll.scrubHoldMs : undefined;
  const scrubHoldMs =
    timeScrollEnabled && scrollGestureMode === "holdToScrub"
      ? (timeScrollHoldMs ?? (scrubCfg?.panGestureDelay || HOLD_TO_SCRUB_MS))
      : (scrubCfg?.panGestureDelay ?? 0);

  // Cross-gesture arbitration for the one-finger touch. `Gesture.Race` below is
  // NOT arbitration — RNGH's Race adds no relation between its children, so both
  // pans recognize independently and each can activate while the other already
  // owns the touch. This latch (written by the scroll pan, read by the scrub's
  // long-press guard) makes "the scroll already won" a hard fact; `scrubActive`
  // (written by the crosshair, read by the scroll pan) is the mirror image.
  const scrollActive = useSharedValue(false);

  const crosshair = useCrosshair(
    engine,
    effectivePadding,
    palette,
    formatValue,
    formatTime,
    skiaFont,
    // Scrub / scrub-action stay live even on static charts: the gesture is
    // event-driven (no per-frame loop), so a settled chart costs nothing at rest
    // yet becomes scrubbable on touch. `static` only kills the continuous loop.
    scrubCfg !== null || scrubActionCfg !== null,
    onScrub,
    crosshairChartOpts,
    scrubHoldMs,
    onGestureStart,
    onGestureEnd,
    scrubActionCfg,
    onScrubAction,
    metricsCfg.badge,
    markersActive || refPressActive || refDragEnabled ? deferTapHit : undefined,
    scrubCfg?.tooltipPlacement ?? "side",
    scrubCfg?.tooltipShowValue ?? true,
    scrubCfg?.tooltipShowTime ?? true,
    scrubCfg?.tooltipMargin ?? 8,
    // Axis-drag time-scroll: keep the bottom "time ruler" band scroll-only so a
    // drag there never trips the scrub crosshair.
    timeScrollEnabled && scrollGestureMode === "axisDrag"
      ? Math.max(effectivePadding.bottom, AXIS_GRAB_MIN_PX)
      : 0,
    scrollActive,
    scrubCfg?.clampToPlot ?? false,
    // Candle mode: snap the crosshair to candle centers (tick-to-tick).
    scrubCfg?.snapToCandles ?? false,
  );

  // Capture only the shared value in the worklets below. Referencing
  // `crosshair.scrubActive` inside a worklet closes over the whole `crosshair`
  // object (which holds a non-serializable `gesture`), throwing
  // "[Worklets] Cannot copy value of type `PanGesture`" on worklets >=0.10.
  const crosshairScrubActive = crosshair.scrubActive;

  // ── Time-scroll (drag back through history) ───────────────────────────────
  // Experimental: a pan freezes the window at an absolute time and resumes
  // following once dragged back to the live edge. Pan is clamped to the earliest
  // retained point (line or candle). See `timeScroll` for the gesture model.
  const scrollMinTime = useDerivedValue(() => {
    const src = isCandle ? candlesEngine.get() : lineEngineData.get();
    return src.length > 0 ? src[0].time : engine.liveEdge.get();
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
    // Clear any live crosshair when a scroll drag takes over.
    onScrollStart: () => {
      "worklet";
      crosshairScrubActive.set(false);
    },
  });

  // Pinch-to-zoom the visible window (two-finger). Anchors at the focal point and
  // writes viewWindow + viewEnd; composes via Simultaneous (it's two-finger, so
  // disjoint from the one-finger pan/scrub). See `zoom`.
  const pinchZoomGesture = usePinchZoom({
    engine,
    padding: effectivePadding,
    minTime: scrollMinTime,
    timeWindow,
    enabled: zoomEnabled,
    minTimeWindow: zoomCfg?.minTimeWindow,
    maxTimeWindow: zoomCfg?.maxTimeWindow,
    overscroll: timeScrollOverscroll,
    onZoomStart: () => {
      "worklet";
      crosshairScrubActive.set(false);
    },
  });

  // Axis auto-hide: fade both axes out at rest and back in while the user
  // interacts. Any movement — scrub / time-scroll touch, or a viewEnd /
  // viewWindow change (fling momentum, pinch-zoom) — shows the axes; once the
  // touch lifts and the view settles, they fade back out after `hideAfterMs`.
  // Only the axis groups' opacity animates; the axis worklets keep running
  // underneath so a fade-in shows current labels.
  const axisAutoHideCfg =
    axisAutoHide === true ? {} : axisAutoHide === false ? null : axisAutoHide;
  const axisIdleOpacity = axisAutoHideCfg?.idleOpacity ?? 0;
  const axisFadeInMs = axisAutoHideCfg?.fadeInMs ?? 60;
  const axisFadeOutMs = axisAutoHideCfg?.fadeOutMs ?? 250;
  const axisHideAfterMs = axisAutoHideCfg?.hideAfterMs ?? 3000;
  const axisAutoHideOpacity = useSharedValue(
    axisAutoHideCfg ? axisIdleOpacity : 1,
  );
  const axisAutoHideEnabled = axisAutoHideCfg !== null;
  const lastAxisAutoHide = useRef({
    enabled: axisAutoHideEnabled,
    idleOpacity: axisIdleOpacity,
  });
  // `useSharedValue` only reads its initial value on mount. Keep prop changes
  // in sync as well: turning auto-hide off must immediately restore the axes,
  // and turning it on starts from the configured idle opacity.
  useEffect(() => {
    if (
      lastAxisAutoHide.current.enabled === axisAutoHideEnabled &&
      lastAxisAutoHide.current.idleOpacity === axisIdleOpacity
    ) {
      return;
    }
    lastAxisAutoHide.current = {
      enabled: axisAutoHideEnabled,
      idleOpacity: axisIdleOpacity,
    };
    cancelAnimation(axisAutoHideOpacity);
    axisAutoHideOpacity.value = axisAutoHideEnabled ? axisIdleOpacity : 1;
  }, [axisAutoHideEnabled, axisAutoHideOpacity, axisIdleOpacity]);
  useAnimatedReaction(
    () => ({
      gesture: scrollActive.value || crosshairScrubActive.value,
      viewEnd: engine.viewEnd.value,
      viewWindow: engine.viewWindow.value,
    }),
    (curr, prev) => {
      if (!axisAutoHideEnabled || prev === null) return;
      const moved =
        curr.gesture !== prev.gesture ||
        curr.viewEnd !== prev.viewEnd ||
        curr.viewWindow !== prev.viewWindow;
      if (!moved) return;
      cancelAnimation(axisAutoHideOpacity);
      axisAutoHideOpacity.value = curr.gesture
        ? withTiming(1, { duration: axisFadeInMs })
        : // Movement without a held touch (gesture end, fling, pinch): show,
          // then fade back out once the chart goes untouched for a while.
          withSequence(
            withTiming(1, { duration: axisFadeInMs }),
            withDelay(
              axisHideAfterMs,
              withTiming(axisIdleOpacity, { duration: axisFadeOutMs }),
            ),
          );
    },
    [
      axisAutoHideEnabled,
      axisIdleOpacity,
      axisFadeInMs,
      axisFadeOutMs,
      axisHideAfterMs,
    ],
  );

  // Paging callbacks: report the visible range / proximity to the oldest data so
  // a host can lazily load history. Inert unless a callback is supplied.
  useVisibleRange({
    engine,
    minTime: scrollMinTime,
    onVisibleRangeChange,
    onReachStart,
  });

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
    // Always `Simultaneous`, never `Race`: on iOS the scrub pan uses
    // `minDistance(0)`, so in a `Race` it activates on touch-down and cancels the
    // overlay tap before it can recognize — `onMarkerPress`/`onReferenceLinePress`
    // would never fire. Sharing the gesture space lets the tap recognize; the pan
    // defers to a marker/badge under the finger via `deferTapHit` (see
    // `useCrosshair`'s scrub `onStart`) so no stray crosshair is dropped there.
    rootGesture = Gesture.Simultaneous(baseGesture, tapGroup);
  }

  // Compose the pan-scroll gesture. holdToScrub races the scrub/tap gestures (a
  // quick drag scrolls; a still press-hold falls through to scrub). Axis-drag
  // goes first via Exclusive: it fails instantly outside the axis band, so scrub
  // runs everywhere else.
  if (timeScrollEnabled) {
    rootGesture =
      scrollGestureMode === "axisDrag"
        ? Gesture.Exclusive(panScrollGesture, rootGesture)
        : Gesture.Race(panScrollGesture, rootGesture);
  }

  // Draggable reference lines take priority: a vertical grab on a line drags it.
  // The manual-activation pan fails fast off any line (or on horizontal intent), so
  // Exclusive falls through to scrub / scroll everywhere else.
  if (refDragEnabled) {
    rootGesture = Gesture.Exclusive(refDragGesture, rootGesture);
  }

  // Pinch runs alongside everything else (two-finger, so it never competes with
  // the one-finger pan/scrub/tap gestures for the same touch).
  if (zoomEnabled) {
    rootGesture = Gesture.Simultaneous(rootGesture, pinchZoomGesture);
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

  // Hide the live dot while scrubbing when a selection dot is marking the scrub
  // point instead — otherwise both dots show at once. Applies on static charts
  // too, now that they're scrubbable.
  const selectionDotDuringScrub = scrubCfg !== null && selectionDotCfg !== null;
  // While scrolled back, the badge, dot, and value line still point at the live
  // price even though the window is showing history. Hide that live-priced group
  // together. `badge.followViewEdge` opts back in because all three then track
  // the visible edge price; `hideLiveOnScrollBack: false` keeps the legacy group.
  const hideLiveOnScrollBack = resolveHideLiveOnScrollBack(
    timeScroll,
    badgeCfg?.followViewEdge ?? false,
  );
  // A dot that tracks the true live point while parked is exempt from the
  // scroll-back hide: it no longer marks an off-screen price, and it hides
  // itself once the live point leaves the window (`useLiveDot`'s sentinel).
  const liveDotOpacity = useDerivedValue(
    () =>
      reveal.dotOpacity.value *
      (selectionDotDuringScrub && crosshairScrubActive.value ? 0 : 1) *
      liveIndicatorScrollOpacity(
        hideLiveOnScrollBack && !dotTracksParked,
        engine.viewEnd.value,
      ) *
      seriesIndicatorOpacity.value,
  );
  // Same scrolled-back gating for the value line: it would draw a dashed line
  // at the live value's Y — a price that isn't in the scrolled-back view.
  const valueLineOpacity = useDerivedValue(
    () =>
      reveal.lineOpacity.value *
      liveIndicatorScrollOpacity(hideLiveOnScrollBack, engine.viewEnd.value) *
      resolvedSeriesOpacity.value,
  );
  const liveBadgeOpacity = useDerivedValue(
    () =>
      reveal.badgeOpacity.value *
      liveIndicatorScrollOpacity(hideLiveOnScrollBack, engine.viewEnd.value) *
      resolvedSeriesOpacity.value,
  );

  // Fade the annotation overlays (markers + reference lines) out while scrubbing
  // when `scrub.hideOverlays` is set. Eased off the scrub-ACTIVE flag — not the
  // crosshair's edge-proximity fade, which drops to 0 near the live dot and would
  // resurface the overlays mid-scrub. Only this group opacity animates; the
  // marker atlas / reference-line draws stay intact (one batched draw each).
  const fadeOverlaysOnScrub =
    !isStatic && scrubCfg !== null && scrubCfg.hideOverlaysOnScrub === true;
  const overlayScrubFade = useDerivedValue(() =>
    fadeOverlaysOnScrub
      ? withTiming(crosshairScrubActive.get() ? 0 : 1, {
          duration: SCRUB_OVERLAY_FADE_MS,
        })
      : 1,
  );
  // Markers already fade with the dot reveal; fold the scrub-hide fade in too.
  const markerGroupOpacity = useDerivedValue(
    () => reveal.dotOpacity.get() * overlayScrubFade.get(),
  );

  return {
    // passthrough props the render needs
    style,
    canvasMode,
    accessibilityLabel,
    accessibilityRole,
    emptyText,
    showValue,
    valueMomentumColor,
    lineProp,
    seriesOpacity: resolvedSeriesOpacity,
    formatValue,
    formatTime,
    isCandle,
    isStatic,
    // Half a candle width (seconds) so an "extrema" axis label's dot lands on the
    // candle's drawn center, not its bucket-start (left) edge. 0 in line mode.
    extremaTimeOffset: isCandle ? candleWidth / 2 : 0,
    // configs
    yAxisCfg,
    yAxisFloat: effectiveYAxisFloat,
    xAxisCfg,
    badgeCfg,
    scrubCfg,
    scrubActionCfg,
    gradientCfg,
    areaDotsCfg,
    areaDotColorVec,
    valueLineCfg,
    pulseCfg,
    dotCfg,
    dotTracksParked,
    dotOuterRadius,
    gridStyleCfg,
    degenCfg,
    tradeStreamResolved,
    tradeStream,
    leftEdgeFadeCfg,
    metricsCfg,
    allRefLines,
    refLineKeys,
    refLineCustom,
    refLineOffAxisCustom,
    refLineCustomTagWidths,
    dragValues,
    dragActive,
    renderReferenceLine,
    renderOffAxisReferenceLine,
    refGroupingActive: refGroupingRadius != null,
    refGroupResult,
    groupHidden,
    refGroupBadge,
    refGroupBadgeFont,
    refGroupFormat,
    resolvedSegments,
    hasRecolorSegments,
    thresholdCfg,
    thresholdGeom,
    thresholdStrokeColors: thresholdStopColors?.stroke ?? null,
    thresholdFillColors: thresholdStopColors?.fill ?? null,
    // Time-varying threshold (a `LiveChartPoint[]` series): the per-fragment split
    // shader + polyline marker, vs. the constant case's gradient.
    thresholdIsSeries,
    thresholdSeriesHasPoints,
    thresholdStrokeUniforms,
    thresholdFillUniforms,
    thresholdMarkerLineY,
    thresholdMarkerVisible,
    thresholdBadgeVisible,
    thresholdMarkerValue,
    thresholdSeriesPts,
    badgeUsesRightGutter,
    // theme / layout / fonts
    palette,
    skiaFont,
    fontProp,
    valueFont,
    badgeFont,
    strokeWidth,
    effectivePadding,
    // engine + reveal
    engine,
    reveal,
    axisAutoHideOpacity,
    // loading shell styling (null → not loading)
    loadingLineColor: loadingCfg?.color,
    loadingStrokeWidth: loadingCfg?.strokeWidth,
    loadingAmplitude: loadingCfg?.amplitude,
    loadingSpeed: loadingCfg?.speed,
    loadingAxisLabels: loadingCfg?.axisLabels ?? true,
    // derived render values
    backgroundColor,
    gradientEnd,
    gradientTopColor,
    gradientBottomColor,
    gradientColors,
    gradientPositions,
    lineGroupOpacity,
    candleGroupOpacity,
    candlesEngine,
    liveEngine,
    candleWidth,
    displayCandleWidth,
    transitionsCfg,
    layoutWidth,
    onLayout,
    linePath,
    fillPath,
    thresholdFillPath,
    lineIsLinear,
    volumeCfg,
    candleGapsCfg,
    lineGapsCfg,
    // Volume bars: active flag, fade-in opacity, and resolved colors (default to
    // the candle palette). The reserved band height is read by the x-axis.
    volumeActive: volumeCfg !== null,
    volumeBandHeight,
    volumeOpacity: volumeCfg?.opacity ?? 1,
    volumeUpColor: volumeCfg?.upColor ?? palette.candleUp,
    volumeDownColor: volumeCfg?.downColor ?? palette.candleDown,
    dotX,
    dotY,
    liveDotOpacity,
    valueLineOpacity,
    liveBadgeOpacity,
    overlayScrubFade,
    markerGroupOpacity,
    momentumSV,
    badgeMomentumSV,
    onDegenShake,
    crosshair,
    rootGesture,
    markersActive,
    markersSV,
    markerClusterCfg,
    renderMarker,
    renderTooltip,
    renderOverlay,
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

type YAxisEntries = ReturnType<typeof useYAxis>["yAxisEntries"];
type DegenState = ReturnType<typeof useDegen>;

/** Owns the particle/shake state only while the degen effect is enabled. */
function ChartWithDegen({
  model,
  yAxisEntries,
}: {
  model: LiveChartModel;
  yAxisEntries: YAxisEntries | null;
}) {
  const { engine, dotX, dotY, momentumSV, degenCfg, onDegenShake } = model;
  const state = useDegen(
    engine,
    dotX,
    dotY,
    momentumSV,
    degenCfg,
    onDegenShake,
  );
  return <ChartView model={model} yAxisEntries={yAxisEntries} degen={state} />;
}

/**
 * Owns the Y-axis worklets. The provider itself is mounted only while the axis
 * is enabled, so `yAxis={false}` never registers its shared values or mapper.
 * The entries are passed through ordinary props so both paint-order positions
 * receive the same mapper across the React Native → Skia renderer boundary.
 */
function ChartWithYAxis({ model }: { model: LiveChartModel }) {
  const {
    engine,
    effectivePadding,
    formatValue,
    skiaFont,
    yAxisCfg,
    metricsCfg,
  } = model;
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
  if (model.degenCfg) {
    return <ChartWithDegen model={model} yAxisEntries={yAxisEntries} />;
  }
  return <ChartView model={model} yAxisEntries={yAxisEntries} degen={null} />;
}

function ChartYAxisLayer({
  model,
  variant,
  entries,
}: {
  model: LiveChartModel;
  variant: "all" | "grid" | "labels";
  entries: YAxisEntries;
}) {
  const {
    reveal,
    engine,
    effectivePadding,
    palette,
    skiaFont,
    dotY,
    badgeUsesRightGutter,
    badgeCfg,
    badgeFont,
    metricsCfg,
    gridStyleCfg,
    yAxisFloat,
    yAxisCfg,
    liveBadgeOpacity,
    axisAutoHideOpacity,
  } = model;
  // Fold the axis auto-hide fade into the reveal opacity (1 when the feature
  // is off).
  const yAxisGroupOpacity = useDerivedValue(
    () => reveal.yAxisOpacity.value * axisAutoHideOpacity.value,
  );
  return (
    <Group opacity={yAxisGroupOpacity}>
      <YAxisOverlay
        variant={variant}
        float={variant === "labels" && yAxisFloat}
        entries={entries}
        engine={engine}
        padding={effectivePadding}
        palette={palette}
        font={skiaFont}
        badge={badgeUsesRightGutter}
        badgeTail={badgeCfg?.tail ?? true}
        badgeMetrics={metricsCfg.badge}
        badgeCenterY={badgeUsesRightGutter ? dotY : undefined}
        badgeFontSize={badgeUsesRightGutter ? badgeFont.getSize() : undefined}
        badgeOffsetY={badgeCfg?.offsetY ?? 0}
        badgeOpacity={badgeUsesRightGutter ? liveBadgeOpacity : undefined}
        gridStyle={gridStyleCfg}
        labelRightMargin={yAxisCfg?.labelRightMargin}
        gridEndGap={yAxisCfg?.gridEndGap}
      />
    </Group>
  );
}

/** Owns the X-axis worklet and only mounts when `xAxis` is enabled. */
function ChartXAxisLayer({ model }: { model: LiveChartModel }) {
  const {
    engine,
    effectivePadding,
    formatTime,
    skiaFont,
    palette,
    volumeBandHeight,
  } = model;
  const { xAxisEntries } = useXAxis(
    engine,
    effectivePadding,
    formatTime,
    skiaFont,
  );
  return (
    // Axis auto-hide fade (1 when the feature is off).
    <Group opacity={model.axisAutoHideOpacity}>
      <XAxisOverlay
        entries={xAxisEntries}
        engine={engine}
        padding={effectivePadding}
        palette={palette}
        font={skiaFont}
        volumeBandHeight={volumeBandHeight}
      />
    </Group>
  );
}

/**
 * Background fills drawn BENEATH the left-edge fade: the y-axis grid, the area
 * gradient, and the threshold profit/loss band. Split out from `ChartStack` so
 * the fade's `dstOut` only softens the fills — the line and everything above it
 * (drawn in `ChartStack`, after the fade) stay crisp at the left edge.
 */
function ChartFillLayer({
  model,
  yAxisEntries,
  degen,
}: {
  model: LiveChartModel;
  yAxisEntries: YAxisEntries | null;
  degen: DegenState | null;
}) {
  const {
    yAxisCfg,
    yAxisFloat,
    reveal,
    effectivePadding,
    gradientCfg,
    areaDotsCfg,
    areaDotColorVec,
    fillPath,
    gradientEnd,
    gradientColors,
    gradientPositions,
    thresholdCfg,
    thresholdGeom,
    thresholdFillPath,
    thresholdFillColors,
    thresholdIsSeries,
    thresholdSeriesHasPoints,
    thresholdFillUniforms,
    seriesOpacity,
  } = model;
  return (
    <Group transform={degen?.shakeTransform}>
      {/* Y-axis. Default: grid + labels here (in a reserved gutter). Floating
          mode: grid only — the labels + a soft edge fade draw above the candles
          in ChartStack so the plot runs full-width and candles dim under them. */}
      {yAxisCfg && (
        <ChartYAxisLayer
          model={model}
          variant={yAxisFloat ? "grid" : "all"}
          entries={yAxisEntries!}
        />
      )}

      <Group opacity={seriesOpacity}>
        {/* Dot-lattice area fill (the under-line `fillPath` painted with a dot
            shader). Drawn before the gradient so a gradient (if also enabled)
            composites on top. */}
        {areaDotsCfg && (
          <Group opacity={reveal.fillOpacity}>
            <AreaDotsOverlay
              fillPath={fillPath}
              color={areaDotColorVec}
              spacing={areaDotsCfg.spacing}
              size={areaDotsCfg.size}
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
            split into the above/below colors. Independent of the baseline area fill
            above (set `gradient={false}` for the band alone). A time-varying series
            paints with the per-fragment split shader; a constant value with the
            vertical hard-stop gradient. */}
        {thresholdCfg?.fill &&
          (thresholdIsSeries ? (
            // The availability gate keeps a failed shader compile from filling the
            // band with the default paint (opaque black) — see THRESHOLD_SPLIT_AVAILABLE.
            thresholdSeriesHasPoints && THRESHOLD_SPLIT_AVAILABLE ? (
              <Group opacity={reveal.fillOpacity}>
                <Path path={thresholdFillPath} style="fill">
                  <ThresholdSplitShader uniforms={thresholdFillUniforms} />
                </Path>
              </Group>
            ) : null
          ) : thresholdFillColors ? (
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
          ) : null)}
      </Group>
    </Group>
  );
}

type CandlePaths = ReturnType<typeof useCandlePaths>;
type CandleGapPaths = ReturnType<typeof useCandleGapPaths>;
type LineGapPaths = ReturnType<typeof useLineGapPaths>;

function GapBridgePathBatch({
  paths,
  config,
  palette,
}: {
  paths: CandleGapPaths | LineGapPaths;
  config: ResolvedCandleGapsConfig;
  palette: LiveChartPalette;
}) {
  const noTrades = config.styles["no-trades"].bridge;
  const unavailable = config.styles.unavailable.bridge;
  const unknown = config.styles.unknown.bridge;
  return (
    <>
      {noTrades !== null && (
        <Group opacity={noTrades.opacity}>
          <Path
            path={paths.noTradesPath}
            style="stroke"
            strokeWidth={noTrades.strokeWidth}
            strokeCap={noTrades.strokeCap}
            color={noTrades.color ?? palette.refLine}
          />
        </Group>
      )}
      {unavailable !== null && (
        <Group opacity={unavailable.opacity}>
          <Path
            path={paths.unavailablePath}
            style="stroke"
            strokeWidth={unavailable.strokeWidth}
            strokeCap={unavailable.strokeCap}
            color={unavailable.color ?? palette.refLine}
          />
        </Group>
      )}
      {unknown !== null && (
        <Group opacity={unknown.opacity}>
          <Path
            path={paths.unknownPath}
            style="stroke"
            strokeWidth={unknown.strokeWidth}
            strokeCap={unknown.strokeCap}
            color={unknown.color ?? palette.refLine}
          />
        </Group>
      )}
    </>
  );
}

function ChartCandleGapLayer({
  model,
  config,
  focusOtherCandles,
  inactiveOpacity,
  focusedOpacity,
  focusedClip,
}: {
  model: LiveChartModel;
  config: ResolvedCandleGapsConfig;
  focusOtherCandles: boolean;
  inactiveOpacity: SharedValue<number>;
  focusedOpacity: SharedValue<number>;
  focusedClip: SharedValue<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}) {
  const paths = useCandleGapPaths(
    model.engine,
    model.effectivePadding,
    model.candlesEngine,
    model.liveEngine,
    model.displayCandleWidth,
    config,
    model.metricsCfg.candle,
  );
  const batch = (
    <GapBridgePathBatch
      paths={paths}
      config={config}
      palette={model.palette}
    />
  );
  return focusOtherCandles ? (
    <>
      <Group opacity={inactiveOpacity}>{batch}</Group>
      <Group opacity={focusedOpacity} clip={focusedClip}>
        {batch}
      </Group>
    </>
  ) : (
    batch
  );
}

/** Line-mode bridge paths live in a child so candle charts register no worklets. */
function ChartLineGapLayer({ model }: { model: LiveChartModel }) {
  const config = model.lineGapsCfg!;
  const paths = useLineGapPaths(
    model.engine,
    model.effectivePadding,
    config,
  );
  return (
    <GapBridgePathBatch
      paths={paths}
      config={config}
      palette={model.palette}
    />
  );
}

/** One batched candle pass: two body paths and two wick paths. */
function CandlePathBatch({
  paths,
  wickWidth,
  palette,
}: {
  paths: CandlePaths;
  wickWidth: number;
  palette: LiveChartPalette;
}) {
  return (
    <>
      <Path
        path={paths.upWicksPath}
        style="stroke"
        strokeWidth={wickWidth}
        color={palette.wickUp}
      />
      <Path
        path={paths.downWicksPath}
        style="stroke"
        strokeWidth={wickWidth}
        color={palette.wickDown}
      />
      <Path path={paths.upBodiesPath} style="fill" color={palette.candleUp} />
      <Path
        path={paths.downBodiesPath}
        style="fill"
        color={palette.candleDown}
      />
    </>
  );
}

/**
 * Candle/volume paths are a mode-specific subsystem. Keeping their hooks in a
 * child means a line chart never registers the candle-width frame callback or
 * the six derived path worklets.
 */
function ChartCandleLayer({ model }: { model: LiveChartModel }) {
  const {
    engine,
    effectivePadding,
    candlesEngine,
    liveEngine,
    displayCandleWidth,
    metricsCfg,
    volumeBandHeight,
    volumeCfg,
    candleGroupOpacity,
    seriesOpacity,
    palette,
    volumeOpacity,
    volumeUpColor,
    volumeDownColor,
    candleGapsCfg,
    scrubCfg,
    crosshair,
  } = model;
  const paths = useCandlePaths(
    engine,
    effectivePadding,
    candlesEngine,
    liveEngine,
    displayCandleWidth,
    true,
    metricsCfg.candle,
    volumeBandHeight,
    volumeCfg?.radius ?? 0,
  );
  const focusOtherCandles = scrubCfg?.dimTarget === "otherCandles";
  const candleDimOpacity = scrubCfg?.dimOpacity ?? 1;
  const candleDimFadeMs = scrubCfg?.dimFadeMs ?? 0;
  // Destructure SharedValues before entering worklets. Closing over the
  // whole crosshair object would also serialize its RNGH gesture instances.
  const scrubActive = crosshair.scrubActive;
  // ChartCandleLayer is single-series only; useCrosshair always supplies this
  // value (it is optional on the shared state type only for LiveChartSeries).
  const scrubCandle = crosshair.scrubCandle!;
  const scrubGap = crosshair.scrubGap!;
  const scrubTime = crosshair.scrubTime;
  const currentFocusBucketTime = useDerivedValue(() => {
    if (!focusOtherCandles) return null;
    const candle = scrubCandle.get();
    if (candle) return candle.time;
    const gap = scrubGap.get();
    if (!gap) return null;
    return candleGapBucketStartAtTime(
      gap,
      scrubTime.get(),
      candlesEngine.get(),
      liveEngine.get(),
      displayCandleWidth.get(),
    );
  });
  // Keep the last selection after the current target clears so its clipped full-
  // strength pass can cover the base batch until the release fade completes.
  const lastFocusBucket = useSharedValue<{ time: number } | null>(null);
  useAnimatedReaction(
    () => currentFocusBucketTime.get(),
    (time) => {
      if (time !== null) lastFocusBucket.set({ time });
    },
  );
  const inactiveCandleOpacity = useDerivedValue(() => {
    const target =
      focusOtherCandles &&
      scrubActive.get() &&
      currentFocusBucketTime.get() !== null
        ? candleDimOpacity
        : 1;
    return candleDimFadeMs > 0
      ? withTiming(target, { duration: candleDimFadeMs })
      : target;
  }, [
    focusOtherCandles,
    scrubActive,
    currentFocusBucketTime,
    candleDimOpacity,
    candleDimFadeMs,
  ]);
  const focusedCandleOpacity = useDerivedValue(() => {
    const currentTime = currentFocusBucketTime.get();
    const focusBucket =
      currentTime === null ? lastFocusBucket.get() : { time: currentTime };
    if (!focusOtherCandles || !focusBucket) return 0;
    return computeCandleFocusPassOpacity(
      scrubActive.get(),
      currentTime !== null,
      inactiveCandleOpacity.get(),
    );
  }, [
    focusOtherCandles,
    scrubActive,
    currentFocusBucketTime,
    lastFocusBucket,
    inactiveCandleOpacity,
  ]);
  const focusedCandleClip = useDerivedValue(() => {
    if (!focusOtherCandles) {
      return HIDDEN_CANDLE_FOCUS_CLIP;
    }
    const currentTime = currentFocusBucketTime.get();
    const focusBucket =
      currentTime === null ? lastFocusBucket.get() : { time: currentTime };
    return computeCandleFocusClip(
      focusBucket,
      effectivePadding,
      engine.canvasWidth.get(),
      engine.canvasHeight.get(),
      engine.timestamp.get() - engine.displayWindow.get(),
      engine.displayWindow.get(),
      displayCandleWidth.get(),
    );
  }, [
    focusOtherCandles,
    currentFocusBucketTime,
    lastFocusBucket,
    effectivePadding,
    engine.canvasWidth,
    engine.canvasHeight,
    engine.timestamp,
    engine.displayWindow,
    displayCandleWidth,
  ]);

  return (
    <Group opacity={seriesOpacity}>
      <Group opacity={candleGroupOpacity}>
        {candleGapsCfg && (
          <ChartCandleGapLayer
            model={model}
            config={candleGapsCfg}
            focusOtherCandles={focusOtherCandles}
            inactiveOpacity={inactiveCandleOpacity}
            focusedOpacity={focusedCandleOpacity}
            focusedClip={focusedCandleClip}
          />
        )}
        {focusOtherCandles ? (
          <>
            <Group opacity={inactiveCandleOpacity}>
              <CandlePathBatch
                paths={paths}
                wickWidth={metricsCfg.candle.wickWidth}
                palette={palette}
              />
            </Group>
            <Group opacity={focusedCandleOpacity} clip={focusedCandleClip}>
              <CandlePathBatch
                paths={paths}
                wickWidth={metricsCfg.candle.wickWidth}
                palette={palette}
              />
            </Group>
          </>
        ) : (
          <CandlePathBatch
            paths={paths}
            wickWidth={metricsCfg.candle.wickWidth}
            palette={palette}
          />
        )}
      </Group>

      {volumeCfg && (
        <Group opacity={candleGroupOpacity}>
          <Group opacity={volumeOpacity}>
            <Path path={paths.upBarsPath} style="fill" color={volumeUpColor} />
            <Path
              path={paths.downBarsPath}
              style="fill"
              color={volumeDownColor}
            />
          </Group>
        </Group>
      )}
    </Group>
  );
}

/** Main shaken chart stack drawn ABOVE the left-edge fade so the line stays crisp:
 *  segment dividers, value/reference lines, the line/candles, axes, dot, degen,
 *  markers, and the loading/empty art. Background fills are in `ChartFillLayer`
 *  (below the fade); the live value text is `ChartValueOverlay` (above the fade). */
function ChartStack({
  model,
  yAxisEntries,
  degen,
}: {
  model: LiveChartModel;
  yAxisEntries: YAxisEntries | null;
  degen: DegenState | null;
}) {
  const {
    reveal,
    engine,
    effectivePadding,
    palette,
    skiaFont,
    fontProp,
    badgeCfg,
    valueLineCfg,
    valueLineOpacity,
    dotY,
    allRefLines,
    refLineKeys,
    dragValues,
    resolvedSegments,
    hasRecolorSegments,
    crosshair,
    thresholdCfg,
    thresholdGeom,
    thresholdStrokeColors,
    thresholdIsSeries,
    thresholdSeriesHasPoints,
    thresholdStrokeUniforms,
    thresholdMarkerLineY,
    thresholdMarkerVisible,
    thresholdBadgeVisible,
    thresholdMarkerValue,
    thresholdSeriesPts,
    formatValue,
    lineGroupOpacity,
    seriesOpacity,
    linePath,
    lineGapsCfg,
    lineIsLinear,
    strokeWidth,
    lineProp,
    isCandle,
    xAxisCfg,
    dotX,
    liveDotOpacity,
    pulseCfg,
    dotCfg,
    dotTracksParked,
    degenCfg,
    markersActive,
    markersSV,
    markerClusterCfg,
    markerGroupOpacity,
    overlayScrubFade,
    renderMarker,
    emptyText,
    loadingAxisLabels,
    metricsCfg,
    layoutWidth,
    yAxisCfg,
    yAxisFloat,
    loadingLineColor,
    loadingStrokeWidth,
    loadingAmplitude,
    loadingSpeed,
    canvasMode,
  } = model;
  return (
    <Group transform={degen?.shakeTransform}>
      {/* Segment dividers + labels (behind the line). The scrub-focus emphasis is
          painted on the line stroke itself, below — this overlay draws no fill. */}
      {resolvedSegments.map((seg) => (
        <SegmentDividerOverlay
          key={segmentReactKey(seg)}
          engine={engine}
          padding={effectivePadding}
          segment={seg}
          font={skiaFont}
        />
      ))}

      {/* Value line + reference line (behind chart line) */}
      {valueLineCfg && (
        <Group opacity={valueLineOpacity}>
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

      {/* Wrapped in a fade group so `scrub.hideOverlaysOnScrub` can ease lines
          out while scrubbing. Explicit ids keep lines stable when reordered. */}
      <Group opacity={overlayScrubFade}>
        {allRefLines.map((rl, i) => (
          <ReferenceLineOverlay
            key={refLineKeys[i]}
            engine={engine}
            padding={effectivePadding}
            line={rl}
            palette={palette}
            formatValue={formatValue}
            font={skiaFont}
            fontProp={fontProp}
            dragValues={dragValues}
            index={i}
            yAxisEntries={yAxisEntries}
            labelRightMargin={yAxisCfg?.labelRightMargin}
            gridEndGap={yAxisCfg?.gridEndGap}
          />
        ))}
      </Group>

      {/* Threshold marker line + label (behind the chart line). For a time-varying
          series it traces the threshold polyline; otherwise a horizontal line. */}
      {thresholdCfg?.line && (
        <ThresholdLineOverlay
          engine={engine}
          padding={effectivePadding}
          lineY={thresholdMarkerLineY}
          visible={thresholdMarkerVisible}
          value={thresholdMarkerValue}
          cfg={thresholdCfg.line}
          palette={palette}
          font={skiaFont}
          formatValue={formatValue}
          seriesPts={thresholdSeriesPts}
        />
      )}

      {/* Chart line (fades out in candle mode). When segments recolor the line, a
          full-width gradient paints the base color outside segments and each
          segment's color within — so the line itself is recolored/faded (alpha in
          the segment color reduces the line's opacity), not covered by an overlay. */}
      <Group opacity={seriesOpacity}>
        <Group opacity={lineGroupOpacity}>
          <Path
            path={linePath}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap={lineProp?.cap ?? "round"}
            strokeJoin={lineProp?.join ?? "round"}
            color={lineProp?.color ?? palette.line}
          >
            {thresholdIsSeries ? (
              // Time-varying split: a per-fragment shader colors the stroke above/
              // below the threshold polyline. Supersedes line.colors + segments.
              // An empty series renders no paint child → the plain stroke color
              // (null here keeps the empty case out of the NaN constant gradient).
              thresholdSeriesHasPoints ? (
                <ThresholdSplitShader uniforms={thresholdStrokeUniforms} />
              ) : null
            ) : thresholdCfg && thresholdStrokeColors ? (
              // Vertical hard split at the threshold Y — supersedes line.colors and
              // segment recoloring for the stroke while a threshold is set.
              <LinearGradient
                start={vec(0, 0)}
                end={thresholdGeom.gradientEnd}
                colors={thresholdStrokeColors}
                positions={thresholdGeom.splitPositions}
              />
            ) : hasRecolorSegments ? (
              <SegmentLineGradient
                engine={engine}
                segments={resolvedSegments}
                padding={effectivePadding}
                baseColor={lineProp?.color ?? palette.line}
                scrubX={crosshair.scrubX}
                scrubActive={crosshair.scrubActive}
              />
            ) : lineProp?.colors?.length ? (
              <LinearGradient
                start={vec(0, 0)}
                end={vec(layoutWidth, 0)}
                colors={lineProp.colors}
              />
            ) : null}
          </Path>
          {lineGapsCfg && <ChartLineGapLayer model={model} />}
        </Group>
      </Group>

      {isCandle && <ChartCandleLayer model={model} />}

      {/* Floating axis: the labels float ABOVE the candles (right-aligned at the
          edge) so the plot runs full-width and candles stay fully visible behind
          them. (Default non-floating axis draws grid + labels in ChartFillLayer.) */}
      {yAxisCfg && yAxisFloat && (
        <ChartYAxisLayer
          model={model}
          variant="labels"
          entries={yAxisEntries!}
        />
      )}

      {/* X-axis time labels. With a volume band the bottom padding is inflated by
          the band height; pass it so the axis shifts back to the very bottom. */}
      {xAxisCfg && <ChartXAxisLayer model={model} />}

      {/* Live dot — the badge is drawn later (after the scrub layer) so the
          scrub dim never clips the live-price badge's left edge. Hidden while
          scrubbing when a selection dot marks the scrub point instead. */}
      {dotCfg.show && (
        <Group opacity={liveDotOpacity}>
          <DotOverlay
            dotX={dotX}
            dotY={dotY}
            palette={palette}
            pulse={pulseCfg}
            glow={dotCfg.glow}
            radius={dotCfg.radius}
            ring={dotCfg.ring}
            color={dotCfg.color}
            viewEnd={engine.viewEnd}
            // A tracking dot marks the honest live position while parked, so
            // its heartbeat keeps pulsing (useLiveDot tracks the true point).
            pulseWhileParked={dotTracksParked}
          />
        </Group>
      )}

      {degenCfg && (
        <Group opacity={reveal.dotOpacity}>
          <DegenParticlesOverlay
            pack={degen!.pack}
            packRevision={degen!.packRevision}
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
        <Group opacity={markerGroupOpacity}>
          <MarkerOverlay
            markers={markersSV}
            engine={engine}
            padding={effectivePadding}
            palette={palette}
            font={skiaFont}
            lineData={engine.data}
            lineLinear={lineIsLinear}
            renderMarker={renderMarker}
            cluster={markerClusterCfg}
          />
        </Group>
      )}

      {/* Threshold label badge — on top of the line/dot/markers so it's never
          painted over (the dashed marker line itself stays behind the line, above). */}
      {thresholdCfg?.line && (
        <ThresholdBadgeOverlay
          engine={engine}
          padding={effectivePadding}
          lineY={thresholdMarkerLineY}
          visible={thresholdBadgeVisible}
          value={thresholdMarkerValue}
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

/** Owns the trade-tape frame callback and only mounts with a trade stream. */
function ChartTradeStreamLayer({
  model,
  degen,
}: {
  model: LiveChartModel;
  degen: DegenState | null;
}) {
  const {
    engine,
    tradeStream,
    tradeStreamResolved,
    effectivePadding,
    volumeBandHeight,
    palette,
    skiaFont,
    reveal,
    isStatic,
  } = model;
  // `effectivePadding.bottom` includes the volume reservation so candle prices
  // stop above the bars. The trade tape should still enter at the chart's true
  // lower edge (the volume baseline / x-axis), so remove that reservation for
  // this overlay's coordinate space only.
  const tradeStreamPadding =
    volumeBandHeight > 0
      ? {
          ...effectivePadding,
          bottom: effectivePadding.bottom - volumeBandHeight,
        }
      : effectivePadding;
  const tradeMarkers = useTradeStream(
    engine,
    tradeStream!,
    tradeStreamPadding,
    !isStatic,
    !isStatic,
  );
  return (
    <Group transform={degen?.shakeTransform}>
      <TradeStreamOverlay
        markers={tradeMarkers}
        palette={palette}
        padding={tradeStreamPadding}
        font={skiaFont}
        opacity={reveal.dotOpacity}
        labelOffsetX={tradeStreamResolved!.labelOffsetX}
      />
    </Group>
  );
}

/** Scrub crosshair/tooltip drawn in canvas space on top of the shaken stack. */
function ChartScrubLayer({
  model,
  degen,
}: {
  model: LiveChartModel;
  degen: DegenState | null;
}) {
  const {
    scrubCfg,
    palette,
    effectivePadding,
    skiaFont,
    crosshair,
    isCandle,
    pulseCfg,
    dotOuterRadius,
    selectionDot,
    selectionColor,
    renderTooltip,
    canvasMode,
  } = model;
  // A custom tooltip is an RN overlay (sibling of <Canvas>), so the built-in
  // Skia tooltip is suppressed here while it's active — the line pill in line
  // mode, and the OHLC stack in candle mode (see the stack gate below).
  const customTooltipActive = renderTooltip != null;
  // `otherCandles` is candle-only. If a consumer switches this chart to line
  // mode without also rewriting its scrub config, preserve the standard line
  // scrub (guide, selection dot, and trailing fade).
  const dimsFuture = !isCandle || scrubCfg?.dimTarget === "future";

  if (!scrubCfg) return null;

  // Extend the scrub dim past the plot's right edge to fully cover the live dot
  // (with its halo) and pulse ring, all centered on that edge. The gutter
  // reserves an 8px gap beyond this for the Y-axis labels, so they stay readable.
  const liveDotExtent = Math.max(
    dotOuterRadius,
    pulseCfg ? pulseRadialOutset(pulseCfg.maxRadius, pulseCfg.strokeWidth) : 0,
  );

  return (
    <Group transform={degen?.shakeTransform}>
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
          showLine={dimsFuture}
          selectionDot={dimsFuture ? selectionDot : null}
          selectionY={crosshair.scrubDotY}
          scrubActive={crosshair.scrubActive}
          selectionColor={selectionColor}
          dimOpacity={dimsFuture ? scrubCfg.dimOpacity : 1}
          liveDotExtent={liveDotExtent}
          crosshairLineColor={scrubCfg.crosshairLineColor}
          crosshairStrokeWidth={scrubCfg.crosshairStrokeWidth}
          crosshairOvershoot={scrubCfg.crosshairOvershoot}
          crosshairFade={scrubCfg.crosshairFade}
          crosshairFadeDistance={scrubCfg.crosshairFadeDistance}
          crosshairLineCap={scrubCfg.crosshairLineCap}
          crosshairDash={scrubCfg.crosshairDash}
          crosshairDimColor={
            dimsFuture ? scrubCfg.crosshairDimColor : undefined
          }
          tooltipBackground={scrubCfg.tooltipBackground}
          tooltipColor={scrubCfg.tooltipColor}
          tooltipBorderColor={scrubCfg.tooltipBorderColor}
          tooltipBorderRadius={scrubCfg.tooltipBorderRadius}
          tooltipShowValue={scrubCfg.tooltipShowValue}
          tooltipShowTime={scrubCfg.tooltipShowTime}
          opaqueCanvas={canvasMode === "opaque"}
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

/** A segment's time range and presentation uniquely identify its divider view. */
function segmentReactKey(segment: ResolvedSegment): string {
  return [
    "seg",
    segment.from ?? "start",
    segment.to ?? "end",
    segment.divider,
    segment.dividerColor,
    segment.label ?? "",
    segment.labelPosition,
  ].join(":");
}

/** Live-value text drawn as its own canvas layer, above both the area gradient
 *  and the left-edge fade, so the large number stays crisp at the left edge
 *  instead of being washed out by the fade's `dstOut` blend. */
function ChartValueOverlay({
  model,
  degen,
}: {
  model: LiveChartModel;
  degen: DegenState | null;
}) {
  const {
    showValue,
    engine,
    effectivePadding,
    palette,
    valueFont,
    formatValue,
    momentumSV,
    valueMomentumColor,
    reveal,
    seriesOpacity,
  } = model;
  if (!showValue) return null;

  return (
    <Group transform={degen?.shakeTransform}>
      <Group opacity={seriesOpacity}>
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
    </Group>
  );
}

/** Live-price badge, drawn above the scrub dim so the dim never clips its left
 *  edge. Shares the degen shake transform so it tracks the shaken stack. */
function ChartBadgeLayer({
  model,
  degen,
}: {
  model: LiveChartModel;
  degen: DegenState | null;
}) {
  const {
    badgeFont,
    engine,
    effectivePadding,
    palette,
    formatValue,
    badgeMomentumSV,
    metricsCfg,
    yAxisFloat,
    liveBadgeOpacity,
  } = model;
  const badgeCfg = model.badgeCfg!;
  const badgeData = useBadge(
    engine,
    effectivePadding,
    palette,
    formatValue,
    badgeFont,
    badgeCfg.variant,
    badgeCfg.tail,
    badgeMomentumSV,
    badgeCfg.position,
    badgeCfg.background,
    metricsCfg.badge,
    metricsCfg.motion.badgeColorSpeed,
    yAxisFloat,
    engine.edgeValue,
    badgeCfg.followViewEdge,
    badgeCfg.radius,
    badgeCfg.textColor,
  );
  return (
    <Group transform={degen?.shakeTransform}>
      <Group opacity={liveBadgeOpacity}>
        <BadgeOverlay
          badge={badgeData}
          font={badgeFont}
          borderColor={badgeCfg.borderColor}
          borderWidth={badgeCfg.borderWidth}
          offsetX={badgeCfg.offsetX}
          offsetY={badgeCfg.offsetY}
        />
      </Group>
    </Group>
  );
}

/** Reference-line badges + labels, drawn ABOVE the left-edge fade so a
 *  left-pinned badge (off-axis / `labelBadge`) and any label stay crisp instead
 *  of being erased by the fade's dstOut. The lines/bands themselves render in the
 *  base pass inside ChartStack (behind the chart content). */
function ChartRefBadgeLayer({
  model,
  degen,
  yAxisEntries,
}: {
  model: LiveChartModel;
  degen: DegenState | null;
  yAxisEntries: YAxisEntries | null;
}) {
  const {
    allRefLines,
    refLineKeys,
    refLineCustom,
    refLineOffAxisCustom,
    refLineCustomTagWidths,
    dragValues,
    groupHidden,
    refGroupResult,
    refGroupingActive,
    refGroupBadge,
    refGroupBadgeFont,
    refGroupFormat,
    engine,
    effectivePadding,
    palette,
    formatValue,
    skiaFont,
    fontProp,
    yAxisCfg,
    overlayScrubFade,
  } = model;
  if (allRefLines.length === 0) return null;
  return (
    <Group transform={degen?.shakeTransform} opacity={overlayScrubFade}>
      {allRefLines.map((rl, i) => (
        <ReferenceLineOverlay
          key={refLineKeys[i]}
          engine={engine}
          padding={effectivePadding}
          line={rl}
          palette={palette}
          formatValue={formatValue}
          font={skiaFont}
          fontProp={fontProp}
          badgeLayer
          dragValues={dragValues}
          index={i}
          suppressTag={refLineCustom[i]}
          suppressTagWhenOffAxis={refLineOffAxisCustom[i]}
          customTagWidths={refLineCustomTagWidths}
          groupHidden={refGroupingActive ? groupHidden : undefined}
          yAxisEntries={yAxisEntries}
          labelRightMargin={yAxisCfg?.labelRightMargin}
          gridEndGap={yAxisCfg?.gridEndGap}
        />
      ))}
      {/* Collapsed count handles for grouped (near-value) lines. */}
      {refGroupingActive && (
        <ReferenceLineGroupOverlay
          grouping={refGroupResult}
          padding={effectivePadding}
          canvasWidth={engine.canvasWidth}
          palette={palette}
          font={refGroupBadgeFont}
          badge={refGroupBadge}
          format={refGroupFormat}
        />
      )}
    </Group>
  );
}

/** Scrub-action ("order ticket") reticle + action badge. Drawn OUTSIDE the degen
 *  shake group so the rendered badge stays aligned with the untransformed tap
 *  hit-test; it tracks the locked reticle, not the shaken stack. */
function ChartScrubActionLayer({ model }: { model: LiveChartModel }) {
  const {
    scrubActionCfg,
    crosshair,
    engine,
    effectivePadding,
    palette,
    skiaFont,
  } = model;
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

/**
 * RN-backed marker and reference-line slots. Their animated fade mapper is
 * registered only when at least one custom annotation renderer is present.
 */
function ChartCustomAnnotations({ model }: { model: LiveChartModel }) {
  const {
    markersActive,
    markersSV,
    markerClusterCfg,
    renderMarker,
    renderReferenceLine,
    renderOffAxisReferenceLine,
    allRefLines,
    refLineCustom,
    refLineOffAxisCustom,
    refLineCustomTagWidths,
    dragValues,
    dragActive,
    engine,
    effectivePadding,
    formatValue,
    lineIsLinear,
    overlayScrubFade,
  } = model;
  const overlayFadeStyle = useAnimatedStyle(() => ({
    opacity: overlayScrubFade.get(),
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, overlayFadeStyle]}
    >
      {markersActive && renderMarker && (
        <CustomMarkerOverlay
          markers={markersSV}
          renderMarker={renderMarker}
          engine={engine}
          padding={effectivePadding}
          lineData={engine.data}
          lineLinear={lineIsLinear}
          cluster={markerClusterCfg}
        />
      )}
      {renderReferenceLine && allRefLines.length > 0 && (
        <CustomReferenceLineOverlay
          lines={allRefLines}
          renderReferenceLine={renderReferenceLine}
          custom={refLineCustom}
          engine={engine}
          padding={effectivePadding}
          formatValue={formatValue}
          dragValues={dragValues}
          dragActive={dragActive}
          tagWidths={refLineCustomTagWidths}
        />
      )}
      {renderOffAxisReferenceLine && allRefLines.length > 0 && (
        <CustomReferenceLineOverlay
          lines={allRefLines}
          renderReferenceLine={renderOffAxisReferenceLine}
          custom={refLineOffAxisCustom}
          engine={engine}
          padding={effectivePadding}
          formatValue={formatValue}
          dragValues={dragValues}
          dragActive={dragActive}
          tagWidths={refLineCustomTagWidths}
          offAxisOnly
        />
      )}
    </Animated.View>
  );
}

/** Owns the price/time projection worklets for the custom overlay slot. */
function ChartCustomConsumerOverlay({ model }: { model: LiveChartModel }) {
  const { engine, effectivePadding, renderOverlay } = model;
  const overlayContext = useChartOverlayContext(engine, effectivePadding);
  return <ChartOverlayLayer render={renderOverlay!} context={overlayContext} />;
}

function ChartView({
  model,
  yAxisEntries,
  degen,
}: {
  model: LiveChartModel;
  yAxisEntries: YAxisEntries | null;
  degen: DegenState | null;
}) {
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
    renderMarker,
    renderTooltip,
    renderOverlay,
    renderReferenceLine,
    renderOffAxisReferenceLine,
    allRefLines,
    scrubCfg,
    crosshair,
    extremaTimeOffset,
    topConnector,
    bottomConnector,
    canvasMode,
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
        {/* Skia chooses TextureView vs SurfaceView when the native Canvas mounts. */}
        <Canvas
          key={canvasMode}
          style={{ flex: 1 }}
          opaque={canvasMode === "opaque"}
        >
          {canvasMode === "opaque" && (
            <Rect
              x={0}
              y={0}
              width={engine.canvasWidth}
              height={engine.canvasHeight}
              color={backgroundColor}
            />
          )}
          {/* Background fills first, then the left-edge fade (a canvas-space sibling
              so dstOut blends correctly), then the line stack on top — so the fade
              softens only the fills and the line stays crisp at the left edge. */}
          <ChartFillLayer
            model={model}
            yAxisEntries={yAxisEntries}
            degen={degen}
          />

          {leftEdgeFadeCfg && (
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
          )}

          {/* Line stack above the fade so the line stays crisp at the left edge. */}
          <ChartStack model={model} yAxisEntries={yAxisEntries} degen={degen} />

          {/* "extrema-edge" connector lines (dot → edge readout), above the chart
              content so the dashed guide reads over the line / candles. */}
          {(topConnector || bottomConnector) && (
            <ExtremaConnectorOverlay
              engine={engine}
              padding={effectivePadding}
              extremaTimeOffset={extremaTimeOffset}
              top={topConnector}
              bottom={bottomConnector}
            />
          )}

          {/* Reference-line badges + labels above the fade so they stay crisp. */}
          <ChartRefBadgeLayer
            model={model}
            degen={degen}
            yAxisEntries={yAxisEntries}
          />

          <ChartValueOverlay model={model} degen={degen} />

          {model.tradeStreamResolved && model.tradeStream && (
            <ChartTradeStreamLayer model={model} degen={degen} />
          )}

          <ChartScrubLayer model={model} degen={degen} />

          {/* Live-price badge on top of the scrub dim so the dim never clips
              its left edge (the badge tracks the live value, not the scrub). */}
          {model.badgeCfg && <ChartBadgeLayer model={model} degen={degen} />}

          {/* Scrub-action reticle + action badge — top-most, no shake transform. */}
          <ChartScrubActionLayer model={model} />
        </Canvas>

        {/* RN labels floated over the canvas (sibling of <Canvas>, an RN view).
            Pinned to the plot's top/bottom edges via the resolved padding. */}
        {(topLabelCfg || bottomLabelCfg) && (
          <AxisLabelOverlay
            topLabel={topLabelCfg}
            bottomLabel={bottomLabelCfg}
            engine={engine}
            formatValue={formatValue}
            defaultColor={palette.gridLabel}
            padding={effectivePadding}
            extremaTimeOffset={extremaTimeOffset}
          />
        )}

        {/* Custom-rendered markers — RN views floated over the canvas (non-Skia),
            pinned to each marker's live position. Sibling of <Canvas>. Wrapped in
            a box-none fade layer so `scrub.hideOverlaysOnScrub` hides them with the
            Skia markers (the wrapper is full-bleed; children keep their own
            absolute positions). */}
        {((markersActive && renderMarker) ||
          ((renderReferenceLine || renderOffAxisReferenceLine) &&
            allRefLines.length > 0)) && (
          <ChartCustomAnnotations model={model} />
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
            scrubGap={crosshair.scrubGap}
            tooltipLayout={crosshair.tooltipLayout}
            engine={engine}
            padding={effectivePadding}
            placement={scrubCfg.tooltipPlacement}
            margin={scrubCfg.tooltipMargin}
            crosshairFade={scrubCfg.crosshairFade}
            crosshairFadeDistance={scrubCfg.crosshairFadeDistance}
            lineTop={crosshair.tooltipLineTop}
            scrubDotY={crosshair.scrubDotY}
          />
        )}

        {/* Custom consumer overlay — an RN view tree floated over the canvas with
            the price↔pixel / time↔pixel bridge, for order / avg-entry / liquidation
            tags etc. Topmost RN sibling; `box-none` so empty areas still scrub. */}
        {renderOverlay && <ChartCustomConsumerOverlay model={model} />}
      </View>
    </GestureDetector>
  );
}

export const LiveChart = forwardRef<LiveChartHandle, LiveChartProps>(
  function LiveChart(props, ref) {
    const model = useLiveChartController(props);
    const { viewEnd, viewWindow } = model.engine;
    useImperativeHandle(
      ref,
      () => ({
        resetZoom: () => scheduleOnUI(resetPinchZoom, { viewEnd, viewWindow }),
      }),
      [viewEnd, viewWindow],
    );
    if (model.yAxisCfg) {
      return <ChartWithYAxis model={model} />;
    }
    if (model.degenCfg) {
      return <ChartWithDegen model={model} yAxisEntries={null} />;
    }
    return <ChartView model={model} yAxisEntries={null} degen={null} />;
  },
);
