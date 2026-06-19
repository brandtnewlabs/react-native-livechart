import { StyleSheet, Text, TextInput, View } from "react-native";

import { Circle, Group } from "@shopify/react-native-skia";
import { useState } from "react";
import {
  formatTime,
  LiveChart,
  type ScrubConfig,
  type SelectionDotProps,
  type TooltipRenderProps,
} from "react-native-livechart";
import Animated, {
  useAnimatedProps,
  useSharedValue,
} from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { demoStyles } from "../../demo-lib/styles";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Scrubbing" };

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type ScrubMode = "off" | "on" | "noTooltip";

const SCRUB_OPTIONS: { value: ScrubMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "on", label: "On + tooltip" },
  { value: "noTooltip", label: "On, no tooltip" },
];

type TooltipPlacement = NonNullable<ScrubConfig["tooltipPlacement"]>;

// Placement applies to BOTH the built-in pill and a custom `renderTooltip` —
// the chart positions either one on the UI thread per `tooltipPlacement`.
// `"point"` follows the scrub dot (floats above it, flipping below near the top).
const PLACEMENT_OPTIONS: { value: TooltipPlacement; label: string }[] = [
  { value: "side", label: "Side" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "point", label: "Point" },
];

// Gap between the tooltip and the plot edge it's pinned to (`tooltipMargin`).
const MARGIN_OPTIONS: { value: number; label: string }[] = [
  { value: 8, label: "8" },
  { value: 24, label: "24" },
  { value: 48, label: "48" },
];

type DisplayMode = "line" | "candle";

const DISPLAY_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "candle", label: "Candle (OHLC readout)" },
];

// Opacity of the chart content to the right of the crosshair while scrubbing.
// `1` = no fade, `0` = fully faded. Lower fades the "future" more.
const DIM_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Off" },
  { value: 0.6, label: "Light" },
  { value: 0.3, label: "Default" },
  { value: 0, label: "Full" },
];

type DotMode = "default" | "styled" | "custom" | "off";

const DOT_OPTIONS: { value: DotMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "styled", label: "Styled" },
  { value: "custom", label: "Custom" },
  { value: "off", label: "Off" },
];

// Custom selection dot: a hollow amber ring with a center fill, drawn at the
// scrub intersection. A Skia component receiving the scrub position as
// SharedValues, so it animates on the UI thread (no re-renders while scrubbing).
function RingSelectionDot({ x, y, opacity, size }: SelectionDotProps) {
  return (
    <Group opacity={opacity}>
      <Circle cx={x} cy={y} r={size + 3} color="#fbbf24" style="stroke" strokeWidth={2} />
      <Circle cx={x} cy={y} r={size - 1} color="#fbbf24" />
    </Group>
  );
}

// A fully custom tooltip (`renderTooltip`): a brand-blue pill with white date
// text. The chart floats it over the canvas and positions it on the UI thread;
// the date is an animated TextInput bound to `timeStr`, so movement AND text
// both update on the UI thread — no JS re-render while scrubbing. Works the same
// under hold-to-scrub (the overlay is `pointerEvents="box-none"`, so the pan
// gesture and its `panGestureDelay` are unaffected). Used here in line mode.
function BlueTooltip({ timeStr }: TooltipRenderProps) {
  const animatedProps = useAnimatedProps(() => {
    const t = timeStr.get();
    return { text: t, defaultValue: t };
  });
  return (
    <View style={styles.blueTip}>
      <AnimatedTextInput
        editable={false}
        underlineColorAndroid="transparent"
        style={styles.blueTipText}
        animatedProps={animatedProps}
      />
    </View>
  );
}

// A custom CANDLE tooltip: it binds `ctx.candle` (the scrubbed OHLC bucket) to
// an animated TextInput, so the O/H/L/C readout updates on the UI thread as you
// scrub — replacing the built-in OHLC stack. A monospace font + fixed width keep
// the four values aligned and clip-free as the digits change.
function OhlcTooltip({ candle }: TooltipRenderProps) {
  const animatedProps = useAnimatedProps(() => {
    const c = candle.get();
    const text = c
      ? `O ${c.open.toFixed(2)}  H ${c.high.toFixed(2)}\nL ${c.low.toFixed(2)}  C ${c.close.toFixed(2)}`
      : "";
    return { text, defaultValue: text };
  });
  return (
    <View style={styles.ohlcTip}>
      <AnimatedTextInput
        editable={false}
        multiline
        numberOfLines={2}
        scrollEnabled={false}
        underlineColorAndroid="transparent"
        style={styles.ohlcTipText}
        animatedProps={animatedProps}
      />
    </View>
  );
}

export default function ScrubbingScreen() {
  const [scrubMode, setScrubMode] = useState<ScrubMode>("on");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("line");
  const [styledTooltip, setStyledTooltip] = useState(false);
  const [customTooltip, setCustomTooltip] = useState(false);
  const [tooltipPlacement, setTooltipPlacement] =
    useState<TooltipPlacement>("side");
  const [tooltipMargin, setTooltipMargin] = useState(8);
  const [dateOnly, setDateOnly] = useState(false);
  const [roundedTip, setRoundedTip] = useState(false);
  const [dimOpacity, setDimOpacity] = useState(0.3);
  const [dotMode, setDotMode] = useState<DotMode>("default");
  const [holdToScrub, setHoldToScrub] = useState(false);
  // onGestureStart/onGestureEnd are JS-thread callbacks, so plain React state
  // is fine here (they fire once per gesture, not once per pointer move).
  const [gestureState, setGestureState] = useState<"idle" | "scrubbing…">(
    "idle",
  );
  // Press-and-hold delay: lets a quick horizontal swipe pass through to a
  // navigator's swipe-back gesture instead of scrubbing.
  const panGestureDelay = holdToScrub ? 250 : 0;

  // Readout flows through a SharedValue + animatedProps so each scrub frame
  // updates the text on the UI thread — no React re-render per pointer move.
  // (A plain setState here re-rendered the whole screen ~60x/sec while scrubbing.)
  const readoutText = useSharedValue("—");
  const readoutProps = useAnimatedProps(() => {
    const text = readoutText.get();
    return { text, defaultValue: text };
  });

  const windowSecs = 300;
  const candleWidthSecs = Math.max(5, Math.round(windowSecs / 20));

  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: displayMode === "candle",
    tradeStream: false,
    candleWidth: candleWidthSecs,
    // Dense seed (fine "1m" sampling over the window) so candle buckets get many
    // ticks each — real bodies + wicks instead of flat one-point dojis.
    historySpanSeconds: windowSecs,
    historyRange: "1m",
    volatilityMode: "volatile",
    // Keep the re-aggregated tick buffer longer than the 300s window so the
    // oldest committed candle never loses on-screen ticks (≈600s at the volatile
    // default rate); otherwise it would mutate on every trade.
    maxPoints: 6000,
  });

  const scrub: ScrubConfig | boolean =
    scrubMode === "off"
      ? false
      : {
          tooltip: scrubMode !== "noTooltip",
          dimOpacity,
          panGestureDelay,
          // Tooltip layout knobs — apply to the built-in pill and the custom
          // render alike (placement + margin position either one).
          tooltipPlacement,
          tooltipMargin,
          tooltipShowValue: !dateOnly,
          tooltipBorderRadius: roundedTip ? 16 : 5,
          // The "Styled" toggle recolors the built-in pill + crosshair line.
          ...(styledTooltip
            ? {
                tooltipBackground: "#1e293b",
                tooltipColor: "#fbbf24",
                tooltipBorderColor: "#fbbf24",
                crosshairLineColor: "#fbbf24",
              }
            : {}),
        };

  // The `boolean | SelectionDotConfig` idiom: `true` = built-in dot, `false` =
  // hidden, a config tweaks size/color/ring, and `{ component }` swaps in a
  // fully custom Skia dot.
  const selectionDot =
    dotMode === "custom"
      ? { component: RingSelectionDot }
      : dotMode === "styled"
        ? { size: 6, color: "#fbbf24", ring: { width: 2 } }
        : dotMode === "off"
          ? false
          : true;

  return (
    <DemoScreen
      title="Scrubbing"
      docs="guides/scrubbing"
      description="Scrub modes + tooltips. Custom render works in line AND candle mode (toggle both on to see the OHLC pill)."
      chart={
        <LiveChart
          data={data}
          value={value}
          mode={displayMode}
          candles={displayMode === "candle" ? candles : undefined}
          liveCandle={displayMode === "candle" ? liveCandle : undefined}
          candleWidth={candleWidthSecs}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={windowSecs}
          scrub={scrub}
          // A custom tooltip works in both modes: the blue date pill in line
          // mode, a bespoke OHLC pill (reading `ctx.candle`) in candle mode.
          renderTooltip={
            customTooltip
              ? displayMode === "candle"
                ? OhlcTooltip
                : BlueTooltip
              : undefined
          }
          selectionDot={selectionDot}
          onGestureStart={() => setGestureState("scrubbing…")}
          onGestureEnd={() => setGestureState("idle")}
          onScrub={(point) => {
            "worklet";
            if (point === null) {
              readoutText.set("— (live)");
              return;
            }
            let extra = "";
            if (point.candle) {
              const c = point.candle;
              extra = ` | O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)}`;
            }
            readoutText.set(
              `${point.value.toFixed(4)} @ ${formatTime(point.time)}${extra}`,
            );
          }}
        />
      }
    >
      <Text style={demoStyles.scrubReadout}>Gesture: {gestureState}</Text>

      <AnimatedTextInput
        editable={false}
        multiline
        numberOfLines={3}
        scrollEnabled={false}
        underlineColorAndroid="transparent"
        style={demoStyles.scrubReadout}
        animatedProps={readoutProps}
      />

      <ChipRow
        label="Scrub"
        options={SCRUB_OPTIONS}
        value={scrubMode}
        onChange={setScrubMode}
      />
      <ChipRow
        label="Tooltip placement"
        options={PLACEMENT_OPTIONS}
        value={tooltipPlacement}
        onChange={setTooltipPlacement}
      />
      <ChipRow
        label="Tooltip margin (edge gap)"
        options={MARGIN_OPTIONS}
        value={tooltipMargin}
        onChange={setTooltipMargin}
      />
      <ControlRow label="Tooltip">
        {/* Date-only + rounded restyle the built-in pill; Custom render swaps in
            a brand-blue RN pill. Placement/margin apply to the custom one too. */}
        <ToggleChip label="Date only" value={dateOnly} onChange={setDateOnly} />
        <ToggleChip
          label="Rounded"
          value={roundedTip}
          onChange={setRoundedTip}
        />
        <ToggleChip
          label="Styled"
          value={styledTooltip}
          onChange={setStyledTooltip}
        />
        <ToggleChip
          label="Custom render"
          value={customTooltip}
          onChange={setCustomTooltip}
        />
      </ControlRow>
      <ChipRow
        label="Trailing fade (dimOpacity)"
        options={DIM_OPTIONS}
        value={dimOpacity}
        onChange={setDimOpacity}
      />
      <ChipRow
        label="Selection dot"
        options={DOT_OPTIONS}
        value={dotMode}
        onChange={setDotMode}
      />
      <ControlRow label="Gesture">
        <ToggleChip
          label="Hold to scrub (250ms)"
          value={holdToScrub}
          onChange={setHoldToScrub}
        />
      </ControlRow>

      <ChipRow
        label="Display"
        options={DISPLAY_OPTIONS}
        value={displayMode}
        onChange={setDisplayMode}
      />
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  blueTip: {
    borderRadius: 10,
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  blueTipText: {
    // Fixed width: the TextInput is measured once at mount; UI-thread text
    // updates don't re-trigger a layout pass, so an auto-width pill would clip.
    width: 72,
    textAlign: "center",
    color: "#fff",
    fontSize: 13,
    padding: 0,
    fontFamily: "JetBrainsMono_400Regular",
  },
  ohlcTip: {
    borderRadius: 8,
    backgroundColor: "#0f172a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ohlcTipText: {
    // Fixed box (UI-thread text doesn't re-layout) + monospace so the four
    // values stay column-aligned and never outgrow the pill as digits change.
    width: 150,
    height: 32,
    color: "#e2e8f0",
    fontSize: 11,
    lineHeight: 14,
    padding: 0,
    fontFamily: "JetBrainsMono_400Regular",
  },
});
