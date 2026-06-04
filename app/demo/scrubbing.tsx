import { TextInput } from "react-native";

import { useState } from "react";
import { formatTime, LiveChart } from "react-native-livechart";
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

type DisplayMode = "line" | "candle";

const DISPLAY_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "candle", label: "Candle (OHLC in readout)" },
];

// Opacity of the chart content to the right of the crosshair while scrubbing.
// `1` = no fade, `0` = fully faded. Lower fades the "future" more.
const DIM_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Off" },
  { value: 0.6, label: "Light" },
  { value: 0.3, label: "Default" },
  { value: 0, label: "Full" },
];

export default function ScrubbingScreen() {
  const [scrubMode, setScrubMode] = useState<ScrubMode>("on");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("line");
  const [styledTooltip, setStyledTooltip] = useState(false);
  const [dimOpacity, setDimOpacity] = useState(0.3);

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

  const scrub =
    scrubMode === "off"
      ? false
      : scrubMode === "noTooltip"
        ? { tooltip: false, dimOpacity }
        : styledTooltip
          ? {
              tooltip: true,
              dimOpacity,
              tooltipBackground: "#1e293b",
              tooltipColor: "#fbbf24",
              tooltipBorderColor: "#fbbf24",
              crosshairLineColor: "#fbbf24",
            }
          : { tooltip: true, dimOpacity };

  return (
    <DemoScreen
      title="Scrubbing"
      docs="guides/scrubbing"
      description="Scrub modes; candle mode shows ScrubPoint.candle in readout"
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
        label="Trailing fade (dimOpacity)"
        options={DIM_OPTIONS}
        value={dimOpacity}
        onChange={setDimOpacity}
      />
      <ControlRow>
        <ToggleChip
          label="Styled tooltip"
          value={styledTooltip}
          onChange={setStyledTooltip}
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
