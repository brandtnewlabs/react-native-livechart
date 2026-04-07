import { useCallback, useMemo } from "react";
import { StyleSheet, TextInput, type TextStyle } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

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
   * When set, the label is formatted with `Intl.NumberFormat` on the RN thread
   * (`scheduleOnRN` from react-native-worklets) so you get grouping, locale
   * decimals, currency, etc.
   * Omit to keep `toFixed` entirely on the UI thread (cheaper per tick).
   */
  numberFormat?: NumberFormatConfig;
  baseColor?: string;
  upColor?: string;
  downColor?: string;
  style?: TextStyle;
};

function useTrendFlashReaction(
  sharedValue: SharedValue<number>,
  flash: SharedValue<number>,
) {
  useAnimatedReaction(
    () => sharedValue.value,
    (current, previous) => {
      if (
        previous == null ||
        !Number.isFinite(current) ||
        !Number.isFinite(previous) ||
        current === previous
      ) {
        return;
      }
      const dir = current > previous ? 1 : -1;
      flash.value = withSequence(
        withTiming(dir, { duration: FLASH_IN_MS }),
        withTiming(0, {
          duration: FLASH_OUT_MS,
          easing: Easing.out(Easing.cubic),
        }),
      );
    },
    [sharedValue, flash],
  );
}

function AnimatedTrendTextInputPlain({
  sharedValue,
  maximumFractionDigits = 6,
  baseColor = TW_ZINC_400,
  upColor = TW_EMERALD_400,
  downColor = TW_RED_400,
  style,
}: AnimatedTrendTextInputProps) {
  const flash = useSharedValue(0);
  useTrendFlashReaction(sharedValue, flash);

  const animatedProps = useAnimatedProps(() => {
    const v = sharedValue.value;
    const text = Number.isFinite(v) ? v.toFixed(maximumFractionDigits) : "—";
    return { text, defaultValue: text };
  });

  const animatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      flash.value,
      [-1, 0, 1],
      [downColor, baseColor, upColor],
    ),
  }));

  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      underlineColorAndroid="transparent"
      style={[styles.input, style, animatedStyle]}
      animatedProps={animatedProps}
    />
  );
}

function AnimatedTrendTextInputWithIntl({
  sharedValue,
  maximumFractionDigits = 6,
  numberFormat,
  baseColor = TW_ZINC_400,
  upColor = TW_EMERALD_400,
  downColor = TW_RED_400,
  style,
}: AnimatedTrendTextInputProps & { numberFormat: NumberFormatConfig }) {
  const flash = useSharedValue(0);
  const formattedSv = useSharedValue("");
  useTrendFlashReaction(sharedValue, flash);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(numberFormat.locales, {
        maximumFractionDigits,
        ...numberFormat.options,
      }),
    [numberFormat.locales, numberFormat.options, maximumFractionDigits],
  );

  const pushFormatted = useCallback(
    (n: number) => {
      if (!Number.isFinite(n)) {
        formattedSv.value = "—";
        return;
      }
      formattedSv.value = formatter.format(n);
    },
    [formatter, formattedSv],
  );

  useAnimatedReaction(
    () => sharedValue.value,
    (current) => {
      scheduleOnRN(pushFormatted, current);
    },
    [sharedValue, pushFormatted],
  );

  const animatedProps = useAnimatedProps(() => ({
    text: formattedSv.value,
    defaultValue: formattedSv.value,
  }));

  const animatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      flash.value,
      [-1, 0, 1],
      [downColor, baseColor, upColor],
    ),
  }));

  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      underlineColorAndroid="transparent"
      style={[styles.input, style, animatedStyle]}
      animatedProps={animatedProps}
    />
  );
}

// TextInput (not Text) so useAnimatedProps can push `text` on the UI thread like a label.
// editable={false} + pointerEvents="none" keeps it from behaving like an input.
export function AnimatedTrendTextInput(props: AnimatedTrendTextInputProps) {
  if (props.numberFormat != null) {
    return (
      <AnimatedTrendTextInputWithIntl
        {...props}
        numberFormat={props.numberFormat}
      />
    );
  }
  return <AnimatedTrendTextInputPlain {...props} />;
}

const styles = StyleSheet.create({
  input: {
    padding: 0,
    margin: 0,
  },
});
