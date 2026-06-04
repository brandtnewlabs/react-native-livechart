import { useLayoutEffect, useState } from "react";
import { StyleSheet, type TextStyle } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";

const FLASH_IN_MS = 100;
const FLASH_OUT_MS = 280;

/** Tailwind CSS default palette (v3) — https://tailwindcss.com/docs/customizing-colors */
const TW_ZINC_400 = "#a1a1aa";
const TW_EMERALD_400 = "#34d399";
const TW_RED_400 = "#f87171";

export type AnimatedTrendTextInputProps = {
  sharedValue: SharedValue<number>;
  maximumFractionDigits?: number;
  /**
   * Pre-built `Intl.NumberFormat` for grouping/locale/currency formatting.
   * Construct it once at module scope and pass it in (building one is slow, so
   * don't redo it per render); omit for a plain `toFixed`.
   */
  formatter?: Intl.NumberFormat;
  baseColor?: string;
  upColor?: string;
  downColor?: string;
  style?: TextStyle;
};

function formatValue(
  n: number,
  formatter: Intl.NumberFormat | undefined,
  maximumFractionDigits: number,
): string {
  if (!Number.isFinite(n)) return "—";
  return formatter ? formatter.format(n) : n.toFixed(maximumFractionDigits);
}

/**
 * Live numeric readout that flashes green/red on change and fades back to
 * neutral.
 *
 * The latest raw value is pushed into React state from a UI-thread
 * `useAnimatedReaction` (one render per value change); the displayed string is
 * derived from it during render, so toggling the formatter re-formats without an
 * effect. It used to drive an `Animated.createAnimatedComponent(TextInput)` and
 * set `text` via `useAnimatedProps` every tick — that pattern leaks native
 * memory on iOS (resident memory climbs for as long as the value keeps
 * updating). The color flash stays on the UI thread via `useAnimatedStyle`
 * (animating a `color` style does not leak); only the raw number crosses to JS.
 */
export function AnimatedTrendTextInput({
  sharedValue,
  maximumFractionDigits = 6,
  formatter,
  baseColor = TW_ZINC_400,
  upColor = TW_EMERALD_400,
  downColor = TW_RED_400,
  style,
}: AnimatedTrendTextInputProps) {
  const flash = useSharedValue(0);

  // Seed off the render path: reading a SharedValue during render (incl. a
  // useState initializer) trips Reanimated's strict-mode warning. useLayoutEffect
  // runs before paint, so there's no placeholder flash; the reaction below keeps
  // it live thereafter.
  const [rawValue, setRawValue] = useState(NaN);
  useLayoutEffect(() => {
    setRawValue(sharedValue.get());
  }, [sharedValue]);

  const display = formatValue(rawValue, formatter, maximumFractionDigits);

  // One reaction drives both the color flash (UI thread) and the value update
  // (marshalled to JS once per change — not a per-frame native text push).
  useAnimatedReaction(
    () => sharedValue.get(),
    (current, previous) => {
      if (current === previous) return;
      if (
        previous != null &&
        Number.isFinite(current) &&
        Number.isFinite(previous)
      ) {
        const dir = current > previous ? 1 : -1;
        flash.set(
          withSequence(
            withTiming(dir, { duration: FLASH_IN_MS }),
            withTiming(0, {
              duration: FLASH_OUT_MS,
              easing: Easing.out(Easing.cubic),
            }),
          ),
        );
      }
      runOnJS(setRawValue)(current);
    },
  );

  const animatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      flash.get(),
      [-1, 0, 1],
      [downColor, baseColor, upColor],
    ),
  }));

  return (
    <Animated.Text style={[styles.input, style, animatedStyle]}>
      {display}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 0,
    margin: 0,
  },
});
