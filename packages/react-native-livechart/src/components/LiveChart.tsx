import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

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
  resolveAreaDots,
  resolveAxisLabel,
  resolveBadge,
  resolveDegen,
  resolveDot,
  resolveGradient,
  resolveGridStyle,
  resolveLeftEdgeFade,
  resolveMarkerCluster,
  resolveMetrics,
  resolvePulse,
  resolveScrub,
  resolveScrubAction,
  resolveSelectionDot,
  resolveThreshold,
  resolveTradeStream,
  resolveValueLine,
  resolveVolume,
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
import { useChartOverlayContext } from "../hooks/useChartOverlayContext";
import { useChartPaths } from "../hooks/useChartPaths";
import { useChartReveal } from "../hooks/useChartReveal";
import { useChartSkiaFont } from "../hooks/useChartSkiaFont";
import { useCrosshair } from "../hooks/useCrosshair";
import { useDegen } from "../hooks/useDegen";
import { useLiveChartHasData } from "../hooks/useLiveChartHasData";
import { useLiveDot } from "../hooks/useLiveDot";
import { useMarkers } from "../hooks/useMarkers";
import { useReferenceDrag } from "../hooks/useReferenceDrag";
import { useReferenceLinePress } from "../hooks/useReferenceLinePress";
import { useModeBlend } from "../hooks/useModeBlend";
import { useMomentum } from "../hooks/useMomentum";
import { AXIS_GRAB_MIN_PX, usePanScroll } from "../hooks/usePanScroll";
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
import { computeScrubDotY } from "../hooks/crosshairShared";
import {
  groupReferenceLines,
  type ReferenceGrouping,
} from "../math/referenceGroup";
import {
  collectReferenceValues,
  referenceLineForm,
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
  LiveChartPalette,
  LiveChartProps,
  Marker,
  TradeEvent,
} from "../types";
import {
  ThresholdBadgeOverlay,
  ThresholdLineOverlay,
} from "./ThresholdLineOverlay";
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
import { TradeStreamOverlay } from "./TradeStreamOverlay";
import { ValueLineOverlay } from "./ValueLineOverlay";
import { XAxisOverlay } from "./XAxisOverlay";
import { YAxisOverlay } from "./YAxisOverlay";

/** Translucent fill alpha for the threshold profit/loss band. */
const THRESHOLD_FILL_OPACITY = 0.16;

/** Stable empty grouping result (identity-stable so downstream worklets don't
 *  re-run) used when reference-line grouping is off. */
const EMPTY_GROUPING: ReferenceGrouping = { hidden: [], groups: [] };

/** Stable empty number array so the live-reference-values worklet stays
 *  referentially stable (no engine re-fit) when no line is draggable. */
const EMPTY_NUMS: number[] = [];

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
/** Default press-and-hold (ms) before scrub engages in the `holdToScrub`
 *  time-scroll mode, so a quick one-finger drag scrolls instead. Overridden by
 *  `timeScroll.scrubHoldMs`, then `scrub.panGestureDelay`. */
const HOLD_TO_SCRUB_MS = 500;

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

  // ── Candlestick ─────────────────────────────────────────────────────────
  mode = "line",
  candles,
  candleWidth = 60,
  liveCandle,
  volume,

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
  timeScroll = false,
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
  onMarkerPress,
  markerHitRadius = 16,
  markerCluster,
  renderMarker,
  renderTooltip,
  renderOverlay,
  renderReferenceLine,
  referenceLineGrouping,
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
  // Volume bars sit below the candles — a candle-mode-only feature (inert in
  // line mode, like the candle paths themselves).
  const volumeCfg = isCandle ? resolveVolume(volume) : null;
  const volumeBandHeight = volumeCfg?.maxHeight ?? 0;
  const gradientCfg = isCandle ? null : resolveGradient(gradient);
  // Dot-lattice area fill (clipped to the under-line region). Inert in candle
  // mode, same as the gradient fill.
  const areaDotsCfg = isCandle ? null : resolveAreaDots(areaDots);
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
    const active = dragActive.value;
    const cur = dragValues.value;
    const seeded = seededRef.current;
    dragValues.value = allRefLines.map((l, i) => {
      const prop = l.value ?? 0;
      if (active[i]) return cur[i] ?? prop; // mid-drag → keep the dragged value
      if (l.value !== seeded[i]) return prop; // prop changed → adopt (controlled)
      return cur[i] ?? prop; // unchanged → keep current (uncontrolled persist)
    });
    seededRef.current = allRefLines.map((l) => l.value);
    if (dragActive.value.length !== allRefLines.length) {
      dragActive.value = allRefLines.map((_, i) => active[i] ?? false);
    }
    // allRefLines is rebuilt every render; key off the value signature + length.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refValueSig, allRefLines.length]);

  // Form-A lines a custom `renderReferenceLine` owns → suppress their built-in tag
  // (no double-draw). Probed on the JS thread, index-aligned with `allRefLines`.
  const refLineCustom = customReferenceLineFlags(allRefLines, renderReferenceLine);

  // Live Y values of the *draggable* Form-A lines, folded into the engine's
  // axis-range fit so dragging a line toward / past the visible edge expands the
  // range and the axis follows the finger in one motion (the committed values are
  // already in `refValues`). `excludeFromRange` lines opt out, matching the static
  // fit. Identity-stable (no re-fit) when nothing is draggable.
  const draggableRefIdx = allRefLines
    .map((l, i) =>
      l.draggable && !l.excludeFromRange && referenceLineForm(l) === "line"
        ? i
        : -1,
    )
    .filter((i) => i >= 0);
  const liveRefValues = useDerivedValue<number[]>(() => {
    if (draggableRefIdx.length === 0) return EMPTY_NUMS;
    const dv = dragValues.get();
    const out: number[] = [];
    for (let k = 0; k < draggableRefIdx.length; k++) {
      const v = dv[draggableRefIdx[k]];
      if (v != null) out.push(v);
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
    setValueLayoutSample(value.get());
  }, [value]);

  // `scrolledBack` mirrors the UI-thread scroll state (engine.viewEnd != null)
  // onto the JS thread (set by the reaction below, after the engine exists).
  const [scrolledBack, setScrolledBack] = useState(false);
  const timeScrollEnabled = Boolean(timeScroll) && !isStatic;

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
    volumeBandHeight,
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
    liveReferenceValues: liveRefValues,
    nonNegative,
    maxValue,
    windowBuffer,
    nowOverride,
    mode,
    candles: isCandle ? candlesEngine : candles,
    liveCandle: isCandle ? liveEngine : liveCandle,
  });

  // Mirror the UI-thread scroll state to React so the floating y-axis can keep
  // a right gutter at the live edge and collapse it only while scrolled back.
  // Fires once per null↔frozen transition, and only matters for float+timeScroll.
  useAnimatedReaction(
    () => engine.viewEnd.value != null,
    /* istanbul ignore next -- Reanimated reaction; state mirrored on the JS thread, not exercised under Jest */
    (isScrolled, prev) => {
      if (isScrolled !== prev && yAxisFloat && timeScrollEnabled) {
        scheduleOnRN(setScrolledBack, isScrolled);
      }
    },
  );

  // ── Mode crossfade (line ↔ candle) ──────────────────────────────────
  const { lineGroupOpacity, candleGroupOpacity } = useModeBlend(
    isCandle,
    reveal.lineOpacity,
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
        refLineCustom[i]
      ) {
        ys.push(-1);
        continue;
      }
      const v = dragValues.get()[i] ?? l.value;
      const y = computeScrubDotY(v, dMin, dMax, ch, top, effectivePadding.bottom);
      ys.push(y < 0 ? -1 : Math.min(bottom, Math.max(top, y)));
    }
    return groupReferenceLines(ys, refGroupingRadius);
  });
  const groupHidden = useDerivedValue<boolean[]>(
    () => refGroupResult.get().hidden,
  );

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

  // Straight polyline instead of the monotone cubic when line.curve === "linear".
  // Shared by the path builders and the marker anchoring so glyphs sit on the
  // rendered line rather than the phantom spline.
  const lineIsLinear = lineProp?.curve === "linear";

  const { linePath, fillPath, thresholdFillPath } = useChartPaths(
    engine,
    effectivePadding,
    reveal.morphT,
    // Only build the band path when the fill is actually on.
    thresholdCfg?.fill ? thresholdGeom.lineY : undefined,
    lineIsLinear,
    // Tip the line at the view-edge price (not the live value) while scrolled,
    // matching the live dot — so the right edge doesn't drop to the off-screen
    // live value when `followViewEdge` tracks the scrolled-back window.
    engine.edgeValue,
    badgeCfg?.followViewEdge ?? false,
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

  const {
    upBodiesPath,
    downBodiesPath,
    upWicksPath,
    downWicksPath,
    upBarsPath,
    downBarsPath,
  } = useCandlePaths(
    engine,
    effectivePadding,
    // Match engine: stashed candles while reverse-morphing in candle mode.
    isCandle ? candlesEngine : candles,
    isCandle ? liveEngine : liveCandle,
    candleWidth,
    isCandle,
    metricsCfg.candle,
    volumeBandHeight,
    volumeCfg?.radius ?? 0,
    !isStatic, // static: no candle-width lerp loop
  );
  const { dotX, dotY } = useLiveDot(
    engine,
    effectivePadding,
    engine.edgeValue,
    badgeCfg?.followViewEdge ?? false,
  );

  // Price↔pixel / time↔pixel bridge for a custom `renderOverlay`. Built
  // unconditionally (hooks rule); only mounted when `renderOverlay` is provided.
  const overlayContext = useChartOverlayContext(engine, effectivePadding);

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
    badgeFont,
    badgeCfg?.variant ?? "default",
    badgeCfg?.tail ?? true,
    momentumSV,
    badgeCfg?.position ?? "right",
    badgeCfg?.background,
    metricsCfg.badge,
    metricsCfg.motion.badgeColorSpeed,
    effectiveYAxisFloat,
    engine.edgeValue,
    badgeCfg?.followViewEdge ?? false,
    badgeCfg?.radius,
    badgeCfg?.textColor,
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

  // Combined "defer" hit-test for the scrub-action place-tap: yield to a marker or
  // a pressable badge under the finger so the tap is routed there instead of
  // dropping a reticle. (Both hit-tests return false when their feature is off.)
  /* istanbul ignore next -- worklet runs on the UI thread, not in Jest */
  const deferTapHit = (x: number, y: number): boolean => {
    "worklet";
    return markerHitTest(x, y) || refLineHitTest(x, y);
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
    scrubHoldMs,
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
    // Axis-drag time-scroll: keep the bottom "time ruler" band scroll-only so a
    // drag there never trips the scrub crosshair.
    timeScrollEnabled && scrollGestureMode === "axisDrag"
      ? Math.max(effectivePadding.bottom, AXIS_GRAB_MIN_PX)
      : 0,
  );

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
    // Clear any live crosshair when a scroll drag takes over.
    onScrollStart: () => {
      "worklet";
      crosshair.scrubActive.set(false);
    },
  });

  // Draggable reference lines: a per-line vertical pan that grabs a line near its
  // value and drags it along the Y-axis (with snap / bounds / callbacks). Built
  // unconditionally for stable hook order; the gesture self-disables when no line
  // opts in, and it's only composed into the root when `refDragEnabled`.
  const refDragEnabled =
    !isStatic && allRefLines.some((l) => l.draggable === true);
  const refDragGesture = useReferenceDrag(
    engine,
    effectivePadding,
    allRefLines,
    dragValues,
    dragActive,
    !isStatic,
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
    dotOuterRadius,
    gridStyleCfg,
    degenCfg,
    tradeStreamResolved,
    leftEdgeFadeCfg,
    metricsCfg,
    allRefLines,
    refLineCustom,
    dragValues,
    dragActive,
    renderReferenceLine,
    refGroupingActive: refGroupingRadius != null,
    refGroupResult,
    groupHidden,
    refGroupBadge,
    refGroupBadgeFont,
    refGroupFormat,
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
    fontProp,
    valueFont,
    badgeFont,
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
    lineIsLinear,
    upBodiesPath,
    downBodiesPath,
    upWicksPath,
    downWicksPath,
    upBarsPath,
    downBarsPath,
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
    markerClusterCfg,
    renderMarker,
    renderTooltip,
    renderOverlay,
    overlayContext,
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
    yAxisFloat,
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
  } = model;

  return (
    <Group transform={degenShakeTransform}>
      {/* Y-axis. Default: grid + labels here (in a reserved gutter). Floating
          mode: grid only — the labels + a soft edge fade draw above the candles
          in ChartStack so the plot runs full-width and candles dim under them. */}
      {yAxisCfg && (
        <Group opacity={reveal.yAxisOpacity}>
          <YAxisOverlay
            variant={yAxisFloat ? "grid" : "all"}
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
    fontProp,
    badgeCfg,
    valueLineCfg,
    dotY,
    allRefLines,
    dragValues,
    resolvedSegments,
    hasRecolorSegments,
    segmentGradient,
    thresholdCfg,
    thresholdGeom,
    thresholdStrokeColors,
    formatValue,
    lineGroupOpacity,
    linePath,
    lineIsLinear,
    strokeWidth,
    lineProp,
    candleGroupOpacity,
    upWicksPath,
    downWicksPath,
    upBodiesPath,
    downBodiesPath,
    upBarsPath,
    downBarsPath,
    volumeActive,
    volumeBandHeight,
    volumeOpacity,
    volumeUpColor,
    volumeDownColor,
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
    markerClusterCfg,
    renderMarker,
    emptyText,
    metricsCfg,
    layoutWidth,
    yAxisCfg,
    yAxisFloat,
    yAxisEntries,
    badgeUsesRightGutter,
    gridStyleCfg,
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
          fontProp={fontProp}
          dragValues={dragValues}
          index={i}
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
          strokeWidth={metricsCfg.candle.wickWidth}
          color={palette.wickUp}
        />
        <Path
          path={downWicksPath}
          style="stroke"
          strokeWidth={metricsCfg.candle.wickWidth}
          color={palette.wickDown}
        />
        <Path path={upBodiesPath} style="fill" color={palette.candleUp} />
        <Path
          path={downBodiesPath}
          style="fill"
          color={palette.candleDown}
        />
      </Group>

      {/* Volume bars in the reserved band below the candles. Fades in with the
          candle group (outer opacity); the config opacity dims the whole band
          (inner). Up/down bars carry their own colors (default candle palette). */}
      {volumeActive && (
        <Group opacity={candleGroupOpacity}>
          <Group opacity={volumeOpacity}>
            <Path path={upBarsPath} style="fill" color={volumeUpColor} />
            <Path path={downBarsPath} style="fill" color={volumeDownColor} />
          </Group>
        </Group>
      )}

      {/* Floating axis: the labels float ABOVE the candles (right-aligned at the
          edge) so the plot runs full-width and candles stay fully visible behind
          them. (Default non-floating axis draws grid + labels in ChartFillLayer.) */}
      {yAxisCfg && yAxisFloat && (
        <Group opacity={reveal.yAxisOpacity}>
          <YAxisOverlay
            variant="labels"
            float
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

      {/* X-axis time labels. With a volume band the bottom padding is inflated by
          the band height; pass it so the axis shifts back to the very bottom. */}
      {xAxisCfg && (
        <XAxisOverlay
          entries={xAxisEntries}
          engine={engine}
          padding={effectivePadding}
          palette={palette}
          font={skiaFont}
          volumeBandHeight={volumeBandHeight}
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
            viewEnd={engine.viewEnd}
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
  const { badgeCfg, badgeData, badgeFont, reveal, degenShakeTransform } = model;
  if (!badgeCfg) return null;
  return (
    <Group transform={degenShakeTransform}>
      <Group opacity={reveal.badgeOpacity}>
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
function ChartRefBadgeLayer({ model }: { model: LiveChartModel }) {
  const {
    allRefLines,
    refLineCustom,
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
          fontProp={fontProp}
          badgeLayer
          dragValues={dragValues}
          index={i}
          suppressTag={refLineCustom[i]}
          groupHidden={refGroupingActive ? groupHidden : undefined}
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
    markerClusterCfg,
    renderMarker,
    renderTooltip,
    renderOverlay,
    renderReferenceLine,
    allRefLines,
    refLineCustom,
    dragValues,
    dragActive,
    overlayContext,
    scrubCfg,
    crosshair,
    isCandle,
    extremaTimeOffset,
    topConnector,
    bottomConnector,
    lineIsLinear,
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
            lineLinear={lineIsLinear}
            cluster={markerClusterCfg}
          />
        )}

        {/* Custom-rendered reference-line tags — RN views floated over the canvas
            (non-Skia), pinned to each Form-A line's value. Sibling of <Canvas>.
            Built-in Skia tags for these lines are suppressed (no double-draw). */}
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

        {/* Custom consumer overlay — an RN view tree floated over the canvas with
            the price↔pixel / time↔pixel bridge, for order / avg-entry / liquidation
            tags etc. Topmost RN sibling; `box-none` so empty areas still scrub. */}
        {renderOverlay && (
          <ChartOverlayLayer render={renderOverlay} context={overlayContext} />
        )}
      </View>
    </GestureDetector>
  );
}
