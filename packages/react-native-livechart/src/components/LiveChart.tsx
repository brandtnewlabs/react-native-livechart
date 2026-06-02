import { useMemo } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";

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

import {
  resolveBadge,
  resolveDegen,
  resolveGradient,
  resolveGridStyle,
  resolveLeftEdgeFade,
  resolvePulse,
  resolveScrub,
  resolveTradeStream,
  resolveValueLine,
  resolveXAxis,
  resolveYAxis,
} from "../core/resolveConfig";
import { useLiveChartEngine } from "../core/useLiveChartEngine";
import {
  resolveChartLayout,
  useBadge,
  useCandlePaths,
  useCanvasLayout,
  useChartColors,
  useChartPaths,
  useChartReveal,
  useChartSkiaFont,
  useCrosshair,
  useDegen,
  useLiveChartHasData,
  useLiveDot,
  useMarkers,
  useModeBlend,
  useMomentum,
  useSingleChartReverseMorphInputs,
  useTradeStream,
  useXAxis,
  useYAxis,
} from "../hooks";
import {
  formatTime as defaultFormatTime,
  formatValue as defaultFormatValue,
} from "../lib/format";
import { MONO_FONT_FAMILY } from "../lib/monoFontFamily";
import { collectReferenceValues } from "../math/referenceLines";
import {
  applyPaletteOverride,
  leftEdgeFadeColorsFromBgRgb,
  resolveTheme,
} from "../theme";
import type { LiveChartProps, Marker, TradeEvent } from "../types";
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
import { TradeStreamOverlay } from "./TradeStreamOverlay";
import { ValueLineOverlay } from "./ValueLineOverlay";
import { XAxisOverlay } from "./XAxisOverlay";
import { YAxisOverlay } from "./YAxisOverlay";

export function LiveChart({
  // ── Data ────────────────────────────────────────────────────────────────
  data,
  value,

  // ── Appearance ──────────────────────────────────────────────────────────
  theme = "dark",
  accentColor = "#3b82f6",
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
  smoothing = 0.08,
  exaggerate = false,
  nonNegative = false,
  maxValue,
  emptyText = "No data",
  formatValue = defaultFormatValue,
  formatTime = defaultFormatTime,

  // ── Overlays ────────────────────────────────────────────────────────────
  yAxis = true,
  xAxis = true,
  badge = true,
  momentum = true,
  pulse = true,
  valueLine = true,
  showValue = false,
  valueMomentumColor = false,
  referenceLine,
  referenceLines,
  gridStyle,
  palette: paletteOverride,
  scrub = true,
  tradeStream,
  degen,
  markers,
  onMarkerHover,
  markerHitRadius = 16,
  leftEdgeFade = true,

  // ── Callbacks ───────────────────────────────────────────────────────────
  onScrub,
  onDegenShake,
}: LiveChartProps) {
  const emptyTradeStream = useSharedValue<TradeEvent[]>([]);
  const tradeStreamSV = tradeStream ?? emptyTradeStream;
  const emptyMarkers = useSharedValue<Marker[]>([]);
  const markersSV = markers ?? emptyMarkers;
  const isCandle = mode === "candle";

  // ── Resolve feature configs ────────────────────────────────────────────
  const yAxisCfg = resolveYAxis(yAxis);
  const xAxisCfg = resolveXAxis(xAxis);
  const badgeCfg = resolveBadge(badge);
  const scrubCfg = resolveScrub(scrub);
  const gradientCfg = isCandle ? null : resolveGradient(gradient);
  const valueLineCfg = resolveValueLine(valueLine);
  const pulseCfg = resolvePulse(pulse);
  const gridStyleCfg = resolveGridStyle(gridStyle);
  const degenCfg = resolveDegen(degen);
  const tradeStreamResolved = resolveTradeStream(tradeStream);

  // Merge the legacy singular `referenceLine` into the `referenceLines` array.
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

  const badgeUsesRightGutter =
    badgeCfg !== null && (badgeCfg.position ?? "right") === "right";

  // ── Theme, font and layout ─────────────────────────────────────────────
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

  const { strokeWidth, padding: effectivePadding } = resolveChartLayout({
    palette,
    lineWidthOverride: lineProp?.width,
    insetsOverride: insets,
    yAxis: yAxisCfg !== null,
    badge: badgeCfg !== null,
    badgeUsesRightGutter,
    badgeShowTail: badgeCfg?.tail ?? true,
    xAxis: xAxisCfg !== null,
    font: skiaFont,
    formatValue,
    currentValue: value.value,
    pulse: pulseConfig,
  });

  // ── Reveal state ────────────────────────────────────────────
  // ≥2 line points or ≥2 committed candles; morphT=1 only when !loading && hasData.
  const { hasData, initialMorphT } = useLiveChartHasData({
    isCandle,
    data,
    candles,
    loading,
  });

  const reveal = useChartReveal(loading, hasData, initialMorphT);

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
    smoothing,
    exaggerate,
    referenceValues: refValues,
    nonNegative,
    maxValue,
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
  const { layoutHeight, onLayout } = useCanvasLayout(engine);

  const { linePath, fillPath } = useChartPaths(
    engine,
    effectivePadding,
    reveal.morphT,
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
    );
  const { dotX, dotY } = useLiveDot(engine, effectivePadding);

  const momentumSV = useMomentum(engine, momentum);

  const tradeMarkers = useTradeStream(
    engine,
    tradeStreamSV,
    effectivePadding,
    tradeStreamResolved !== null,
  );

  const {
    pack: degenPack,
    packRevision: degenPackRevision,
    shakeTransform: degenShakeTransform,
  } = useDegen(engine, dotX, dotY, momentumSV, degenCfg, onDegenShake);

  // ── Overlay hooks ─────────────────────────────────────────────────────
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

  const crosshair = useCrosshair(
    engine,
    effectivePadding,
    palette,
    formatValue,
    formatTime,
    skiaFont,
    scrubCfg !== null,
    onScrub,
    candleOpts,
  );

  const markersActive = markers != null;
  // `projected` is used internally by the hit-test gesture; the overlay
  // self-projects, so we only need the gesture here.
  const { tapGesture: markerTapGesture } = useMarkers(
    engine,
    effectivePadding,
    markersSV,
    markersActive,
    markerHitRadius,
    onMarkerHover,
  );

  const rootGesture = markersActive
    ? Gesture.Race(crosshair.gesture, markerTapGesture)
    : crosshair.gesture;

  // ── Derived render values ──────────────────────────────────────────────
  const {
    backgroundColor,
    gradientEnd,
    gradientTopColor,
    gradientBottomColor,
  } = useChartColors(
    palette,
    gradientCfg,
    accentColor,
    layoutHeight,
    effectivePadding,
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <GestureDetector gesture={rootGesture}>
      <View style={[{ flex: 1, backgroundColor }, style]} onLayout={onLayout}>
        <Canvas style={{ flex: 1 }}>
          {/* Shaken chart stack — left-edge fade is a sibling below so dstOut runs in canvas space */}
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
                    colors={[gradientTopColor, gradientBottomColor]}
                  />
                </Path>
              </Group>
            )}

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

            {/* Chart line (fades out in candle mode) */}
            <Group opacity={lineGroupOpacity}>
              <Path
                path={linePath}
                style="stroke"
                strokeWidth={strokeWidth}
                color={lineProp?.color ?? palette.line}
                strokeCap="round"
                strokeJoin="round"
              />
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

            {/* Badge and live dot */}
            {badgeCfg && (
              <Group opacity={reveal.badgeOpacity}>
                <BadgeOverlay badge={badgeData} font={skiaFont} />
              </Group>
            )}

            <Group opacity={reveal.dotOpacity}>
              <DotOverlay
                dotX={dotX}
                dotY={dotY}
                palette={palette}
                engine={engine}
                pulse={pulseCfg}
              />
            </Group>

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

            {showValue && (
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
            )}

            {markersActive && (
              <Group opacity={reveal.dotOpacity}>
                <MarkerOverlay
                  markers={markersSV}
                  engine={engine}
                  padding={effectivePadding}
                  palette={palette}
                  font={skiaFont}
                />
              </Group>
            )}

            {/* Loading / empty state — before left-edge fade so the squiggle/empty art fades like the chart */}
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

          {(tradeStreamResolved || scrubCfg) && (
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
                  engine={engine}
                  padding={effectivePadding}
                  palette={palette}
                  font={skiaFont}
                  showTooltip={scrubCfg.tooltip}
                  crosshairLineColor={scrubCfg.crosshairLineColor}
                  crosshairDimColor={scrubCfg.crosshairDimColor}
                  tooltipBackground={scrubCfg.tooltipBackground}
                  tooltipColor={scrubCfg.tooltipColor}
                  tooltipBorderColor={scrubCfg.tooltipBorderColor}
                  tooltipBody={
                    isCandle ? (
                      <MultiSeriesTooltipStack
                        tooltipLayout={crosshair.tooltipLayout}
                        font={skiaFont}
                        palette={palette}
                      />
                    ) : undefined
                  }
                />
              )}
            </Group>
          )}
        </Canvas>
      </View>
    </GestureDetector>
  );
}
