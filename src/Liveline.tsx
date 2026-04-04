import {
  Canvas,
  Group,
  LinearGradient,
  Path,
  matchFont,
  vec,
} from "@shopify/react-native-skia";
import { Platform, View } from "react-native";
import {
  formatTime as defaultFormatTime,
  formatValue as defaultFormatValue,
} from "./format";
import {
  resolveBadge,
  resolveFontConfig,
  resolveGradient,
  resolvePulse,
  resolveReferenceLineConfig,
  resolveScrub,
  resolveValueLine,
  resolveXAxis,
  resolveYAxis,
} from "./resolveConfig";
import {
  resolveChartLayout,
  useBadge,
  useCanvasLayout,
  useChartColors,
  useChartPaths,
  useChartReveal,
  useCrosshair,
  useLiveDot,
  useMomentum,
  useReferenceLine,
  useXAxis,
  useYAxis,
} from "./hooks";

import { BadgeOverlay } from "./components/BadgeOverlay";
import { CrosshairOverlay } from "./components/CrosshairOverlay";
import { DotOverlay } from "./components/DotOverlay";
import { GestureDetector } from "react-native-gesture-handler";
import type { LivelineProps } from "./types";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { ReferenceLineOverlay } from "./components/ReferenceLineOverlay";
import { ValueLineOverlay } from "./components/ValueLineOverlay";
import { XAxisOverlay } from "./components/XAxisOverlay";
import { YAxisOverlay } from "./components/YAxisOverlay";
import { resolveTheme } from "./theme";
import { useLivelineEngine } from "./useLivelineEngine";

export function Liveline({
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

  // ── Callbacks ───────────────────────────────────────────────────────────
  onScrub,
}: LivelineProps) {
  // ── Resolve feature configs ────────────────────────────────────────────
  const yAxisCfg = resolveYAxis(yAxis);
  const xAxisCfg = resolveXAxis(xAxis);
  const badgeCfg = resolveBadge(badge);
  const scrubCfg = resolveScrub(scrub);
  const gradientCfg = resolveGradient(gradient);
  const valueLineCfg = resolveValueLine(valueLine);
  const pulseCfg = resolvePulse(pulse);
  const refLineCfg = resolveReferenceLineConfig(referenceLine);

  const badgeOnLeft = badgeCfg?.position === "left";

  // ── Theme, font and layout ─────────────────────────────────────────────
  const palette = resolveTheme(accentColor, theme);

  const skiaFont = matchFont(
    resolveFontConfig(
      fontProp,
      Platform.select({ ios: "Menlo", default: "monospace" }) as string,
      palette.labelFontSize,
    ),
  );

  const { strokeWidth, padding: effectivePadding } = resolveChartLayout({
    palette,
    lineWidthOverride: lineProp?.width,
    insetsOverride: insets,
    yAxis: yAxisCfg !== null,
    badge: badgeCfg !== null,
    badgeOnLeft,
    xAxis: xAxisCfg !== null,
    font: skiaFont,
    formatValue,
    currentValue: value.value,
  });

  // ── Engine and reveal state ────────────────────────────────────────────
  const engine = useLivelineEngine({
    data,
    value,
    timeWindow,
    paused,
    smoothing,
    exaggerate,
    referenceValue: referenceLine?.value,
  });

  const reveal = useChartReveal(loading);

  // ── Per-frame derived values ───────────────────────────────────────────
  const { layoutHeight, onLayout } = useCanvasLayout(engine);

  const { linePath, fillPath } = useChartPaths(
    engine,
    effectivePadding,
    reveal.morphT,
  );
  const { dotX, dotY } = useLiveDot(engine, effectivePadding);

  const momentumSV = useMomentum(engine, momentum);

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

  const crosshair = useCrosshair(
    engine,
    effectivePadding,
    palette,
    formatValue,
    formatTime,
    skiaFont,
    scrubCfg !== null,
    onScrub,
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
          {/* Y-axis grid */}
          {yAxisCfg && (
            <Group opacity={reveal.yAxisOpacity}>
              <YAxisOverlay
                entries={yAxisEntries}
                engine={engine}
                padding={effectivePadding}
                palette={palette}
                font={skiaFont}
                badge={badgeCfg !== null && !badgeOnLeft}
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
            <ValueLineOverlay
              dotY={dotY}
              engine={engine}
              padding={effectivePadding}
              strokeWidth={valueLineCfg.strokeWidth}
              intervals={valueLineCfg.intervals}
              color={valueLineCfg.color ?? palette.dashLine}
            />
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

          {/* Chart line — always rendered; morph blends loading → data */}
          <Group opacity={reveal.lineOpacity}>
            <Path
              path={linePath}
              style="stroke"
              strokeWidth={strokeWidth}
              color={lineProp?.color ?? palette.line}
              strokeCap="round"
              strokeJoin="round"
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
              momentum={momentumSV}
              palette={palette}
              engine={engine}
              pulse={pulseCfg}
            />
          </Group>

          {/* Loading / empty state — rendered last so it sits on top */}
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
          />

          {/* Crosshair scrub */}
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
            />
          )}
        </Canvas>
      </View>
    </GestureDetector>
  );
}
