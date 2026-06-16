import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AxisLabelConfig, CandlePoint } from "react-native-livechart";
import { LiveChart } from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Extrema labels" };

type Position = "extrema" | "extrema-edge" | "right";

// `"extrema"` floats topLabel/bottomLabel at the actual high / low data point;
// `"extrema-edge"` keeps the value on the top/bottom rail (x-aligned with the
// extremum) and joins it to a dot on the point with a connector line; `"right"`
// is the classic edge-pinned readout for comparison.
const POSITION_OPTIONS: { value: Position; label: string }[] = [
  { value: "extrema", label: "At the point" },
  { value: "extrema-edge", label: "At the edge" },
  { value: "right", label: "Pinned right" },
];

type DisplayMode = "line" | "candle";

const DISPLAY_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "candle", label: "Candle" },
];

// Built-in label styling knobs (fontSize / fontWeight / dotSize / dot) — applied
// to topLabel + bottomLabel below.
const FONT_SIZE_OPTIONS: { value: number; label: string }[] = [
  { value: 11, label: "11" },
  { value: 14, label: "14" },
  { value: 18, label: "18" },
];

const DOT_SIZE_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: "Small" },
  { value: 11, label: "Medium" },
  { value: 16, label: "Large" },
];

const HIGH_COLOR = "#34d399";
const LOW_COLOR = "#f87171";

// Worklet-safe: `formatValue` and the label `format` are called on the UI thread
// (grid labels + the extrema label text), so they need the worklet directive —
// same requirement as the States demo's formatters.
function fmt(v: number): string {
  "worklet";
  return `$${v.toFixed(2)}`;
}

export default function ExtremaLabelsScreen() {
  const [position, setPosition] = useState<Position>("extrema");
  const [custom, setCustom] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("line");
  // Built-in label styling.
  const [fontSize, setFontSize] = useState(11);
  const [bold, setBold] = useState(false);
  const [showDot, setShowDot] = useState(true);
  const [dotSize, setDotSize] = useState(7);
  const [connector, setConnector] = useState(true);

  const windowSecs = 300;
  const candleWidthSecs = 15;
  const isCandle = displayMode === "candle";

  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: isCandle,
    tradeStream: false,
    candleWidth: candleWidthSecs,
    // Keep the line calm + low-frequency so it reads cleanly and the high / low
    // points stand out — this demo is about the labels, not volatility. Candle
    // mode bumps the volatility so the 15s buckets still get real bodies + wicks.
    historySpanSeconds: windowSecs,
    historyRange: "1m",
    volatilityMode: isCandle ? "volatile" : "calm",
    tradesPerSecond: 2,
    maxPoints: 6000,
  });

  const emptyCandles = useSharedValue<CandlePoint[]>([]);
  const nullLive = useSharedValue<CandlePoint | null>(null);

  // Built-in styling shared by both labels: font size + weight style the value
  // text (in either position mode); dot + dotSize style the extrema marker;
  // connector is the dot → edge line in "At the edge" mode (ignored otherwise).
  const styleProps = {
    fontSize,
    fontWeight: bold ? ("700" as const) : undefined,
    dot: showDot,
    dotSize,
    connector,
  };

  // The high tracks the peak, the low tracks the trough. `render` floats any RN
  // element at the point instead of the built-in dot + value (and ignores the
  // style knobs — you own the chrome).
  const topLabel: AxisLabelConfig = custom
    ? {
        position,
        render: () => (
          <View style={[styles.tag, { backgroundColor: HIGH_COLOR }]}>
            <Text style={styles.tagText}>HIGH</Text>
          </View>
        ),
      }
    : { position, format: fmt, color: HIGH_COLOR, ...styleProps };

  const bottomLabel: AxisLabelConfig = custom
    ? {
        position,
        render: () => (
          <View style={[styles.tag, { backgroundColor: LOW_COLOR }]}>
            <Text style={styles.tagText}>LOW</Text>
          </View>
        ),
      }
    : { position, format: fmt, color: LOW_COLOR, ...styleProps };

  return (
    <DemoScreen
      title="Extrema labels"
      docs="guides/theming"
      description='topLabel / bottomLabel extrema modes: "At the point" floats the readout on the high/low data point; "At the edge" keeps it on the top/bottom rail (x-aligned) with a connector to a dot on the point.'
      chart={
        <LiveChart
          data={data}
          value={value}
          mode={displayMode}
          candles={isCandle ? candles : emptyCandles}
          liveCandle={isCandle ? liveCandle : nullLive}
          candleWidth={candleWidthSecs}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={windowSecs}
          formatValue={fmt}
          topLabel={topLabel}
          bottomLabel={bottomLabel}
        />
      }
    >
      <ChipRow
        label="Label position"
        options={POSITION_OPTIONS}
        value={position}
        onChange={setPosition}
      />
      <ChipRow
        label="Display"
        options={DISPLAY_OPTIONS}
        value={displayMode}
        onChange={setDisplayMode}
      />
      <ChipRow
        label="Font size"
        options={FONT_SIZE_OPTIONS}
        value={fontSize}
        onChange={setFontSize}
      />
      <ChipRow
        label="Dot size"
        options={DOT_SIZE_OPTIONS}
        value={dotSize}
        onChange={setDotSize}
      />
      <ControlRow label="Built-in style">
        {/* fontWeight, the dot toggle, and the "At the edge" connector line.
            These style the built-in label; a custom `render` ignores them. */}
        <ToggleChip label="Bold" value={bold} onChange={setBold} />
        <ToggleChip label="Show dot" value={showDot} onChange={setShowDot} />
        <ToggleChip
          label="Connector"
          value={connector}
          onChange={setConnector}
        />
      </ControlRow>
      <ControlRow label="Rendering">
        {/* Built-in = dot + value text; Custom = a `render` element at the point. */}
        <ToggleChip label="Custom render" value={custom} onChange={setCustom} />
      </ControlRow>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagText: {
    color: "#0b1220",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
