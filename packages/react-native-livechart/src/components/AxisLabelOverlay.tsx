import { TextInput, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useDerivedValue,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

import type { ResolvedAxisLabelConfig } from "../core/resolveConfig";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";

/** Editable={false} TextInput so its `text` prop can be animated on the UI thread. */
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * The batteries-included axis edge label — an animated RN text driven by a
 * `SharedValue<number>` (the chart's current top / bottom Y-axis bound). The
 * value updates each frame on the UI thread via `useDerivedValue` +
 * `useAnimatedProps`, so the label tracks the live range without JS re-renders.
 *
 * Scoped into its own subcomponent so these hooks only run when the built-in
 * label is active (not when a custom `render` is supplied).
 */
function BuiltInAxisValueLabel({
  value,
  format,
  color,
  position,
}: {
  value: SharedValue<number>;
  format: (v: number) => string;
  color: string;
  position: "left" | "right";
}) {
  const text = useDerivedValue(() => format(value.get()));
  const animatedProps = useAnimatedProps(() => {
    const t = text.get();
    return { text: t, defaultValue: t };
  });
  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      style={{
        color,
        textAlign: position === "left" ? "left" : "right",
        padding: 0,
      }}
      animatedProps={animatedProps}
    />
  );
}

/**
 * React Native overlay (NOT Skia) floating axis edge labels over the Skia
 * canvas — `topLabel` pinned to the plot's top edge and `bottomLabel` to its
 * bottom edge (Robinhood-style high/low values).
 *
 * For each side: a resolved config with a `render` floats that custom element;
 * otherwise the built-in {@link BuiltInAxisValueLabel} shows the chart's current
 * `engine.displayMax` (top) / `engine.displayMin` (bottom) — the live Y-axis
 * bounds — formatted with the config's `format` (falling back to the chart's
 * `formatValue`) in the config `color` (falling back to `defaultColor`).
 *
 * Because the chart's `<View>` is the canvas size, the plot's top edge sits
 * `padding.top` px from the top and its bottom edge `padding.bottom` px from
 * the bottom — so positioning needs only the resolved padding (no live height,
 * no SharedValues). `pointerEvents="none"` keeps the labels display-only so they
 * never intercept the scrub pan gesture.
 */
export function AxisLabelOverlay({
  topLabel,
  bottomLabel,
  engine,
  formatValue,
  defaultColor,
  padding,
}: {
  topLabel: ResolvedAxisLabelConfig | null;
  bottomLabel: ResolvedAxisLabelConfig | null;
  engine: ChartEngineLayout;
  formatValue: (v: number) => string;
  defaultColor: string;
  padding: ChartPadding;
}) {
  if (!topLabel && !bottomLabel) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {topLabel && (
        <View
          style={{
            position: "absolute",
            top: padding.top,
            left: padding.left,
            right: padding.right,
          }}
        >
          {topLabel.render ? (
            topLabel.render()
          ) : (
            <BuiltInAxisValueLabel
              value={engine.displayMax}
              format={topLabel.format ?? formatValue}
              color={topLabel.color ?? defaultColor}
              position={topLabel.position}
            />
          )}
        </View>
      )}
      {bottomLabel && (
        <View
          style={{
            position: "absolute",
            bottom: padding.bottom,
            left: padding.left,
            right: padding.right,
          }}
        >
          {bottomLabel.render ? (
            bottomLabel.render()
          ) : (
            <BuiltInAxisValueLabel
              value={engine.displayMin}
              format={bottomLabel.format ?? formatValue}
              color={bottomLabel.color ?? defaultColor}
              position={bottomLabel.position}
            />
          )}
        </View>
      )}
    </View>
  );
}
