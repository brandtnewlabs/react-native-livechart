import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";

/** Inset from the anchored edge, matching the built-in threshold badge. */
const EDGE_INSET = 2;

/**
 * React Native overlay for a custom threshold badge. The chart owns the
 * position, measuring the returned element and pinning its vertical center to
 * the live threshold Y on the UI thread. The consumer owns only its contents and
 * chrome.
 */
export function CustomThresholdBadgeOverlay({
  element,
  engine,
  padding,
  y,
  visible,
  position,
}: {
  element: React.ReactElement;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  y: SharedValue<number>;
  visible: SharedValue<boolean>;
  position: "left" | "right";
}) {
  const size = useSharedValue({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    size.set({ width, height });
  };

  const animatedStyle = useAnimatedStyle(() => {
    const canvasWidth = engine.canvasWidth.get();
    const yy = y.get();
    const measured = size.get();
    const show = visible.get() && canvasWidth > 0 && Number.isFinite(yy);
    const translateX =
      position === "right"
        ? canvasWidth - padding.right - EDGE_INSET - measured.width
        : EDGE_INSET;
    return {
      opacity: show ? 1 : 0,
      transform: [
        { translateX },
        { translateY: yy - measured.height / 2 },
      ],
    };
  });

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
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
  anchor: { position: "absolute", top: 0, left: 0 },
});
