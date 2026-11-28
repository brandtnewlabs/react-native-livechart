import type { SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { X_AXIS_LABEL_OFFSET_Y } from "../constants";
import type { ResolvedScrubConfig } from "../core/resolveConfig";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import {
  computeActionBadgeLayout,
  computeTimeBadgeLayout,
  computeValueAtY,
  HIDDEN_ACTION_BADGE,
  HIDDEN_TIME_BADGE,
} from "../hooks/crosshairShared";
import type { BadgeMetrics, LiveChartPalette } from "../types";
import { ScrubActionOverlay } from "./ScrubActionOverlay";

const SOLID: number[] = [];

/** Mounted only while free scrubbing is configured. The parent draws the
 * vertical guide and applies the same visible opacity to the whole crosshair. */
export function FreeCrosshairOverlay({
  active, x, y, time, engine, padding, volumeBandHeight, side,
  font, metrics, palette, scrub, formatValue, formatTime,
}: {
  active: SharedValue<boolean>;
  x: SharedValue<number>;
  y: SharedValue<number>;
  time: SharedValue<number>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  volumeBandHeight: number;
  side: "left" | "right";
  font: SkFont;
  metrics: BadgeMetrics;
  palette: LiveChartPalette;
  scrub: ResolvedScrubConfig;
  formatValue: (value: number) => string;
  formatTime: (time: number) => string;
}) {
  const { canvasHeight, canvasWidth, displayMin, displayMax } = engine;
  const { padX, padY, marginEdge } = metrics;
  const priceBadge = useDerivedValue(() => {
    const pointerY = y.get();
    if (!active.get() || pointerY < 0) return HIDDEN_ACTION_BADGE;
    const price = computeValueAtY(
      pointerY, displayMin.get(), displayMax.get(), canvasHeight.get(),
      padding.top, padding.bottom,
    );
    if (price === null) return HIDDEN_ACTION_BADGE;
    const width = canvasWidth.get();
    const plotEdge = side === "left" ? padding.left : width - padding.right;
    return computeActionBadgeLayout(
      true, pointerY, formatValue(price), "", width, plotEdge,
      font, marginEdge, padX, padY, side,
    );
  });
  const timeBadge = useDerivedValue(() => {
    const selectedTime = time.get();
    if (!active.get() || selectedTime < 0) return HIDDEN_TIME_BADGE;
    const baseline = canvasHeight.get() - padding.bottom + volumeBandHeight + X_AXIS_LABEL_OFFSET_Y;
    return computeTimeBadgeLayout(
      true, x.get(), formatTime(selectedTime), canvasWidth.get(), baseline,
      font, padX, padY, marginEdge,
    );
  });

  return (
    <ScrubActionOverlay
      lockActive={active}
      lockX={x}
      lockY={y}
      actionBadge={priceBadge}
      timeBadge={timeBadge}
      engine={engine}
      padding={padding}
      palette={palette}
      font={font}
      icon=""
      lineColor={scrub.crosshairLineColor}
      background={scrub.tooltipBackground ?? palette.tooltipBg}
      iconColor={scrub.tooltipColor ?? palette.tooltipText}
      showVerticalLine={false}
      levelDash={scrub.crosshairDash ?? SOLID}
      levelStrokeWidth={scrub.crosshairStrokeWidth}
    />
  );
}
