import {
  DashPathEffect,
  Group,
  Line,
  Rect,
  RoundedRect,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { type ChartPadding } from "../draw/line";
import { type TooltipLayout } from "../hooks/crosshairShared";
import { useCrosshairVisibleOpacity } from "../hooks/useCrosshairVisibleOpacity";
import type { LiveChartPalette } from "../types";
import type { ResolvedSelectionDotConfig } from "../core/resolveConfig";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import { SelectionDotSlot } from "./SelectionDot";

type CrosshairOverlayProps = {
  scrubX: SharedValue<number>;
  crosshairOpacity: SharedValue<number>;
  tooltipLayout: SharedValue<TooltipLayout>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LiveChartPalette;
  font: SkFont;
  showTooltip?: boolean;
  /** Optional custom tooltip body rendered in place of the default value/time
   *  text (e.g. the multi-line candle stack). Passed as children so it composes
   *  instead of being threaded through as a JSX-valued prop. */
  children?: ReactNode;
  /** Public custom-tooltip hook for line mode: when provided (and no `children`
   *  are passed), its result replaces the default value/time tooltip body. */
  renderTooltip?: () => ReactNode;
  /** Canvas-Y at which the crosshair line should start, so it stops just below a
   *  top-pinned custom tooltip instead of running up through it. -1 (or omitted)
   *  → start at `padding.top`. Fed by {@link CustomTooltipOverlay}. */
  lineTop?: SharedValue<number>;
  /** Draw the vertical scrub guide. Default true. */
  showLine?: boolean;
  /** Resolved selection-dot config; `null` hides it, a `component` renders the
   *  consumer's dot, otherwise the built-in dot. */
  selectionDot?: ResolvedSelectionDotConfig | null;
  /** Scrub intersection Y in canvas px (the value the dot marks); -1 hides it. */
  selectionY?: SharedValue<number>;
  /** Whether scrubbing is active (passed through to a custom dot). */
  scrubActive: SharedValue<number> | SharedValue<boolean>;
  /** Fallback selection-dot color (accent / leading-series color), used when the
   *  config's own `color` is unset. */
  selectionColor?: string;
  /** Opacity of content right of the crosshair (dstOut fade). Default 0.3. */
  dimOpacity?: number;
  /** How far the live dot (and its pulse ring) extends past the plot's right
   *  edge. The dim region extends by this much so it fully covers the live
   *  indicator — which is centered on that edge and would otherwise be only
   *  half-dimmed — while stopping short of the Y-axis labels the gutter
   *  reserves beyond it. Default 0. */
  liveDotExtent?: number;
  crosshairLineColor?: string;
  /** Vertical crosshair line width in px. Default 1. */
  crosshairStrokeWidth?: number;
  /** Resolved extension past the top and bottom plot edges in px. Default 0. */
  crosshairOvershoot?: number;
  /** Fade the crosshair near the live edge. Default true. */
  crosshairFade?: boolean;
  /** Visible-crosshair fade distance near the live edge in px. Default 4. */
  crosshairFadeDistance?: number;
  /** Cap style for the vertical crosshair line. */
  crosshairLineCap?: "butt" | "round" | "square";
  /** Dash intervals `[on, off, …]` for the crosshair line; omit → solid. */
  crosshairDash?: number[];
  crosshairDimColor?: string;
  tooltipBackground?: string;
  tooltipColor?: string;
  tooltipBorderColor?: string;
  /** Tooltip pill corner radius in px. Default 5. */
  tooltipBorderRadius?: number;
  /** Draw the value row of the default tooltip body. Default true. */
  tooltipShowValue?: boolean;
  /** Draw the time row of the default tooltip body. Default true. */
  tooltipShowTime?: boolean;
  /** Paint the owned background instead of erasing destination alpha. */
  opaqueCanvas?: boolean;
};

export function CrosshairOverlay({
  scrubX,
  crosshairOpacity,
  tooltipLayout,
  engine,
  padding,
  palette,
  font,
  showTooltip = true,
  children,
  renderTooltip,
  lineTop,
  showLine = true,
  selectionDot,
  selectionY,
  scrubActive,
  selectionColor,
  dimOpacity = 0.3,
  liveDotExtent = 0,
  crosshairLineColor,
  crosshairStrokeWidth = 1,
  crosshairOvershoot = 0,
  crosshairFade = true,
  crosshairFadeDistance = 4,
  crosshairLineCap,
  crosshairDash,
  crosshairDimColor,
  tooltipBackground,
  tooltipColor,
  tooltipBorderColor,
  tooltipBorderRadius = 5,
  tooltipShowValue = true,
  tooltipShowTime = true,
  opaqueCanvas = false,
}: CrosshairOverlayProps) {
  // Explicit dependency arrays: with React Compiler enabled, Reanimated's
  // auto-detected worklet dependencies can change array size between renders
  // (e.g. when `liveDotExtent` flips 0 → the live-dot extent), which trips
  // React's "final argument changed size between renders" error. Listing the
  // captured plain values keeps the dependency array a constant size. SharedValue
  // reads stay reactive regardless of this list.
  const p1 = useDerivedValue(() => {
    // A top-pinned custom tooltip pushes the line's start down to its measured
    // bottom (lineTop) so the line stops at the label; -1 → no top tooltip.
    const lt = lineTop?.value ?? -1;
    return {
      x: scrubX.value,
      y: lt >= 0 ? lt : padding.top - crosshairOvershoot,
    };
  }, [scrubX, padding.top, lineTop, crosshairOvershoot]);
  const p2 = useDerivedValue(
    () => ({
      x: scrubX.value,
      y: engine.canvasHeight.value - padding.bottom + crosshairOvershoot,
    }),
    [scrubX, engine.canvasHeight, padding.bottom, crosshairOvershoot],
  );

  const dimWidth = useDerivedValue(() => {
    const rightEdge = engine.canvasWidth.value - padding.right + liveDotExtent;
    return Math.max(0, rightEdge - scrubX.value);
  }, [engine.canvasWidth, padding.right, liveDotExtent, scrubX]);
  const dimHeight = useDerivedValue(
    () => engine.canvasHeight.value - padding.top - padding.bottom,
    [engine.canvasHeight, padding.top, padding.bottom],
  );

  const tipX = useDerivedValue(() => tooltipLayout.value.x);
  const tipY = useDerivedValue(() => tooltipLayout.value.y);
  const tipW = useDerivedValue(() => tooltipLayout.value.w);
  const tipH = useDerivedValue(() => tooltipLayout.value.h);

  const valueStr = useDerivedValue(() => tooltipLayout.value.valueStr);
  const timeStr = useDerivedValue(() => tooltipLayout.value.timeStr);
  const valueTextX = useDerivedValue(() => tooltipLayout.value.valueTextX);
  const timeTextX = useDerivedValue(() => tooltipLayout.value.timeTextX);
  const line1Y = useDerivedValue(() => tooltipLayout.value.line1Y);
  const line2Y = useDerivedValue(() => tooltipLayout.value.line2Y);

  // Keep the built-in body in sync with computeTooltipLayout: when both rows
  // are disabled, retain the time row so the tooltip never renders empty.
  const effectiveTooltipShowTime =
    tooltipShowTime || (!tooltipShowValue && !tooltipShowTime);

  // dstOut erase color: alpha = how much of the trailing content to remove,
  // ramped by the crosshair fade-in. Color RGB is irrelevant for dstOut.
  const dimErase = useDerivedValue(
    () => `rgba(0,0,0,${(1 - dimOpacity) * crosshairOpacity.value})`,
    [dimOpacity, crosshairOpacity],
  );
  const opaqueDimOpacity = useDerivedValue(
    () => (1 - dimOpacity) * crosshairOpacity.value,
    [dimOpacity, crosshairOpacity],
  );
  const backgroundColor = `rgb(${palette.bgRgb[0]},${palette.bgRgb[1]},${palette.bgRgb[2]})`;

  // Keep the trailing dim on its original edge fade. Only the visible
  // crosshair group (line, dot, tooltip) uses the configurable distance.
  const visibleOpacity = useCrosshairVisibleOpacity(
    scrubX,
    engine.canvasWidth,
    padding.right,
    scrubActive,
    crosshairFade,
    crosshairFadeDistance,
  );

  return (
    <>
      <CrosshairDimLayer
        scrubX={scrubX}
        paddingTop={padding.top}
        dimWidth={dimWidth}
        dimHeight={dimHeight}
        crosshairOpacity={crosshairOpacity}
        crosshairDimColor={crosshairDimColor}
        dimOpacity={dimOpacity}
        opaqueCanvas={opaqueCanvas}
        backgroundColor={backgroundColor}
        opaqueDimOpacity={opaqueDimOpacity}
        dimErase={dimErase}
      />
      <CrosshairVisibleLayer
        opacity={visibleOpacity}
        p1={p1}
        p2={p2}
        palette={palette}
        showLine={showLine}
        crosshairLineColor={crosshairLineColor}
        crosshairStrokeWidth={crosshairStrokeWidth}
        crosshairLineCap={crosshairLineCap}
        crosshairDash={crosshairDash}
        selectionDot={selectionDot}
        scrubX={scrubX}
        selectionY={selectionY}
        scrubActive={scrubActive}
        selectionColor={selectionColor}
        showTooltip={showTooltip}
        tipX={tipX}
        tipY={tipY}
        tipW={tipW}
        tipH={tipH}
        tooltipBorderRadius={tooltipBorderRadius}
        tooltipBackground={tooltipBackground}
        tooltipBorderColor={tooltipBorderColor}
        renderTooltip={renderTooltip}
        tooltipShowValue={tooltipShowValue}
        effectiveTooltipShowTime={effectiveTooltipShowTime}
        valueTextX={valueTextX}
        timeTextX={timeTextX}
        line1Y={line1Y}
        line2Y={line2Y}
        valueStr={valueStr}
        timeStr={timeStr}
        font={font}
        tooltipColor={tooltipColor}
      >
        {children}
      </CrosshairVisibleLayer>
    </>
  );
}

function CrosshairDimLayer({
  scrubX,
  paddingTop,
  dimWidth,
  dimHeight,
  crosshairOpacity,
  crosshairDimColor,
  dimOpacity,
  opaqueCanvas,
  backgroundColor,
  opaqueDimOpacity,
  dimErase,
}: {
  scrubX: SharedValue<number>;
  paddingTop: number;
  dimWidth: SharedValue<number>;
  dimHeight: SharedValue<number>;
  crosshairOpacity: SharedValue<number>;
  crosshairDimColor?: string;
  dimOpacity: number;
  opaqueCanvas: boolean;
  backgroundColor: string;
  opaqueDimOpacity: SharedValue<number>;
  dimErase: SharedValue<string>;
}) {
  if (crosshairDimColor !== undefined) {
    return (
      <Group opacity={crosshairOpacity}>
        <Rect
          x={scrubX}
          y={paddingTop}
          width={dimWidth}
          height={dimHeight}
          color={crosshairDimColor}
        />
      </Group>
    );
  }
  if (dimOpacity >= 1) return null;
  if (opaqueCanvas) {
    return (
      <Rect
        x={scrubX}
        y={paddingTop}
        width={dimWidth}
        height={dimHeight}
        color={backgroundColor}
        opacity={opaqueDimOpacity}
      />
    );
  }
  return (
    <Group blendMode="dstOut">
      <Rect
        x={scrubX}
        y={paddingTop}
        width={dimWidth}
        height={dimHeight}
        color={dimErase}
      />
    </Group>
  );
}

function CrosshairVisibleLayer({
  opacity,
  p1,
  p2,
  palette,
  showLine,
  crosshairLineColor,
  crosshairStrokeWidth,
  crosshairLineCap,
  crosshairDash,
  selectionDot,
  scrubX,
  selectionY,
  scrubActive,
  selectionColor,
  showTooltip,
  tipX,
  tipY,
  tipW,
  tipH,
  tooltipBorderRadius,
  tooltipBackground,
  tooltipBorderColor,
  children,
  renderTooltip,
  tooltipShowValue,
  effectiveTooltipShowTime,
  valueTextX,
  timeTextX,
  line1Y,
  line2Y,
  valueStr,
  timeStr,
  font,
  tooltipColor,
}: {
  opacity: SharedValue<number>;
  p1: SharedValue<{ x: number; y: number }>;
  p2: SharedValue<{ x: number; y: number }>;
  palette: LiveChartPalette;
  showLine: boolean;
  crosshairLineColor?: string;
  crosshairStrokeWidth: number;
  crosshairLineCap?: "butt" | "round" | "square";
  crosshairDash?: number[];
  selectionDot?: ResolvedSelectionDotConfig | null;
  scrubX: SharedValue<number>;
  selectionY?: SharedValue<number>;
  scrubActive: SharedValue<number> | SharedValue<boolean>;
  selectionColor?: string;
  showTooltip: boolean;
  tipX: SharedValue<number>;
  tipY: SharedValue<number>;
  tipW: SharedValue<number>;
  tipH: SharedValue<number>;
  tooltipBorderRadius: number;
  tooltipBackground?: string;
  tooltipBorderColor?: string;
  children?: ReactNode;
  renderTooltip?: () => ReactNode;
  tooltipShowValue: boolean;
  effectiveTooltipShowTime: boolean;
  valueTextX: SharedValue<number>;
  timeTextX: SharedValue<number>;
  line1Y: SharedValue<number>;
  line2Y: SharedValue<number>;
  valueStr: SharedValue<string>;
  timeStr: SharedValue<string>;
  font: SkFont;
  tooltipColor?: string;
}) {
  return (
    <Group opacity={opacity}>
      <CrosshairLine
        show={showLine}
        p1={p1}
        p2={p2}
        color={crosshairLineColor ?? palette.crosshairLine}
        strokeWidth={crosshairStrokeWidth}
        strokeCap={crosshairLineCap}
        dash={crosshairDash}
      />
      <SelectionDotSlot
        config={selectionDot}
        x={scrubX}
        y={selectionY}
        active={scrubActive}
        opacity={opacity}
        color={selectionColor ?? palette.line}
      />
      <CrosshairTooltip
        show={showTooltip}
        tipX={tipX}
        tipY={tipY}
        tipW={tipW}
        tipH={tipH}
        borderRadius={tooltipBorderRadius}
        background={tooltipBackground ?? palette.tooltipBg}
        borderColor={tooltipBorderColor ?? palette.tooltipBorder}
        renderTooltip={renderTooltip}
        showValue={tooltipShowValue}
        showTime={effectiveTooltipShowTime}
        valueTextX={valueTextX}
        timeTextX={timeTextX}
        line1Y={line1Y}
        line2Y={line2Y}
        valueStr={valueStr}
        timeStr={timeStr}
        font={font}
        valueColor={tooltipColor ?? palette.tooltipText}
        timeColor={palette.gridLabel}
      >
        {children}
      </CrosshairTooltip>
    </Group>
  );
}

function CrosshairLine({
  show,
  p1,
  p2,
  color,
  strokeWidth,
  strokeCap,
  dash,
}: {
  show: boolean;
  p1: SharedValue<{ x: number; y: number }>;
  p2: SharedValue<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
  strokeCap?: "butt" | "round" | "square";
  dash?: number[];
}) {
  if (!show) return null;
  return (
    <Line
      p1={p1}
      p2={p2}
      color={color}
      strokeWidth={strokeWidth}
      strokeCap={strokeCap}
    >
      {dash ? <DashPathEffect intervals={dash} /> : null}
    </Line>
  );
}

function CrosshairTooltip({
  show,
  tipX,
  tipY,
  tipW,
  tipH,
  borderRadius,
  background,
  borderColor,
  children,
  renderTooltip,
  showValue,
  showTime,
  valueTextX,
  timeTextX,
  line1Y,
  line2Y,
  valueStr,
  timeStr,
  font,
  valueColor,
  timeColor,
}: {
  show: boolean;
  tipX: SharedValue<number>;
  tipY: SharedValue<number>;
  tipW: SharedValue<number>;
  tipH: SharedValue<number>;
  borderRadius: number;
  background: string;
  borderColor: string;
  children?: ReactNode;
  renderTooltip?: () => ReactNode;
  showValue: boolean;
  showTime: boolean;
  valueTextX: SharedValue<number>;
  timeTextX: SharedValue<number>;
  line1Y: SharedValue<number>;
  line2Y: SharedValue<number>;
  valueStr: SharedValue<string>;
  timeStr: SharedValue<string>;
  font: SkFont;
  valueColor: string;
  timeColor: string;
}) {
  if (!show) return null;
  const body = children ?? renderTooltip?.();
  return (
    <>
      <RoundedRect
        x={tipX}
        y={tipY}
        width={tipW}
        height={tipH}
        r={borderRadius}
        color={background}
      />
      <RoundedRect
        x={tipX}
        y={tipY}
        width={tipW}
        height={tipH}
        r={borderRadius}
        color={borderColor}
        style="stroke"
        strokeWidth={1}
      />
      {body ?? (
        <Group>
          {showValue ? (
            <SkiaText
              x={valueTextX}
              y={line1Y}
              text={valueStr}
              font={font}
              color={valueColor}
            />
          ) : null}
          {showTime ? (
            <SkiaText
              x={timeTextX}
              y={showValue ? line2Y : line1Y}
              text={timeStr}
              font={font}
              color={timeColor}
            />
          ) : null}
        </Group>
      )}
    </>
  );
}
