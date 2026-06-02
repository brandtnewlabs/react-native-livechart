import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, type TextStyle } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const FLASH_IN_MS = 100;
const FLASH_OUT_MS = 280;

/** Tailwind CSS default palette (v3) — https://tailwindcss.com/docs/customizing-colors */
const TW_ZINC_400 = "#a1a1aa";
const TW_EMERALD_400 = "#34d399";
const TW_RED_400 = "#f87171";

export type NumberFormatConfig = {
  locales?: Intl.LocalesArgument;
  options?: Intl.NumberFormatOptions;
};

export type AnimatedTrendTextInputProps = {
  sharedValue: SharedValue<number>;
  maximumFractionDigits?: number;
  /**
   * When set, the label is formatted with `Intl.NumberFormat` (grouping, locale
   * decimals, currency, etc.). Omit for a plain `toFixed`.
   */
  numberFormat?: NumberFormatConfig;
  baseColor?: string;
  upColor?: string;
  downColor?: string;
  style?: TextStyle;
};

/**
 * Live numeric readout that flashes green/red on change and fades back to
 * neutral.
 *
 * The text content is pushed into React state from a UI-thread
 * `useAnimatedReaction` (throttled to one render per value change). It used to
 * drive an `Animated.createAnimatedComponent(TextInput)` and set `text` via
 * `useAnimatedProps` every tick — that pattern leaks native memory on iOS
 * (resident memory climbs for as long as the value keeps updating). The color
 * flash stays on the UI thread via `useAnimatedStyle` (animating a `color`
 * style does not leak); only the string content crosses to JS.
 */
export function AnimatedTrendTextInput({
  sharedValue,
  maximumFractionDigits = 6,
  numberFormat,
  baseColor = TW_ZINC_400,
  upColor = TW_EMERALD_400,
  downColor = TW_RED_400,
  style,
}: AnimatedTrendTextInputProps) {
  const flash = useSharedValue(0);

  const formatter = useMemo(
    () =>
      numberFormat
        ? new Intl.NumberFormat(numberFormat.locales, {
            maximumFractionDigits,
            ...numberFormat.options,
          })
        : null,
    [numberFormat?.locales, numberFormat?.options, maximumFractionDigits],
  );

  const format = useCallback(
    (n: number) => {
      if (!Number.isFinite(n)) return "—";
      return formatter ? formatter.format(n) : n.toFixed(maximumFractionDigits);
    },
    [formatter, maximumFractionDigits],
  );

  const latest = useRef<number | null>(null);
  if (latest.current === null) latest.current = sharedValue.get();
  const [display, setDisplay] = useState(() => format(sharedValue.get()));

  const onValue = useCallback(
    (n: number) => {
      latest.current = n;
      setDisplay(format(n));
    },
    [format],
  );

  // Re-format the current value when the formatter changes (e.g. toggling Intl).
  useEffect(() => {
    setDisplay(format(latest.current!));
  }, [format]);

  // One reaction drives both the color flash (UI thread) and the text update
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
      runOnJS(onValue)(current);
    },
    [onValue],
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
