import { DashPathEffect, Group, Line, Rect } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { type ChartPadding } from "../draw/line";
import type { LiveChartPalette } from "../types";
import type { ResolvedSelectionDotConfig } from "../core/resolveConfig";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import { SelectionDotSlot } from "./SelectionDot";

/**
 * Crosshair vertical line + dim region to the right. No tooltip pill —
 * multi-series delivers scrub data via `onScrub` / `onScrubWorklet` callbacks.
 */
export function CrosshairLine({
  scrubX,
  crosshairOpacity,
  engine,
  padding,
  palette,
  selectionDot,
  selectionY,
  scrubActive,
  selectionColor,
  dimOpacity = 0.3,
  liveDotExtent = 0,
  crosshairLineColor,
  crosshairDash,
  crosshairDimColor,
}: {
  scrubX: SharedValue<number>;
  crosshairOpacity: SharedValue<number>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LiveChartPalette;
  /** Resolved selection-dot config; `null` hides it, a `component` renders the
   *  consumer's dot, otherwise the built-in dot. */
  selectionDot?: ResolvedSelectionDotConfig | null;
  /** Scrub intersection Y in canvas px (the value the dot marks); -1 hides it. */
  selectionY?: SharedValue<number>;
  /** Whether scrubbing is active (passed through to a custom dot). */
  scrubActive?: SharedValue<number> | SharedValue<boolean>;
  /** Fallback selection-dot color (leading-series color), used when the config's
   *  own `color` is unset. */
  selectionColor?: string;
  /** Opacity of content right of the crosshair (dstOut fade). Default 0.3. */
  dimOpacity?: number;
  /** How far the live series dots extend past the plot's right edge. The dim
   *  region extends by this much so it fully covers the dots — centered on that
   *  edge, otherwise only half-dimmed — while leaving the value/Y-axis labels
   *  the gutter reserves beyond them bright. Default 0. */
  liveDotExtent?: number;
  crosshairLineColor?: string;
  /** Dash intervals `[on, off, …]` for the crosshair line; omit → solid. */
  crosshairDash?: number[];
  crosshairDimColor?: string;
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

  // dstOut erase color: alpha = fraction of trailing content to remove, ramped
  // by the crosshair fade-in. RGB is irrelevant for dstOut.
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
        // Erase the trailing content's alpha so it fades to the real background.
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
        >
          {crosshairDash ? <DashPathEffect intervals={crosshairDash} /> : null}
        </Line>

        {/* Selection dot at the scrub intersection (leading series). `null`
            hides it; a custom component renders the consumer's dot. */}
        <SelectionDotSlot
          config={selectionDot}
          x={scrubX}
          y={selectionY}
          active={scrubActive}
          opacity={crosshairOpacity}
          color={selectionColor ?? palette.line}
        />
      </Group>
    </>
  );
}
