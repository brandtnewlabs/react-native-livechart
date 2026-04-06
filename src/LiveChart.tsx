import {
  Canvas,
  Group,
  LinearGradient,
  Path,
  matchFont,
  vec,
} from "@shopify/react-native-skia";
import {
  formatTime as defaultFormatTime,
  formatValue as defaultFormatValue,
} from "./format";
import {
  resolveChartLayout,
  useBadge,
  useCandlePaths,
  useCanvasLayout,
  useChartColors,
  useChartPaths,
  useChartReveal,
  useCrosshair,
  useDegen,
  useLiveChartHasData,
  useLiveDot,
  useModeBlend,
  useMomentum,
  useReferenceLine,
  useSingleChartReverseMorphInputs,
  useTradeStream,
  useXAxis,
  useYAxis,
} from "./hooks";
import {
  resolveBadge,
  resolveDegen,
  resolveFontConfig,
  resolveGradient,
  resolveLeftEdgeFade,
  resolvePulse,
  resolveReferenceLineConfig,
  resolveScrub,
  resolveTradeStream,
  resolveValueLine,
  resolveXAxis,
  resolveYAxis,
} from "./resolveConfig";
import { leftEdgeFadeColorsFromBgRgb, resolveTheme } from "./theme";
import type { LiveChartProps, TradeEvent } from "./types";

import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { BadgeOverlay } from "./components/BadgeOverlay";
import { CrosshairOverlay } from "./components/CrosshairOverlay";
import { DegenParticlesOverlay } from "./components/DegenParticlesOverlay";
import { DotOverlay } from "./components/DotOverlay";
import { LeftEdgeFade } from "./components/LeftEdgeFade";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { MultiSeriesTooltipStack } from "./components/MultiSeriesTooltipStack";
import { ReferenceLineOverlay } from "./components/ReferenceLineOverlay";
import { TradeStreamOverlay } from "./components/TradeStreamOverlay";
import { ValueLineOverlay } from "./components/ValueLineOverlay";
import { XAxisOverlay } from "./components/XAxisOverlay";
import { YAxisOverlay } from "./components/YAxisOverlay";
import { MONO_FONT_FAMILY } from "./monoFontFamily";
import { useLiveChartEngine } from "./useLiveChartEngine";

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
  emptyText = "No data",
  formatValue = defaultFormatValue,
  formatTime = defaultFormatTime,

  // ── Overlays ────────────────────────────────────────────────────────────
  yAxis = true,
  xAxis = true,
  badge = true,
  momentum = true,
  pulse = true,
  valueLine = false,
  referenceLine,
  scrub = false,
  tradeStream,
  degen,
  leftEdgeFade = true,

  // ── Callbacks ───────────────────────────────────────────────────────────
  onScrub,
}: LiveChartProps) {
  const emptyTradeStream = useSharedValue<TradeEvent[]>([]);
  const tradeStreamSV = tradeStream ?? emptyTradeStream;
  const isCandle = mode === "candle";

  // ── Resolve feature configs ────────────────────────────────────────────
  const yAxisCfg = resolveYAxis(yAxis);
  const xAxisCfg = resolveXAxis(xAxis);
  const badgeCfg = resolveBadge(badge);
  const scrubCfg = resolveScrub(scrub);
  const gradientCfg = isCandle ? null : resolveGradient(gradient);
  const valueLineCfg = resolveValueLine(valueLine);
  const pulseCfg = resolvePulse(pulse);
  const refLineCfg = resolveReferenceLineConfig(referenceLine);
  const degenCfg = resolveDegen(degen);
  const tradeStreamResolved = resolveTradeStream(tradeStream);

  const badgeUsesRightGutter =
    badgeCfg !== null && (badgeCfg.position ?? "right") === "right";

  // ── Theme, font and layout ─────────────────────────────────────────────
  const palette = resolveTheme(accentColor, theme);

  const leftEdgeFadeCfg = resolveLeftEdgeFade(
    leftEdgeFade,
    leftEdgeFadeColorsFromBgRgb(palette.bgRgb),
  );

  const skiaFont = matchFont(
    resolveFontConfig(fontProp, MONO_FONT_FAMILY, palette.labelFontSize),
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
    referenceValue: referenceLine?.value,
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
  } = useDegen(engine, dotX, dotY, momentumSV, degenCfg);

  // ── Overlay hooks ─────────────────────────────────────────────────────
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
    <GestureDetector gesture={crosshair.gesture}>
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
