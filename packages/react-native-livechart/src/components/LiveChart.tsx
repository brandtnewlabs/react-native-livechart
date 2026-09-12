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
import {
  dotGlowRadialOutset,
  pulseRadialOutset,
  type ChartPadding,
} from "../draw/line";
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
import { CustomThresholdBadgeOverlay } from "./CustomThresholdBadgeOverlay";
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

function resolveLiveChartFeatureConfig({
  mode,
  yAxis,
  xAxis,
  topLabel,
  bottomLabel,
  badge,
  scrub,
  scrubAction,
  volume,
  candleGaps,
  lineGaps,
  gradient,
  areaDots,
  threshold,
  valueLine,
  isStatic,
  pulse,
  dot,
  selectionDot,
  gridStyle,
  degen,
  tradeStream,
  metrics,
}: Pick<
  LiveChartProps,
  | "mode"
  | "yAxis"
  | "xAxis"
  | "topLabel"
  | "bottomLabel"
  | "badge"
  | "scrub"
  | "scrubAction"
  | "volume"
  | "candleGaps"
  | "lineGaps"
  | "gradient"
  | "areaDots"
  | "threshold"
  | "valueLine"
  | "pulse"
  | "dot"
  | "selectionDot"
  | "gridStyle"
  | "degen"
  | "tradeStream"
  | "metrics"
> & { isStatic: boolean }) {
  const isCandle = mode === "candle";
  const badgeCfg = resolveBadge(badge);
  const chartGapsCfg = resolveCandleGaps(isCandle ? candleGaps : lineGaps);
  const thresholdCfg = isCandle ? null : resolveThreshold(threshold);
  const thresholdSeriesSV = thresholdCfg?.series ?? null;
  const dotCfg = resolveDot(dot);
  const volumeCfg = isCandle ? resolveVolume(volume) : null;

  return {
    isCandle,
    yAxisCfg: resolveYAxis(yAxis),
    xAxisCfg: resolveXAxis(xAxis),
    topLabelCfg: resolveAxisLabel(topLabel),
    bottomLabelCfg: resolveAxisLabel(bottomLabel),
    badgeCfg,
    scrubCfg: resolveScrub(scrub),
    scrubActionCfg: resolveScrubAction(scrubAction),
    volumeCfg,
    chartGapsCfg,
    candleGapsCfg: isCandle ? chartGapsCfg : null,
    lineGapsCfg: isCandle ? null : chartGapsCfg,
    volumeBandHeight: volumeCfg?.maxHeight ?? 0,
    gradientCfg: isCandle ? null : resolveGradient(gradient),
    areaDotsCfg: isCandle ? null : resolveAreaDots(areaDots),
    thresholdCfg,
    thresholdSeriesSV,
    thresholdIsSeries:
      thresholdSeriesSV !== null || Array.isArray(thresholdCfg?.value),
    valueLineCfg: resolveValueLine(valueLine),
    pulseCfg: isStatic ? null : resolvePulse(pulse),
    dotCfg,
    dotTracksParked:
      dotCfg.trackWhileParked && !(badgeCfg?.followViewEdge ?? false),
    selectionDotCfg: resolveSelectionDot(selectionDot),
    dotOuterRadius: Math.max(
      dotCfg.radius + (dotCfg.ring?.width ?? 0),
      dotCfg.glow
        ? dotGlowRadialOutset(dotCfg.glow.radius, dotCfg.glow.blur)
        : 0,
    ),
    gridStyleCfg: resolveGridStyle(gridStyle),
    degenCfg: isStatic ? null : resolveDegen(degen),
    tradeStreamResolved: resolveTradeStream(tradeStream),
    metricsCfg: resolveMetrics(metrics),
  };
}

function resolveLiveChartReferenceConfig({
  chartGapsCfg,
  referenceLines,
  renderReferenceLine,
  renderOffAxisReferenceLine,
  thresholdCfg,
  referenceLineGrouping,
  badgeCfg,
}: {
  chartGapsCfg: ReturnType<typeof resolveCandleGaps>;
  referenceLines: LiveChartProps["referenceLines"];
  renderReferenceLine: LiveChartProps["renderReferenceLine"];
  renderOffAxisReferenceLine: LiveChartProps["renderOffAxisReferenceLine"];
  thresholdCfg: ReturnType<typeof resolveThreshold>;
  referenceLineGrouping: LiveChartProps["referenceLineGrouping"];
  badgeCfg: ReturnType<typeof resolveBadge>;
}) {
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
  const consumerRefLines = referenceLines ?? [];
  const allRefLines = [...consumerRefLines, ...chartGapBands];
  const refLineCustom = [
    ...customReferenceLineFlags(consumerRefLines, renderReferenceLine),
    ...chartGapBands.map(() => false),
  ];
  const refLineOffAxisCustom = [
    ...customReferenceLineFlags(
      consumerRefLines,
      renderOffAxisReferenceLine,
      "off-axis",
    ),
    ...chartGapBands.map(() => false),
  ].map((custom, index) => custom && !refLineCustom[index]);
  const draggableRefIdx: number[] = [];
  for (let index = 0; index < allRefLines.length; index++) {
    const line = allRefLines[index];
    if (
      line.draggable &&
      !line.excludeFromRange &&
      referenceLineForm(line) === "line"
    ) {
      draggableRefIdx.push(index);
    }
  }
  const thresholdInRange = thresholdCfg?.includeInRange === true;
  const thresholdRangeValueSV =
    thresholdInRange &&
    thresholdCfg?.value != null &&
    !Array.isArray(thresholdCfg.value)
      ? thresholdCfg.value
      : null;
  const refGroupingCfg =
    typeof referenceLineGrouping === "object"
      ? referenceLineGrouping
      : undefined;

  return {
    chartGapBands,
    allRefLines,
    refValues: collectReferenceValues(allRefLines),
    refLineCustom,
    refLineOffAxisCustom,
    refLineKeys: referenceLineReactKeys(allRefLines),
    draggableRefIdx,
    thresholdInRange,
    thresholdRangeValueSV,
    refGroupingCfg,
    refGroupingRadius: referenceLineGrouping
      ? (refGroupingCfg?.radius ?? 18)
      : null,
    refGroupBadge: resolveReferenceGroupBadge(refGroupingCfg?.badge),
    refGroupFormat: refGroupingCfg?.format,
    badgeUsesRightGutter:
      badgeCfg !== null && (badgeCfg.position ?? "right") === "right",
  };
}

function useLiveReferenceState(
  allRefLines: ReferenceLine[],
  draggableRefIdx: number[],
  thresholdRangeValueSV: SharedValue<number> | null,
) {
  const dragValues = useSharedValue<number[]>([]);
  const dragActive = useSharedValue<boolean[]>([]);
  const seededRef = useRef<(number | undefined)[]>([]);
  const refValueSig = allRefLines.map((line) => line.value ?? "_").join(",");
  useEffect(() => {
    const active = dragActive.get();
    const current = dragValues.get();
    const seeded = seededRef.current;
    dragValues.set(
      allRefLines.map((line, index) => {
        const prop = line.value ?? 0;
        if (active[index]) return current[index] ?? prop;
        if (line.value !== seeded[index]) return prop;
        return current[index] ?? prop;
      }),
    );
    seededRef.current = allRefLines.map((line) => line.value);
    if (dragActive.get().length !== allRefLines.length) {
      dragActive.set(allRefLines.map((_, index) => active[index] ?? false));
    }
    // The line list is reconstructed from props; its value signature and length
    // are the stable reconciliation inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refValueSig, allRefLines.length]);

  const refLineCustomTagWidths = useSharedValue<number[]>([]);
  const liveRefValues = useDerivedValue<number[]>(() => {
    if (draggableRefIdx.length === 0 && thresholdRangeValueSV === null) {
      return EMPTY_NUMS;
    }
    const output: number[] = [];
    if (draggableRefIdx.length > 0) {
      const values = dragValues.get();
      for (let index = 0; index < draggableRefIdx.length; index++) {
        const value = values[draggableRefIdx[index]];
        if (value != null) output.push(value);
      }
    }
    if (thresholdRangeValueSV !== null) {
      const value = thresholdRangeValueSV.get();
      if (Number.isFinite(value)) output.push(value);
    }
    return output;
  });

  return { dragValues, dragActive, refLineCustomTagWidths, liveRefValues };
}

function resolveLiveChartPresentationConfig({
  accentColor,
  theme,
  paletteOverride,
  segments,
  leftEdgeFade,
  fontProp,
  badgeCfg,
  refGroupBadge,
  pulseCfg,
  timeScroll,
  isStatic,
  returnToLive,
  zoom,
  yAxisCfg,
}: {
  accentColor: string;
  theme: NonNullable<LiveChartProps["theme"]>;
  paletteOverride: LiveChartProps["palette"];
  segments: LiveChartProps["segments"];
  leftEdgeFade: LiveChartProps["leftEdgeFade"];
  fontProp: LiveChartProps["font"];
  badgeCfg: ReturnType<typeof resolveBadge>;
  refGroupBadge: ReturnType<typeof resolveReferenceGroupBadge>;
  pulseCfg: ReturnType<typeof resolvePulse>;
  timeScroll: LiveChartProps["timeScroll"];
  isStatic: boolean;
  returnToLive: LiveChartProps["returnToLive"];
  zoom: LiveChartProps["zoom"];
  yAxisCfg: ReturnType<typeof resolveYAxis>;
}) {
  const palette = applyPaletteOverride(
    resolveTheme(accentColor, theme),
    paletteOverride,
  );
  const resolvedSegments = (segments ?? []).map((segment) =>
    resolveSegment(segment, {
      muted: palette.gridLabel,
      divider: palette.refLine,
      label: palette.refLabel,
    }),
  );
  const badgeHasFontOverride =
    badgeCfg?.fontSize != null ||
    badgeCfg?.fontFamily != null ||
    badgeCfg?.fontWeight != null;
  const refGroupBadgeHasFont =
    refGroupBadge.fontSize != null ||
    refGroupBadge.fontFamily != null ||
    refGroupBadge.fontWeight != null;
  const timeScrollEnabled = Boolean(timeScroll) && !isStatic;
  const zoomCfg = resolveZoom(zoom);

  return {
    palette,
    resolvedSegments,
    hasRecolorSegments: resolvedSegments.some((segment) => segment.recolorLine),
    leftEdgeFadeCfg: resolveLeftEdgeFade(
      leftEdgeFade,
      leftEdgeFadeColorsFromBgRgb(palette.bgRgb),
    ),
    badgeHasFontOverride,
    badgeFontConfig: badgeHasFontOverride
      ? {
          ...fontProp,
          fontFamily: badgeCfg?.fontFamily ?? fontProp?.fontFamily,
          fontSize: badgeCfg?.fontSize ?? fontProp?.fontSize,
          fontWeight: badgeCfg?.fontWeight ?? fontProp?.fontWeight,
        }
      : fontProp,
    refGroupBadgeHasFont,
    refGroupBadgeFontConfig: refGroupBadgeHasFont
      ? {
          ...fontProp,
          fontFamily: refGroupBadge.fontFamily ?? fontProp?.fontFamily,
          fontSize: refGroupBadge.fontSize ?? fontProp?.fontSize,
          fontWeight: refGroupBadge.fontWeight ?? fontProp?.fontWeight,
        }
      : fontProp,
    pulseConfig: pulseCfg
      ? {
          maxRadius: pulseCfg.maxRadius,
          strokeWidth: pulseCfg.strokeWidth,
        }
      : null,
    timeScrollEnabled,
    returnToLiveMs: resolveReturnToLiveMs(returnToLive),
    timeScrollOverscroll: timeScrollEnabled ? resolveOverscroll(timeScroll) : 0,
    timeScrollFling: resolveFling(timeScroll),
    zoomCfg,
    zoomEnabled: zoomCfg !== null && !isStatic,
    yAxisFloat: yAxisCfg?.float ?? false,
  };
}

function resolveThresholdColorConfig(
  thresholdCfg: ReturnType<typeof resolveThreshold>,
  palette: LiveChartPalette,
  lineProp: LiveChartProps["line"],
) {
  return {
    stopColors: thresholdCfg ? thresholdStops(thresholdCfg, palette) : null,
    splitAbove: thresholdCfg
      ? (thresholdCfg.aboveColor ?? palette.candleUp)
      : null,
    splitBelow: thresholdCfg
      ? (thresholdCfg.belowColor ?? palette.candleDown)
      : null,
    fillOpacity: thresholdCfg?.fillOpacity ?? THRESHOLD_FILL_OPACITY_DEFAULT,
    lineColor: lineProp?.color ?? palette.line,
  };
}

function useThresholdGeometryState({
  engine,
  padding,
  thresholdCfg,
  thresholdSeriesSV,
  emptyThresholdValue,
}: {
  engine: ReturnType<typeof useLiveChartEngine>;
  padding: ChartPadding;
  thresholdCfg: ReturnType<typeof resolveThreshold>;
  thresholdSeriesSV: SharedValue<LiveChartPoint[]> | null;
  emptyThresholdValue: SharedValue<number>;
}) {
  const thresholdValue = thresholdCfg?.value ?? emptyThresholdValue;
  const [svSeriesNonEmpty, setSvSeriesNonEmpty] = useState(false);
  useAnimatedReaction(
    () => (thresholdSeriesSV ? thresholdSeriesSV.get().length > 0 : false),
    /* istanbul ignore next -- UI-thread reaction */ (hasPoints, previous) => {
      if (hasPoints !== previous) {
        scheduleOnRN(setSvSeriesNonEmpty, hasPoints);
      }
    },
  );
  return {
    thresholdSeriesHasPoints: thresholdSeriesSV
      ? svSeriesNonEmpty
      : Array.isArray(thresholdCfg?.value) && thresholdCfg.value.length > 0,
    thresholdGeom: useThreshold(engine, padding, thresholdValue),
    thresholdSeriesGeom: useThresholdSeries(
      engine,
      padding,
      thresholdValue,
      thresholdSeriesSV,
      thresholdCfg?.extendToNow ?? true,
      thresholdCfg?.line?.labelAnchor ?? "last",
    ),
  };
}

function useThresholdShaderUniforms({
  engine,
  padding,
  samples,
  clipRightX,
  thresholdCfg,
  palette,
  lineProp,
}: {
  engine: ReturnType<typeof useLiveChartEngine>;
  padding: ChartPadding;
  samples: SharedValue<number[]>;
  clipRightX: SharedValue<number>;
  thresholdCfg: ReturnType<typeof resolveThreshold>;
  palette: LiveChartPalette;
  lineProp: LiveChartProps["line"];
}) {
  const { stopColors, splitAbove, splitBelow, fillOpacity, lineColor } =
    resolveThresholdColorConfig(thresholdCfg, palette, lineProp);
  const vectors = useMemo(() => {
    if (splitAbove === null || splitBelow === null) return null;
    const [r, g, b, a] = parseColorRgba(lineColor);
    return {
      ...thresholdSplitColorVecs(splitAbove, splitBelow, fillOpacity),
      strokeRest: [r / 255, g / 255, b / 255, a],
    };
  }, [splitAbove, splitBelow, fillOpacity, lineColor]);
  return {
    thresholdStrokeColors: stopColors?.stroke ?? null,
    thresholdFillColors: stopColors?.fill ?? null,
    thresholdStrokeUniforms: useThresholdSplitUniforms(
      samples,
      engine,
      padding,
      vectors?.strokeAbove ?? THRESHOLD_FALLBACK_COLOR,
      vectors?.strokeBelow ?? THRESHOLD_FALLBACK_COLOR,
      vectors?.strokeRest ?? THRESHOLD_FALLBACK_COLOR,
      clipRightX,
    ),
    thresholdFillUniforms: useThresholdSplitUniforms(
      samples,
      engine,
      padding,
      vectors?.fillAbove ?? THRESHOLD_FALLBACK_COLOR,
      vectors?.fillBelow ?? THRESHOLD_FALLBACK_COLOR,
      TRANSPARENT_VEC4,
      clipRightX,
    ),
  };
}

function useThresholdBadgeProjection({
  thresholdCfg,
  thresholdIsSeries,
  thresholdGeom,
  thresholdSeriesGeom,
  renderThresholdBadge,
  formatValue,
}: {
  thresholdCfg: ReturnType<typeof resolveThreshold>;
  thresholdIsSeries: boolean;
  thresholdGeom: ReturnType<typeof useThreshold>;
  thresholdSeriesGeom: ReturnType<typeof useThresholdSeries>;
  renderThresholdBadge: LiveChartProps["renderThresholdBadge"];
  formatValue: (value: number) => string;
}) {
  const lineY = thresholdIsSeries
    ? thresholdSeriesGeom.badgeLineY
    : thresholdGeom.lineY;
  const markerVisible = thresholdIsSeries
    ? thresholdSeriesGeom.visible
    : thresholdGeom.visible;
  const badgeVisible = thresholdIsSeries
    ? thresholdSeriesGeom.badgeVisible
    : thresholdGeom.visible;
  const markerValue =
    thresholdCfg && !thresholdIsSeries && !Array.isArray(thresholdCfg.value)
      ? (thresholdCfg.value ?? thresholdSeriesGeom.badgeValue)
      : thresholdSeriesGeom.badgeValue;
  const custom = thresholdCfg?.line != null && renderThresholdBadge != null;
  const valueStr = useDerivedValue(() =>
    custom ? formatValue(markerValue.get()) : "",
  );
  return {
    thresholdMarkerLineY: lineY,
    thresholdMarkerVisible: markerVisible,
    thresholdBadgeVisible: badgeVisible,
    thresholdMarkerValue: markerValue,
    thresholdCustomBadge:
      thresholdCfg?.line && renderThresholdBadge
        ? renderThresholdBadge({
            line: thresholdCfg.line,
            value: markerValue,
            valueStr,
            y: lineY,
            visible: badgeVisible,
          })
        : null,
    thresholdSeriesPts: thresholdIsSeries
      ? thresholdSeriesGeom.screenPts
      : undefined,
  };
}

function useLiveChartThresholdModel({
  engine,
  padding,
  thresholdCfg,
  thresholdSeriesSV,
  thresholdIsSeries,
  emptyThresholdValue,
  palette,
  lineProp,
  renderThresholdBadge,
  formatValue,
}: {
  engine: ReturnType<typeof useLiveChartEngine>;
  padding: ChartPadding;
  thresholdCfg: ReturnType<typeof resolveThreshold>;
  thresholdSeriesSV: SharedValue<LiveChartPoint[]> | null;
  thresholdIsSeries: boolean;
  emptyThresholdValue: SharedValue<number>;
  palette: LiveChartPalette;
  lineProp: LiveChartProps["line"];
  renderThresholdBadge: LiveChartProps["renderThresholdBadge"];
  formatValue: (value: number) => string;
}) {
  const { thresholdSeriesHasPoints, thresholdGeom, thresholdSeriesGeom } =
    useThresholdGeometryState({
      engine,
      padding,
      thresholdCfg,
      thresholdSeriesSV,
      emptyThresholdValue,
    });
  const shaderModel = useThresholdShaderUniforms({
    engine,
    padding,
    samples: thresholdSeriesGeom.samples,
    clipRightX: thresholdSeriesGeom.clipRightX,
    thresholdCfg,
    palette,
    lineProp,
  });
  const badgeModel = useThresholdBadgeProjection({
    thresholdCfg,
    thresholdIsSeries,
    thresholdGeom,
    thresholdSeriesGeom,
    renderThresholdBadge,
    formatValue,
  });

  return {
    thresholdGeom,
    thresholdSeriesHasPoints,
    ...shaderModel,
    ...badgeModel,
    thresholdFillLineY:
      thresholdCfg?.fill && !thresholdIsSeries
        ? thresholdGeom.lineY
        : undefined,
    thresholdFillSamples:
      thresholdCfg?.fill && thresholdSeriesHasPoints
        ? thresholdSeriesGeom.samples
        : undefined,
  };
}

function resolveLiveChartInteractionConfig({
  isCandle,
  mode,
  candlesEngine,
  liveEngine,
  candleWidth,
  candleGapsCfg,
  lineGapsCfg,
  markers,
  markerCluster,
  onReferenceLinePress,
  allRefLines,
  isStatic,
  timeScroll,
  timeScrollEnabled,
  scrubCfg,
}: {
  isCandle: boolean;
  mode: "line" | "candle";
  candlesEngine: SharedValue<CandlePoint[]>;
  liveEngine: SharedValue<CandlePoint | null>;
  candleWidth: number;
  candleGapsCfg: ResolvedCandleGapsConfig | null;
  lineGapsCfg: ResolvedCandleGapsConfig | null;
  markers: LiveChartProps["markers"];
  markerCluster: LiveChartProps["markerCluster"];
  onReferenceLinePress: LiveChartProps["onReferenceLinePress"];
  allRefLines: ReferenceLine[];
  isStatic: boolean;
  timeScroll: LiveChartProps["timeScroll"];
  timeScrollEnabled: boolean;
  scrubCfg: ReturnType<typeof resolveScrub>;
}) {
  const crosshairChartOpts = isCandle
    ? {
        mode,
        candles: candlesEngine,
        liveCandle: liveEngine,
        candleWidthSecs: candleWidth,
        gaps: candleGapsCfg?.gaps,
        bridgeNoTrades: Boolean(candleGapsCfg?.styles["no-trades"].bridge),
        bridgeUnavailable: Boolean(candleGapsCfg?.styles.unavailable.bridge),
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
  const scrollGestureMode =
    typeof timeScroll === "object"
      ? (timeScroll.gesture ?? "holdToScrub")
      : "holdToScrub";
  const timeScrollHoldMs =
    typeof timeScroll === "object" ? timeScroll.scrubHoldMs : undefined;

  return {
    crosshairChartOpts,
    markersActive: markers != null,
    markerClusterCfg: resolveMarkerCluster(markerCluster),
    refPressActive: onReferenceLinePress != null && allRefLines.length > 0,
    refDragEnabled:
      !isStatic && allRefLines.some((line) => line.draggable === true),
    scrollGestureMode,
    scrubHoldMs:
      timeScrollEnabled && scrollGestureMode === "holdToScrub"
        ? (timeScrollHoldMs ?? (scrubCfg?.panGestureDelay || HOLD_TO_SCRUB_MS))
        : (scrubCfg?.panGestureDelay ?? 0),
  };
}

function composeLiveChartRootGesture({
  crosshair,
  markerTapGesture,
  refLineTapGesture,
  refDragGesture,
  panScrollGesture,
  pinchZoomGesture,
  markersActive,
  refPressActive,
  refDragEnabled,
  scrubActionActive,
  timeScrollEnabled,
  scrollGestureMode,
  zoomEnabled,
}: {
  crosshair: ReturnType<typeof useCrosshair>;
  markerTapGesture: ReturnType<typeof useMarkers>["tapGesture"];
  refLineTapGesture: ReturnType<typeof useReferenceLinePress>["tapGesture"];
  refDragGesture: ReturnType<typeof useReferenceDrag>["gesture"];
  panScrollGesture: ReturnType<typeof usePanScroll>;
  pinchZoomGesture: ReturnType<typeof usePinchZoom>;
  markersActive: boolean;
  refPressActive: boolean;
  refDragEnabled: boolean;
  scrubActionActive: boolean;
  timeScrollEnabled: boolean;
  scrollGestureMode: "holdToScrub" | "axisDrag";
  zoomEnabled: boolean;
}) {
  const baseGesture =
    scrubActionActive && crosshair.tapGesture
      ? Gesture.Exclusive(crosshair.tapGesture, crosshair.gesture)
      : crosshair.gesture;
  const overlayTaps = [
    markersActive ? markerTapGesture : null,
    refPressActive ? refLineTapGesture : null,
  ].filter(
    (gesture): gesture is NonNullable<typeof gesture> => gesture !== null,
  );
  let rootGesture = baseGesture;
  if (overlayTaps.length > 0) {
    const tapGroup =
      overlayTaps.length === 1
        ? overlayTaps[0]
        : Gesture.Simultaneous(overlayTaps[0], overlayTaps[1]);
    rootGesture = Gesture.Simultaneous(baseGesture, tapGroup);
  }
  if (timeScrollEnabled) {
    rootGesture =
      scrollGestureMode === "axisDrag"
        ? Gesture.Exclusive(panScrollGesture, rootGesture)
        : Gesture.Race(panScrollGesture, rootGesture);
  }
  if (refDragEnabled) {
    rootGesture = Gesture.Exclusive(refDragGesture, rootGesture);
  }
  return zoomEnabled
    ? Gesture.Simultaneous(rootGesture, pinchZoomGesture)
    : rootGesture;
}

function useAxisAutoHide({
  config,
  scrollActive,
  scrubActive,
  engine,
}: {
  config: LiveChartProps["axisAutoHide"];
  scrollActive: SharedValue<boolean>;
  scrubActive: SharedValue<boolean>;
  engine: ReturnType<typeof useLiveChartEngine>;
}) {
  const resolved = config === true ? {} : config === false ? null : config;
  const idleOpacity = resolved?.idleOpacity ?? 0;
  const fadeInMs = resolved?.fadeInMs ?? 60;
  const fadeOutMs = resolved?.fadeOutMs ?? 250;
  const hideAfterMs = resolved?.hideAfterMs ?? 3000;
  const opacity = useSharedValue(resolved ? idleOpacity : 1);
  const enabled = resolved !== null;
  const last = useRef({ enabled, idleOpacity });
  useEffect(() => {
    if (
      last.current.enabled === enabled &&
      last.current.idleOpacity === idleOpacity
    ) {
      return;
    }
    last.current = { enabled, idleOpacity };
    cancelAnimation(opacity);
    opacity.value = enabled ? idleOpacity : 1;
  }, [enabled, idleOpacity, opacity]);
  useAnimatedReaction(
    () => ({
      gesture: scrollActive.value || scrubActive.value,
      viewEnd: engine.viewEnd.value,
      viewWindow: engine.viewWindow.value,
    }),
    (current, previous) => {
      if (!enabled || previous === null) return;
      const moved =
        current.gesture !== previous.gesture ||
        current.viewEnd !== previous.viewEnd ||
        current.viewWindow !== previous.viewWindow;
      if (!moved) return;
      cancelAnimation(opacity);
      opacity.value = current.gesture
        ? withTiming(1, { duration: fadeInMs })
        : withSequence(
            withTiming(1, { duration: fadeInMs }),
            withDelay(
              hideAfterMs,
              withTiming(idleOpacity, { duration: fadeOutMs }),
            ),
          );
    },
    [enabled, idleOpacity, fadeInMs, fadeOutMs, hideAfterMs],
  );
  return opacity;
}

function resolveLiveEngineModeInputs({
  isCandle,
  data,
  lineEngineData,
  candles,
  candlesEngine,
  liveCandle,
  liveEngine,
  candleGapsCfg,
  thresholdInRange,
  thresholdIsSeries,
  thresholdSeriesSV,
  thresholdCfg,
}: {
  isCandle: boolean;
  data: LiveChartProps["data"];
  lineEngineData: LiveChartProps["data"];
  candles: LiveChartProps["candles"];
  candlesEngine: SharedValue<CandlePoint[]>;
  liveCandle: LiveChartProps["liveCandle"];
  liveEngine: SharedValue<CandlePoint | null>;
  candleGapsCfg: ResolvedCandleGapsConfig | null;
  thresholdInRange: boolean;
  thresholdIsSeries: boolean;
  thresholdSeriesSV: SharedValue<LiveChartPoint[]> | null;
  thresholdCfg: ResolvedThresholdConfig | null;
}) {
  return {
    data: isCandle ? data : lineEngineData,
    thresholdRangePoints:
      thresholdInRange && thresholdIsSeries
        ? (thresholdSeriesSV ?? (thresholdCfg?.value as LiveChartPoint[]))
        : undefined,
    thresholdRangeExtendToNow: thresholdCfg?.extendToNow ?? true,
    candles: isCandle ? candlesEngine : candles,
    liveCandle: isCandle ? liveEngine : liveCandle,
    candleGaps: candleGapsCfg?.gaps,
    candleGapBridgeNoTrades: Boolean(candleGapsCfg?.styles["no-trades"].bridge),
    candleGapBridgeUnavailable: Boolean(
      candleGapsCfg?.styles.unavailable.bridge,
    ),
    candleGapBridgeUnknown: Boolean(candleGapsCfg?.styles.unknown.bridge),
  };
}

function resolveCrosshairControllerSettings({
  scrubCfg,
  scrubActionCfg,
  markersActive,
  refPressActive,
  refDragEnabled,
  deferTapHit,
  timeScrollEnabled,
  scrollGestureMode,
  effectivePadding,
}: {
  scrubCfg: ReturnType<typeof resolveScrub>;
  scrubActionCfg: ReturnType<typeof resolveScrubAction>;
  markersActive: boolean;
  refPressActive: boolean;
  refDragEnabled: boolean;
  deferTapHit: (x: number, y: number) => boolean;
  timeScrollEnabled: boolean;
  scrollGestureMode: "holdToScrub" | "axisDrag";
  effectivePadding: ChartPadding;
}) {
  return {
    enabled: scrubCfg !== null || scrubActionCfg !== null,
    deferTapHit:
      markersActive || refPressActive || refDragEnabled
        ? deferTapHit
        : undefined,
    tooltipPlacement: scrubCfg?.tooltipPlacement ?? "side",
    tooltipShowValue: scrubCfg?.tooltipShowValue ?? true,
    tooltipShowTime: scrubCfg?.tooltipShowTime ?? true,
    tooltipMargin: scrubCfg?.tooltipMargin ?? 8,
    scrubBottomExclude:
      timeScrollEnabled && scrollGestureMode === "axisDrag"
        ? Math.max(effectivePadding.bottom, AXIS_GRAB_MIN_PX)
        : 0,
    clampToPlot: scrubCfg?.clampToPlot ?? false,
    snapToCandles: scrubCfg?.snapToCandles ?? false,
  };
}

function resolveAreaDotColorVec(
  areaDotsCfg: ReturnType<typeof resolveAreaDots>,
  lineProp: LiveChartProps["line"],
  palette: LiveChartPalette,
) {
  const rgb = parseColorRgb(lineProp?.color ?? palette.line);
  const [r, g, b, a] = parseColorRgba(
    areaDotsCfg?.color ?? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.22)`,
  );
  return [r / 255, g / 255, b / 255, a * (areaDotsCfg?.opacity ?? 1)];
}

function useLiveIndicatorOpacities({
  reveal,
  seriesIndicatorOpacity,
  seriesOpacity,
  scrubActive,
  selectionDotDuringScrub,
  hideLiveOnScrollBack,
  dotTracksParked,
  viewEnd,
  fadeOverlaysOnScrub,
}: {
  reveal: ReturnType<typeof useChartReveal>;
  seriesIndicatorOpacity: SharedValue<number>;
  seriesOpacity: SharedValue<number>;
  scrubActive: SharedValue<boolean>;
  selectionDotDuringScrub: boolean;
  hideLiveOnScrollBack: boolean;
  dotTracksParked: boolean;
  viewEnd: SharedValue<number | null>;
  fadeOverlaysOnScrub: boolean;
}) {
  const liveDotOpacity = useDerivedValue(
    () =>
      reveal.dotOpacity.value *
      (selectionDotDuringScrub && scrubActive.value ? 0 : 1) *
      liveIndicatorScrollOpacity(
        hideLiveOnScrollBack && !dotTracksParked,
        viewEnd.value,
      ) *
      seriesIndicatorOpacity.value,
  );
  const valueLineOpacity = useDerivedValue(
    () =>
      reveal.lineOpacity.value *
      liveIndicatorScrollOpacity(hideLiveOnScrollBack, viewEnd.value) *
      seriesOpacity.value,
  );
  const liveBadgeOpacity = useDerivedValue(
    () =>
      reveal.badgeOpacity.value *
      liveIndicatorScrollOpacity(hideLiveOnScrollBack, viewEnd.value) *
      seriesOpacity.value,
  );
  const overlayScrubFade = useDerivedValue(() =>
    fadeOverlaysOnScrub
      ? withTiming(scrubActive.get() ? 0 : 1, {
          duration: SCRUB_OVERLAY_FADE_MS,
        })
      : 1,
  );
  const markerGroupOpacity = useDerivedValue(
    () => reveal.dotOpacity.get() * overlayScrubFade.get(),
  );
  return {
    liveDotOpacity,
    valueLineOpacity,
    liveBadgeOpacity,
    overlayScrubFade,
    markerGroupOpacity,
  };
}

function useReferenceLineGrouping({
  radius,
  engine,
  padding,
  lines,
  custom,
  offAxisCustom,
  dragValues,
}: {
  radius: number | null;
  engine: ReturnType<typeof useLiveChartEngine>;
  padding: ChartPadding;
  lines: ReferenceLine[];
  custom: boolean[];
  offAxisCustom: boolean[];
  dragValues: SharedValue<number[]>;
}) {
  const result = useDerivedValue<ReferenceGrouping>(() => {
    if (radius == null) return EMPTY_GROUPING;
    const canvasHeight = engine.canvasHeight.get();
    const displayMin = engine.displayMin.get();
    const displayMax = engine.displayMax.get();
    const top = padding.top;
    const bottom = canvasHeight - padding.bottom;
    const yPositions: number[] = [];
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (
        referenceLineForm(line) !== "line" ||
        line.value === undefined ||
        custom[index] ||
        offAxisCustom[index]
      ) {
        yPositions.push(-1);
        continue;
      }
      const value = dragValues.get()[index] ?? line.value;
      const y = computeScrubDotY(
        value,
        displayMin,
        displayMax,
        canvasHeight,
        top,
        padding.bottom,
      );
      yPositions.push(y < 0 ? -1 : Math.min(bottom, Math.max(top, y)));
    }
    return groupReferenceLines(yPositions, radius);
  });
  const hidden = useDerivedValue<boolean[]>(() => result.get().hidden);
  return { refGroupResult: result, groupHidden: hidden };
}

function useLiveChartLayoutResources({
  value,
  fontProp,
  palette,
  badgeHasFontOverride,
  badgeFontConfig,
  refGroupBadgeHasFont,
  refGroupBadgeFontConfig,
  yAxisFloat,
  timeScrollEnabled,
  lineProp,
  insets,
  yAxisCfg,
  badgeCfg,
  metricsCfg,
  badgeUsesRightGutter,
  xAxisCfg,
  formatValue,
  pulseConfig,
  dotCfg,
  volumeBandHeight,
}: {
  value: LiveChartProps["value"];
  fontProp: LiveChartProps["font"];
  palette: LiveChartPalette;
  badgeHasFontOverride: boolean;
  badgeFontConfig: LiveChartProps["font"];
  refGroupBadgeHasFont: boolean;
  refGroupBadgeFontConfig: LiveChartProps["font"];
  yAxisFloat: boolean;
  timeScrollEnabled: boolean;
  lineProp: LiveChartProps["line"];
  insets: LiveChartProps["insets"];
  yAxisCfg: ReturnType<typeof resolveYAxis>;
  badgeCfg: ReturnType<typeof resolveBadge>;
  metricsCfg: ReturnType<typeof resolveMetrics>;
  badgeUsesRightGutter: boolean;
  xAxisCfg: ReturnType<typeof resolveXAxis>;
  formatValue: (value: number) => string;
  pulseConfig: { maxRadius: number; strokeWidth: number } | null;
  dotCfg: ReturnType<typeof resolveDot>;
  volumeBandHeight: number;
}) {
  const skiaFont = useChartSkiaFont(
    fontProp,
    MONO_FONT_FAMILY,
    palette.labelFontSize,
  );
  const valueFont = useChartSkiaFont(
    fontProp,
    MONO_FONT_FAMILY,
    palette.valueFontSize * 2,
  );
  const badgeFontOverride = useChartSkiaFont(
    badgeFontConfig,
    MONO_FONT_FAMILY,
    palette.labelFontSize,
  );
  const badgeFont = badgeHasFontOverride ? badgeFontOverride : skiaFont;
  const refGroupBadgeFontOverride = useChartSkiaFont(
    refGroupBadgeFontConfig,
    MONO_FONT_FAMILY,
    palette.labelFontSize,
  );
  const refGroupBadgeFont = refGroupBadgeHasFont
    ? refGroupBadgeFontOverride
    : skiaFont;
  const [valueLayoutSample, setValueLayoutSample] = useState<
    number | undefined
  >(undefined);
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reanimated SharedValues cannot be read during render
    setValueLayoutSample(value.get());
  }, [value]);
  const [scrolledBack, setScrolledBack] = useState(false);
  const effectiveYAxisFloat =
    yAxisFloat && (!timeScrollEnabled || scrolledBack);
  const layout = resolveChartLayout({
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
  return {
    skiaFont,
    valueFont,
    badgeFont,
    refGroupBadgeFont,
    effectiveYAxisFloat,
    setScrolledBack,
    ...layout,
  };
}

function resolveLiveChartModelDefaults({
  isCandle,
  candleWidth,
  loadingCfg,
  volumeCfg,
  palette,
  lineProp,
}: {
  isCandle: boolean;
  candleWidth: number;
  loadingCfg: ReturnType<typeof resolveLoading>;
  volumeCfg: ReturnType<typeof resolveVolume>;
  palette: LiveChartPalette;
  lineProp: LiveChartProps["line"];
}) {
  return {
    extremaTimeOffset: isCandle ? candleWidth / 2 : 0,
    loadingLineColor: loadingCfg?.color,
    loadingStrokeWidth: loadingCfg?.strokeWidth,
    loadingAmplitude: loadingCfg?.amplitude,
    loadingSpeed: loadingCfg?.speed,
    loadingAxisLabels: loadingCfg?.axisLabels ?? true,
    volumeOpacity: volumeCfg?.opacity ?? 1,
    volumeUpColor: volumeCfg?.upColor ?? palette.candleUp,
    volumeDownColor: volumeCfg?.downColor ?? palette.candleDown,
    selectionColor: lineProp?.color ?? palette.line,
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
  renderThresholdBadge,
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
  const {
    isCandle,
    yAxisCfg,
    xAxisCfg,
    topLabelCfg,
    bottomLabelCfg,
    badgeCfg,
    scrubCfg,
    scrubActionCfg,
    volumeCfg,
    chartGapsCfg,
    candleGapsCfg,
    lineGapsCfg,
    volumeBandHeight,
    gradientCfg,
    areaDotsCfg,
    thresholdCfg,
    thresholdSeriesSV,
    thresholdIsSeries,
    valueLineCfg,
    pulseCfg,
    dotCfg,
    dotTracksParked,
    selectionDotCfg,
    dotOuterRadius,
    gridStyleCfg,
    degenCfg,
    tradeStreamResolved,
    metricsCfg,
  } = resolveLiveChartFeatureConfig({
    mode,
    yAxis,
    xAxis,
    topLabel,
    bottomLabel,
    badge,
    scrub,
    scrubAction,
    volume,
    candleGaps,
    lineGaps,
    gradient,
    areaDots,
    threshold,
    valueLine,
    isStatic,
    pulse,
    dot,
    selectionDot,
    gridStyle,
    degen,
    tradeStream,
    metrics,
  });

  const {
    chartGapBands,
    allRefLines,
    refValues,
    refLineCustom,
    refLineOffAxisCustom,
    refLineKeys,
    draggableRefIdx,
    thresholdInRange,
    thresholdRangeValueSV,
    refGroupingCfg,
    refGroupingRadius,
    refGroupBadge,
    refGroupFormat,
    badgeUsesRightGutter,
  } = resolveLiveChartReferenceConfig({
    chartGapsCfg,
    referenceLines,
    renderReferenceLine,
    renderOffAxisReferenceLine,
    thresholdCfg,
    referenceLineGrouping,
    badgeCfg,
  });

  const { dragValues, dragActive, refLineCustomTagWidths, liveRefValues } =
    useLiveReferenceState(allRefLines, draggableRefIdx, thresholdRangeValueSV);

  const {
    palette,
    resolvedSegments,
    hasRecolorSegments,
    leftEdgeFadeCfg,
    badgeHasFontOverride,
    badgeFontConfig,
    refGroupBadgeHasFont,
    refGroupBadgeFontConfig,
    pulseConfig,
    timeScrollEnabled,
    returnToLiveMs,
    timeScrollOverscroll,
    timeScrollFling,
    zoomCfg,
    zoomEnabled,
    yAxisFloat,
  } = resolveLiveChartPresentationConfig({
    accentColor,
    theme,
    paletteOverride,
    segments,
    leftEdgeFade,
    fontProp,
    badgeCfg,
    refGroupBadge,
    pulseCfg,
    timeScroll,
    isStatic,
    returnToLive,
    zoom,
    yAxisCfg,
  });

  const {
    skiaFont,
    valueFont,
    badgeFont,
    refGroupBadgeFont,
    effectiveYAxisFloat,
    setScrolledBack,
    strokeWidth,
    padding: effectivePadding,
  } = useLiveChartLayoutResources({
    value,
    fontProp,
    palette,
    badgeHasFontOverride,
    badgeFontConfig,
    refGroupBadgeHasFont,
    refGroupBadgeFontConfig,
    yAxisFloat,
    timeScrollEnabled,
    lineProp,
    insets,
    yAxisCfg,
    badgeCfg,
    metricsCfg,
    badgeUsesRightGutter,
    xAxisCfg,
    formatValue,
    pulseConfig,
    dotCfg,
    volumeBandHeight,
  });

  // ── Reveal state ────────────────────────────────────────────
  // ≥1 line point or ≥1 committed candle; morphT=1 only when !loading && hasData.
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
  const engineModeInputs = resolveLiveEngineModeInputs({
    isCandle,
    data,
    lineEngineData,
    candles,
    candlesEngine,
    liveCandle,
    liveEngine,
    candleGapsCfg,
    thresholdInRange,
    thresholdIsSeries,
    thresholdSeriesSV,
    thresholdCfg,
  });
  const engine = useLiveChartEngine({
    ...engineModeInputs,
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
    nonNegative,
    maxValue,
    yRangeScale,
    windowBuffer,
    nowOverride,
    mode,
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

  const { refGroupResult, groupHidden } = useReferenceLineGrouping({
    radius: refGroupingRadius,
    engine,
    padding: effectivePadding,
    lines: allRefLines,
    custom: refLineCustom,
    offAxisCustom: refLineOffAxisCustom,
    dragValues,
  });

  // Threshold split geometry. Two forms, picked at render by `Array.isArray` (no
  // SharedValue read): a constant `SharedValue<number>` benchmark drives the
  // vertical hard-stop gradient (`thresholdGeom`); a time-varying `LiveChartPoint[]`
  // series drives the per-fragment split shader (`thresholdSeriesGeom`). Both hooks
  // run unconditionally — the unused one short-circuits cheaply on the UI thread.
  const {
    thresholdGeom,
    thresholdStrokeColors,
    thresholdFillColors,
    thresholdSeriesHasPoints,
    thresholdStrokeUniforms,
    thresholdFillUniforms,
    thresholdMarkerLineY,
    thresholdMarkerVisible,
    thresholdBadgeVisible,
    thresholdMarkerValue,
    thresholdCustomBadge,
    thresholdSeriesPts,
    thresholdFillLineY,
    thresholdFillSamples,
  } = useLiveChartThresholdModel({
    engine,
    padding: effectivePadding,
    thresholdCfg,
    thresholdSeriesSV,
    thresholdIsSeries,
    emptyThresholdValue,
    palette,
    lineProp,
    renderThresholdBadge,
    formatValue,
  });

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
    thresholdFillLineY,
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
    thresholdFillSamples,
    lineProp?.simplify,
    lineGapsCfg?.gaps,
  );

  // Area-dots fill shader color as a vec4 (channels 0..1), with the config
  // `opacity` folded into the alpha. Defaults to a faint tint of the line/accent
  // color (theme-aware) so out-of-the-box dots read as a subtle field.
  const areaDotColorVec = resolveAreaDotColorVec(
    areaDotsCfg,
    lineProp,
    palette,
  );

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

  const {
    crosshairChartOpts,
    markersActive,
    markerClusterCfg,
    refPressActive,
    refDragEnabled,
    scrollGestureMode,
    scrubHoldMs,
  } = resolveLiveChartInteractionConfig({
    isCandle,
    mode,
    candlesEngine,
    liveEngine,
    candleWidth,
    candleGapsCfg,
    lineGapsCfg,
    markers,
    markerCluster,
    onReferenceLinePress,
    allRefLines,
    isStatic,
    timeScroll,
    timeScrollEnabled,
    scrubCfg,
  });
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

  // Cross-gesture arbitration for the one-finger touch. `Gesture.Race` below is
  // NOT arbitration — RNGH's Race adds no relation between its children, so both
  // pans recognize independently and each can activate while the other already
  // owns the touch. This latch (written by the scroll pan, read by the scrub's
  // long-press guard) makes "the scroll already won" a hard fact; `scrubActive`
  // (written by the crosshair, read by the scroll pan) is the mirror image.
  const scrollActive = useSharedValue(false);

  const crosshairSettings = resolveCrosshairControllerSettings({
    scrubCfg,
    scrubActionCfg,
    markersActive,
    refPressActive,
    refDragEnabled,
    deferTapHit,
    timeScrollEnabled,
    scrollGestureMode,
    effectivePadding,
  });

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
    crosshairSettings.enabled,
    onScrub,
    crosshairChartOpts,
    scrubHoldMs,
    onGestureStart,
    onGestureEnd,
    scrubActionCfg,
    onScrubAction,
    metricsCfg.badge,
    crosshairSettings.deferTapHit,
    crosshairSettings.tooltipPlacement,
    crosshairSettings.tooltipShowValue,
    crosshairSettings.tooltipShowTime,
    crosshairSettings.tooltipMargin,
    crosshairSettings.scrubBottomExclude,
    scrollActive,
    crosshairSettings.clampToPlot,
    crosshairSettings.snapToCandles,
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

  const axisAutoHideOpacity = useAxisAutoHide({
    config: axisAutoHide,
    scrollActive,
    scrubActive: crosshairScrubActive,
    engine,
  });

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
  const rootGesture = composeLiveChartRootGesture({
    crosshair,
    markerTapGesture,
    refLineTapGesture,
    refDragGesture,
    panScrollGesture,
    pinchZoomGesture,
    markersActive,
    refPressActive,
    refDragEnabled,
    scrubActionActive: scrubActionCfg !== null,
    timeScrollEnabled,
    scrollGestureMode,
    zoomEnabled,
  });

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
  const fadeOverlaysOnScrub =
    !isStatic && scrubCfg !== null && scrubCfg.hideOverlaysOnScrub === true;
  const {
    liveDotOpacity,
    valueLineOpacity,
    liveBadgeOpacity,
    overlayScrubFade,
    markerGroupOpacity,
  } = useLiveIndicatorOpacities({
    reveal,
    seriesIndicatorOpacity,
    seriesOpacity: resolvedSeriesOpacity,
    scrubActive: crosshairScrubActive,
    selectionDotDuringScrub,
    hideLiveOnScrollBack,
    dotTracksParked,
    viewEnd: engine.viewEnd,
    fadeOverlaysOnScrub,
  });
  const modelDefaults = resolveLiveChartModelDefaults({
    isCandle,
    candleWidth,
    loadingCfg,
    volumeCfg,
    palette,
    lineProp,
  });

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
    ...modelDefaults,
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
    thresholdStrokeColors,
    thresholdFillColors,
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
    thresholdCustomBadge,
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
    loadingActive,
    axisAutoHideOpacity,
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
    <GapBridgePathBatch paths={paths} config={config} palette={model.palette} />
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
  const paths = useLineGapPaths(model.engine, model.effectivePadding, config);
  return (
    <GapBridgePathBatch paths={paths} config={config} palette={model.palette} />
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

function ChartLineStrokeShader({ model }: { model: LiveChartModel }) {
  const {
    engine,
    effectivePadding,
    palette,
    resolvedSegments,
    hasRecolorSegments,
    crosshair,
    thresholdCfg,
    thresholdGeom,
    thresholdStrokeColors,
    thresholdIsSeries,
    thresholdSeriesHasPoints,
    thresholdStrokeUniforms,
    lineProp,
    layoutWidth,
  } = model;
  if (thresholdIsSeries) {
    return thresholdSeriesHasPoints ? (
      <ThresholdSplitShader uniforms={thresholdStrokeUniforms} />
    ) : null;
  }
  if (thresholdCfg && thresholdStrokeColors) {
    return (
      <LinearGradient
        start={vec(0, 0)}
        end={thresholdGeom.gradientEnd}
        colors={thresholdStrokeColors}
        positions={thresholdGeom.splitPositions}
      />
    );
  }
  if (hasRecolorSegments) {
    return (
      <SegmentLineGradient
        engine={engine}
        segments={resolvedSegments}
        padding={effectivePadding}
        baseColor={lineProp?.color ?? palette.line}
        scrubX={crosshair.scrubX}
        scrubActive={crosshair.scrubActive}
      />
    );
  }
  if (!lineProp?.colors?.length) return null;
  return (
    <LinearGradient
      start={vec(0, 0)}
      end={vec(layoutWidth, 0)}
      colors={lineProp.colors}
    />
  );
}

function ChartMainPlotLayer({
  model,
  yAxisEntries,
}: {
  model: LiveChartModel;
  yAxisEntries: YAxisEntries | null;
}) {
  const {
    engine,
    effectivePadding,
    palette,
    lineGroupOpacity,
    seriesOpacity,
    linePath,
    lineGapsCfg,
    strokeWidth,
    lineProp,
    isCandle,
    xAxisCfg,
    yAxisCfg,
    yAxisFloat,
  } = model;

  return (
    <>
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
            <ChartLineStrokeShader model={model} />
          </Path>
          {lineGapsCfg ? <ChartLineGapLayer model={model} /> : null}
        </Group>
      </Group>
      {isCandle ? <ChartCandleLayer model={model} /> : null}
      {yAxisCfg && yAxisFloat ? (
        <ChartYAxisLayer
          model={model}
          variant="labels"
          entries={yAxisEntries!}
        />
      ) : null}
      {xAxisCfg ? <ChartXAxisLayer model={model} /> : null}
    </>
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
    thresholdCustomBadge,
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

      <ChartMainPlotLayer model={model} yAxisEntries={yAxisEntries} />

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
      {thresholdCfg?.line && thresholdCustomBadge == null && (
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

function ChartCanvas({
  model,
  yAxisEntries,
  degen,
}: {
  model: LiveChartModel;
  yAxisEntries: YAxisEntries | null;
  degen: DegenState | null;
}) {
  const {
    canvasMode,
    engine,
    backgroundColor,
    leftEdgeFadeCfg,
    effectivePadding,
    palette,
    topConnector,
    bottomConnector,
    extremaTimeOffset,
    loadingActive,
    topLabelCfg,
  } = model;
  return (
    <Canvas
      key={canvasMode}
      style={{ flex: 1 }}
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
      <ChartFillLayer model={model} yAxisEntries={yAxisEntries} degen={degen} />
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
      <ChartStack model={model} yAxisEntries={yAxisEntries} degen={degen} />
      {topConnector || bottomConnector ? (
        <ExtremaConnectorOverlay
          engine={engine}
          padding={effectivePadding}
          extremaTimeOffset={extremaTimeOffset}
          top={topConnector}
          bottom={bottomConnector}
          hideExtrema={loadingActive}
          suppressBottomWhenCoincident={
            topLabelCfg?.position === "extrema" ||
            topLabelCfg?.position === "extrema-edge"
          }
        />
      ) : null}
      <ChartRefBadgeLayer
        model={model}
        degen={degen}
        yAxisEntries={yAxisEntries}
      />
      <ChartValueOverlay model={model} degen={degen} />
      {model.tradeStreamResolved && model.tradeStream ? (
        <ChartTradeStreamLayer model={model} degen={degen} />
      ) : null}
      <ChartScrubLayer model={model} degen={degen} />
      {model.badgeCfg ? <ChartBadgeLayer model={model} degen={degen} /> : null}
      <ChartScrubActionLayer model={model} />
    </Canvas>
  );
}

function ChartNativeOverlays({ model }: { model: LiveChartModel }) {
  const {
    topLabelCfg,
    bottomLabelCfg,
    engine,
    formatValue,
    palette,
    effectivePadding,
    extremaTimeOffset,
    loadingActive,
    thresholdCustomBadge,
    thresholdCfg,
    thresholdMarkerLineY,
    thresholdBadgeVisible,
    markersActive,
    renderMarker,
    renderReferenceLine,
    renderOffAxisReferenceLine,
    allRefLines,
    scrubCfg,
    renderTooltip,
    crosshair,
    renderOverlay,
  } = model;
  const hasAnnotations =
    (markersActive && renderMarker != null) ||
    ((renderReferenceLine != null || renderOffAxisReferenceLine != null) &&
      allRefLines.length > 0);
  return (
    <>
      {topLabelCfg || bottomLabelCfg ? (
        <AxisLabelOverlay
          topLabel={topLabelCfg}
          bottomLabel={bottomLabelCfg}
          engine={engine}
          formatValue={formatValue}
          defaultColor={palette.gridLabel}
          padding={effectivePadding}
          extremaTimeOffset={extremaTimeOffset}
          hideExtrema={loadingActive}
        />
      ) : null}
      {thresholdCustomBadge && thresholdCfg?.line ? (
        <CustomThresholdBadgeOverlay
          element={thresholdCustomBadge}
          engine={engine}
          padding={effectivePadding}
          y={thresholdMarkerLineY}
          visible={thresholdBadgeVisible}
          position={thresholdCfg.line.labelPosition}
        />
      ) : null}
      {hasAnnotations ? <ChartCustomAnnotations model={model} /> : null}
      {scrubCfg && renderTooltip ? (
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
      ) : null}
      {renderOverlay ? <ChartCustomConsumerOverlay model={model} /> : null}
    </>
  );
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
        <ChartCanvas model={model} yAxisEntries={yAxisEntries} degen={degen} />
        <ChartNativeOverlays model={model} />
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
