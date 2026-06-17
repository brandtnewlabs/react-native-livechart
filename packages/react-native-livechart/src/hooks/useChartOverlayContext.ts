import { useMemo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import type { ChartOverlayContext, ChartScale } from "../types";
import { priceToY, timeToX, xToTime, yToPrice } from "./overlayScale";

/**
 * Builds the {@link ChartOverlayContext} handed to a custom
 * {@link LiveChartProps.renderOverlay}: a single per-frame {@link ChartScale}
 * SharedValue plus the pure price↔pixel / time↔pixel mapping worklets.
 *
 * The `scale` derived value reads the engine SharedValues (range, window, "now")
 * and the padding each frame, so a consumer's `useAnimatedStyle` becomes reactive
 * just by reading `scale.get()` — that read subscribes it to per-frame updates
 * (Reanimated only observes SharedValues found directly in a worklet's closure,
 * not those hidden behind a function call). The mappings stay pure, taking the
 * snapshot as an argument.
 */
export function useChartOverlayContext(
  engine: ChartEngineLayout,
  padding: ChartPadding,
): ChartOverlayContext {
  const { top: padTop, bottom: padBottom, left: padLeft, right: padRight } = padding;

  const scale = useDerivedValue<ChartScale>(() => {
    const width = engine.canvasWidth.get();
    const height = engine.canvasHeight.get();
    return {
      min: engine.displayMin.get(),
      max: engine.displayMax.get(),
      window: engine.displayWindow.get(),
      now: engine.timestamp.get(),
      plot: {
        left: padLeft,
        top: padTop,
        right: width - padRight,
        bottom: height - padBottom,
        width,
        height,
      },
    };
  }, [engine, padLeft, padTop, padRight, padBottom]);

  return useMemo<ChartOverlayContext>(
    () => ({ scale, priceToY, yToPrice, timeToX, xToTime }),
    [scale],
  );
}

/**
 * Reactive Y for a price: projects `price` to its canvas Y pixel and returns it as
 * a `SharedValue<number>` that tracks the live axis on the UI thread. The
 * **recommended** way to place something at a price in a {@link LiveChartProps.renderOverlay}
 * — read the returned value in your `useAnimatedStyle` like any SharedValue; the
 * subscription to the chart's scale is handled here, so it can't be forgotten.
 *
 * ```tsx
 * function PriceLevel({ ctx, price }) {
 *   const y = usePriceY(ctx, price);
 *   const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
 *   return <Animated.View style={style} />;
 * }
 * ```
 *
 * It's a hook, so call it once per level (render one component per price). For
 * one-off math off the render path (e.g. a gesture handler), use the pure
 * {@link ChartOverlayContext.priceToY} with `ctx.scale.get()` instead.
 */
export function usePriceY(
  ctx: ChartOverlayContext,
  price: number,
): SharedValue<number> {
  const { scale, priceToY: toY } = ctx;
  // Destructure `scale` so it sits directly in the worklet's closure (Reanimated
  // observes top-level closure SharedValues, not ones reached via `ctx.scale`).
  return useDerivedValue(() => toY(price, scale.get()), [scale, toY, price]);
}

/**
 * Reactive X for a timestamp — the time↔pixel sibling of {@link usePriceY}.
 * Projects `time` (unix seconds) to its canvas X pixel as a `SharedValue<number>`
 * that tracks the scrolling window on the UI thread. Read it in your
 * `useAnimatedStyle`; call once per element.
 */
export function useTimeX(
  ctx: ChartOverlayContext,
  time: number,
): SharedValue<number> {
  const { scale, timeToX: toX } = ctx;
  return useDerivedValue(() => toX(time, scale.get()), [scale, toX, time]);
}
