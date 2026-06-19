import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import type { TooltipLayout } from "../hooks/crosshairShared";
import type { CandlePoint, TooltipRenderProps } from "../types";

// Mirror the Skia tooltip's offsets (see crosshairShared.ts) so a custom pill
// lines up with where the built-in one would sit. The vertical edge gap is
// configurable via `scrub.tooltipMargin` (passed as `margin`).
const OFFSET_X = 12;
const EDGE_GAP = 4;

/**
 * React Native overlay (NOT Skia) that floats a custom `renderTooltip` element
 * over the Skia canvas while scrubbing. A sibling of `<Canvas>` — like
 * {@link AxisLabelOverlay} and `CustomMarkerOverlay` — so the element can be any
 * RN view (e.g. a glass `BlurView`) and stays crisp at native resolution.
 *
 * The element is positioned entirely on the UI thread: a `useAnimatedStyle`
 * transform tracks `scrubX` + the resolved `tooltipPlacement`, measuring the
 * element's own size via `onLayout` so it can flip/clamp/center correctly — so
 * movement stays smooth without JS re-renders, unlike rebuilding the tooltip
 * from the JS-thread `onScrub`. The consumer binds the {@link TooltipRenderProps}
 * SharedValues to animated text for the value/date to update on the UI thread.
 *
 * `pointerEvents="box-none"` lets the scrub pan gesture pass through the empty
 * area (and any non-interactive tooltip body) while still allowing an
 * interactive leaf inside the custom element to be tapped.
 */
export function CustomTooltipOverlay({
  renderTooltip,
  scrubX,
  scrubValue,
  scrubTime,
  scrubActive,
  scrubCandle,
  crosshairOpacity,
  tooltipLayout,
  engine,
  padding,
  placement,
  margin = 8,
  lineTop,
  scrubDotY,
}: {
  renderTooltip: (ctx: TooltipRenderProps) => React.ReactElement | null | undefined;
  scrubX: SharedValue<number>;
  scrubValue: SharedValue<number | null>;
  scrubTime: SharedValue<number>;
  scrubActive: SharedValue<boolean>;
  /** OHLC candle under the crosshair (candle mode); omitted/`null` in line mode. */
  scrubCandle?: SharedValue<CandlePoint | null>;
  crosshairOpacity: SharedValue<number>;
  tooltipLayout: SharedValue<TooltipLayout>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  placement: "side" | "top" | "bottom" | "point";
  /** Gap (px) between the pill and the plot edge it's pinned to. Default 8. */
  margin?: number;
  /** When `placement` is `"top"`, the overlay publishes the label's bottom edge
   *  (canvas Y) here so {@link CrosshairOverlay} can stop the crosshair line at
   *  the label instead of running through it; -1 when not top-pinned/active. */
  lineTop?: SharedValue<number>;
  /** Scrub intersection Y in canvas px (the value the dot marks) — the anchor
   *  for `"point"` placement. Omitted / -1 falls back to a top pin. */
  scrubDotY?: SharedValue<number>;
}) {
  // Formatted strings come ready-made off the layout (formatted UI-side in
  // computeTooltipLayout / computeCandleTooltipLayout), so consumers don't need
  // a worklet-safe formatter for the value/time.
  const valueStr = useDerivedValue(() => tooltipLayout.get().valueStr);
  const timeStr = useDerivedValue(() => tooltipLayout.get().timeStr);
  // A stable `null` candle SharedValue for line mode so `ctx.candle` is always
  // present (a SharedValue), regardless of mode.
  const nullCandle = useSharedValue<CandlePoint | null>(null);

  const ctx: TooltipRenderProps = {
    value: scrubValue,
    time: scrubTime,
    valueStr,
    timeStr,
    active: scrubActive,
    candle: scrubCandle ?? nullCandle,
  };
  const element = renderTooltip(ctx);

  // Measured element size, so the transform can flip/center/clamp the pill.
  const size = useSharedValue({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    size.value = { width, height };
    // Publish the label's bottom edge (canvas Y) for a top-pinned tooltip so
    // CrosshairOverlay stops the crosshair line at the label instead of running
    // up through it; -1 for side/bottom → the line keeps its default start. The
    // value when idle is irrelevant (the crosshair is hidden), so reacting to the
    // measured height alone — no scrub-active dependency — is enough.
    lineTop?.set(placement === "top" ? margin + height : -1);
  };

  const animatedStyle = useAnimatedStyle(() => {
    const active = scrubActive.get();
    const sx = scrubX.get();
    const cw = engine.canvasWidth.get();
    const ch = engine.canvasHeight.get();
    const s = size.get();
    const rightEdge = cw - padding.right;

    let x: number;
    let y: number;
    if (placement === "side") {
      x = sx + OFFSET_X;
      if (x + s.width > rightEdge - EDGE_GAP) x = sx - s.width - OFFSET_X;
      y = padding.top + margin;
    } else {
      // Center on the crosshair, clamped to the *canvas* edges (not the plot's
      // inner bounds) so a top/bottom-pinned label follows the crosshair all the
      // way into the left/right gutters — e.g. past the wide Y-axis gutter on the
      // right — instead of stopping short of the edge.
      const leftBound = EDGE_GAP;
      const rightBound = cw - EDGE_GAP - s.width;
      x = Math.min(
        Math.max(sx - s.width / 2, leftBound),
        Math.max(leftBound, rightBound),
      );
      if (placement === "point") {
        // Float just above the scrub dot, flipping below when there's no room
        // above; clamp into the plot. Mirrors computeTooltipLayout's "point".
        const dotY = scrubDotY?.get() ?? -1;
        if (dotY < 0) {
          y = padding.top + margin;
        } else {
          const topLimit = padding.top + EDGE_GAP;
          const bottomLimit = ch - padding.bottom - EDGE_GAP - s.height;
          const aboveY = dotY - margin - s.height;
          const belowY = dotY + margin;
          y = aboveY >= topLimit ? aboveY : belowY;
          y = Math.min(Math.max(y, topLimit), Math.max(topLimit, bottomLimit));
        }
      } else {
        y =
          placement === "top"
            ? // Pin to the canvas top edge (not the plot's inner top), so the
              // label sits above the data and the crosshair line can stop at it.
              margin
            : ch - padding.bottom - margin - s.height;
      }
    }

    return {
      opacity: active ? crosshairOpacity.get() : 0,
      transform: [{ translateX: x }, { translateY: y }],
    };
  });

  if (element == null) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        pointerEvents="box-none"
        onLayout={onLayout}
        style={[styles.anchor, animatedStyle]}
      >
        {element}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // top/left 0 + transform so the measured element can be placed precisely.
  anchor: { position: "absolute", top: 0, left: 0 },
});
