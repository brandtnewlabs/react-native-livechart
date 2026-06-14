import {
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
import type { LiveChartPalette } from "../types";
import type { ResolvedSelectionDotConfig } from "../core/resolveConfig";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import { SelectionDotSlot } from "./SelectionDot";

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
  selectionDot,
  selectionY,
  scrubActive,
  selectionColor,
  dimOpacity = 0.3,
  liveDotExtent = 0,
  crosshairLineColor,
  crosshairDimColor,
  tooltipBackground,
  tooltipColor,
  tooltipBorderColor,
  tooltipBorderRadius = 5,
  tooltipShowValue = true,
  tooltipShowTime = true,
}: {
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
  /** Resolved selection-dot config; `null` hides it, a `component` renders the
   *  consumer's dot, otherwise the built-in dot. */
  selectionDot?: ResolvedSelectionDotConfig | null;
  /** Scrub intersection Y in canvas px (the value the dot marks); -1 hides it. */
  selectionY?: SharedValue<number>;
  /** Whether scrubbing is active (passed through to a custom dot). */
  scrubActive?: SharedValue<number> | SharedValue<boolean>;
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
}) {
  // Explicit dependency arrays: with React Compiler enabled, Reanimated's
  // auto-detected worklet dependencies can change array size between renders
  // (e.g. when `liveDotExtent` flips 0 → the live-dot extent), which trips
  // React's "final argument changed size between renders" error. Listing the
  // captured plain values keeps the dependency array a constant size. SharedValue
  // reads stay reactive regardless of this list.
  const p1 = useDerivedValue(
    () => ({
      x: scrubX.value,
      y: padding.top,
    }),
    [scrubX, padding.top],
  );
  const p2 = useDerivedValue(
    () => ({
      x: scrubX.value,
      y: engine.canvasHeight.value - padding.bottom,
    }),
    [scrubX, engine.canvasHeight, padding.bottom],
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

  // dstOut erase color: alpha = how much of the trailing content to remove,
  // ramped by the crosshair fade-in. Color RGB is irrelevant for dstOut.
  const dimErase = useDerivedValue(
    () => `rgba(0,0,0,${(1 - dimOpacity) * crosshairOpacity.value})`,
    [dimOpacity, crosshairOpacity],
  );

  return (
    <>
      {crosshairDimColor !== undefined ? (
        // Legacy: solid colored mask painted over the chart (opt-in).
        <Group opacity={crosshairOpacity}>
          <Rect
            x={scrubX}
            y={padding.top}
            width={dimWidth}
            height={dimHeight}
            color={crosshairDimColor}
          />
        </Group>
      ) : dimOpacity < 1 ? (
        // Erase the trailing content's alpha so it fades to the real background
        // (works on any background color, unlike a colored mask).
        <Group blendMode="dstOut">
          <Rect
            x={scrubX}
            y={padding.top}
            width={dimWidth}
            height={dimHeight}
            color={dimErase}
          />
        </Group>
      ) : null}

      <Group opacity={crosshairOpacity}>
        <Line
          p1={p1}
          p2={p2}
          color={crosshairLineColor ?? palette.crosshairLine}
          strokeWidth={1}
        />

        {/* Selection dot at the scrub intersection. `null` hides it; a custom
            component renders the consumer's dot; otherwise the built-in dot. */}
        <SelectionDotSlot
          config={selectionDot}
          x={scrubX}
          y={selectionY}
          active={scrubActive}
          opacity={crosshairOpacity}
          color={selectionColor ?? palette.line}
        />

        {showTooltip && (
        <>
          <RoundedRect
            x={tipX}
            y={tipY}
            width={tipW}
            height={tipH}
            r={tooltipBorderRadius}
            color={tooltipBackground ?? palette.tooltipBg}
          />

          <RoundedRect
            x={tipX}
            y={tipY}
            width={tipW}
            height={tipH}
            r={tooltipBorderRadius}
            color={tooltipBorderColor ?? palette.tooltipBorder}
            style="stroke"
            strokeWidth={1}
          />

          {children ??
            renderTooltip?.() ?? (
              <Group>
                {tooltipShowValue && (
                  <SkiaText
                    x={valueTextX}
                    y={line1Y}
                    text={valueStr}
                    font={font}
                    color={tooltipColor ?? palette.tooltipText}
                  />
                )}
                {tooltipShowTime && (
                  <SkiaText
                    x={timeTextX}
                    y={tooltipShowValue ? line2Y : line1Y}
                    text={timeStr}
                    font={font}
                    color={palette.gridLabel}
                  />
                )}
              </Group>
            )}
        </>
      )}
      </Group>
    </>
  );
}
