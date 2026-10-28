import { useCallback, useState, type ReactElement } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { ResolvedResetButtonConfig } from "../core/resolveConfig";
import type { ResetButtonRect } from "../hooks/resetButtonLayout";
import type { LiveChartPalette, ResetButtonRenderProps } from "../types";

/**
 * React Native overlay (NOT Skia) for the floating reset-view button. The
 * wrapper is positioned from the chart's rect on the UI thread and faded with
 * `visible`; the tap itself is an RNGH gesture composed ahead of the plot graph
 * (see `useResetButton`), so the content here is a plain view. Renders the
 * consumer's `renderResetButton` element when given, otherwise a round glyph
 * button in palette colors.
 */
export function ResetButtonOverlay({
  config,
  visible,
  rect,
  measuredWidth,
  measuredHeight,
  reset,
  render,
  palette,
  fontFamily,
}: {
  config: ResolvedResetButtonConfig;
  visible: SharedValue<boolean>;
  rect: SharedValue<ResetButtonRect>;
  measuredWidth: SharedValue<number>;
  measuredHeight: SharedValue<number>;
  reset: () => void;
  render: ((props: ResetButtonRenderProps) => ReactElement) | undefined;
  palette: LiveChartPalette;
  fontFamily: string;
}) {
  const { fadeMs } = config;
  const opacity = useDerivedValue(() =>
    withTiming(visible.get() ? 1 : 0, { duration: fadeMs }),
  );
  const wrapperStyle = useAnimatedStyle(() => {
    const r = rect.get();
    return {
      opacity: opacity.get(),
      transform: [{ translateX: r.x }, { translateY: r.y }],
    };
  });

  // Mirrored to React so a hidden button is neither focusable by screen
  // readers nor a target for native touches (the chart's RNGH gestures are
  // unaffected either way: they live on the ancestor view).
  const [isShown, setIsShown] = useState(false);
  useAnimatedReaction(
    () => visible.get(),
    /* istanbul ignore next -- Reanimated reaction; state mirrored on the JS thread, not exercised under Jest */
    (shown, previous) => {
      if (shown !== previous) scheduleOnRN(setIsShown, shown);
    },
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      measuredWidth.set(width);
      measuredHeight.set(height);
    },
    [measuredHeight, measuredWidth],
  );

  return (
    <Animated.View
      style={[styles.wrapper, wrapperStyle]}
      onLayout={onLayout}
      pointerEvents={isShown ? "box-none" : "none"}
      accessibilityElementsHidden={!isShown}
      importantForAccessibility={isShown ? "auto" : "no-hide-descendants"}
    >
      {render ? (
        render({ visible, reset })
      ) : (
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={config.accessibilityLabel}
          onAccessibilityTap={reset}
          style={{
            width: config.size,
            height: config.size,
            borderRadius: config.size / 2,
            backgroundColor: config.color ?? palette.badgeBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontFamily,
              fontSize: config.size / 2,
              color: config.iconColor ?? palette.badgeText,
            }}
          >
            {config.icon}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", left: 0, top: 0 },
});
