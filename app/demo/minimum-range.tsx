import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  LiveChart,
  LiveChartSeries,
  type ChartOverlayContext,
} from "react-native-livechart";
import Animated, {
  useAnimatedProps,
  useSharedValue,
} from "react-native-reanimated";

import { Chip, ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { APP_FONT_FAMILY } from "../../demo-lib/fonts";
import { ACCENT, formatWholeValue } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import {
  RANGE_SCENARIOS,
  useMinimumRangeData,
  type RangeScenario,
} from "../../demo-lib/useMinimumRangeData";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
type Mode = "line" | "candle" | "series";
type Floor = "off" | "0.3" | "4";
const FLOORS = [
  { value: "off", label: "Auto-fit" },
  { value: "0.3", label: "0.3 units" },
  { value: "4", label: "4 units" },
] as const;
const MODES = [
  { value: "line", label: "Line" },
  { value: "candle", label: "Candles" },
  { value: "series", label: "Series" },
] as const;
const PANELS = [
  { value: "compare", label: "Compare" },
  { value: "options", label: "Options" },
] as const;
const SCENARIOS = (Object.keys(RANGE_SCENARIOS) as RangeScenario[]).map(
  (value) => ({ value, label: RANGE_SCENARIOS[value].label }),
);
const HINTS: Record<RangeScenario, string> = {
  price:
    "With $1 labels, auto-fit repeats $87,000. A 4-unit floor gives distinct prices.",
  wide: "The data already spans about 8 units. A 4-unit floor leaves this fit unchanged.",
  zero: "nonNegative: try 0.3 units. The range is 0.000–0.300, preserving the floor.",
  ceiling: "maxValue = 1: try 0.3 units. The range shifts to 0.700–1.000.",
  both: "nonNegative + maxValue = 1: a 4-unit floor cannot fit. Hard bounds win: 0.000–1.000.",
};

function formatFraction(value: number) {
  "worklet";
  return value.toFixed(2);
}

function formatPrice(value: number) {
  "worklet";
  return `$${formatWholeValue(value)}`;
}

function RangeReadout({ scale }: ChartOverlayContext) {
  const animatedProps = useAnimatedProps(() => {
    const { min, max } = scale.get();
    const text = `Y span: ${(max - min).toFixed(3)} · ${min.toFixed(3)} → ${max.toFixed(3)}`;
    return { text, defaultValue: text };
  });
  return (
    <AnimatedTextInput
      editable={false}
      accessibilityLabel="Visible Y range"
      underlineColorAndroid="transparent"
      style={styles.readout}
      animatedProps={animatedProps}
    />
  );
}

export default function MinimumRangeScreen() {
  const [panel, setPanel] = useState<"compare" | "options">("compare");
  const [mode, setMode] = useState<Mode>("line");
  const [floor, setFloor] = useState<Floor>("off");
  const [scenario, setScenario] = useState<RangeScenario>("price");
  const [isStatic, setStatic] = useState(false);
  const [zoom, setZoom] = useState(1);
  const yRangeScale = useSharedValue(1);
  const feed = useMinimumRangeData(scenario);
  const bounds = RANGE_SCENARIOS[scenario];
  const minRange = floor === "off" ? undefined : Number(floor);
  const setScale = (next: number) => {
    yRangeScale.set(next);
    setZoom(next);
  };
  const reset = () => {
    setMode("line");
    setFloor("off");
    setScenario("price");
    setStatic(false);
    setScale(1);
    setPanel("compare");
  };
  const common = {
    theme: APP_THEME,
    accentColor: ACCENT,
    timeWindow: 180,
    nowOverride: feed.time,
    smoothing: 0.3,
    yAxis: { count: 5 },
    insets: { top: 32, right: 92 },
    formatValue:
      scenario === "price" || scenario === "wide"
        ? formatPrice
        : formatFraction,
    nonNegative: bounds.nonNegative,
    maxValue: bounds.maxValue,
    minRange,
    yRangeScale,
    snapKey: `${scenario}:${mode}`,
    renderOverlay: (ctx: ChartOverlayContext) => <RangeReadout {...ctx} />,
    pulse: false,
    scrub: false,
  };

  return (
    <DemoScreen
      title="Minimum Y range"
      description="Compare a $0.30 window with a 4-unit minimum. Keep rounded price labels distinct, then inspect zero and ceiling bounds."
      docs="guides/minimum-range"
      chart={
        <View style={styles.chart}>
          {mode === "series" ? (
            <LiveChartSeries {...common} series={feed.series} legend={false} />
          ) : (
            <LiveChart
              {...common}
              data={feed.data}
              value={feed.value}
              mode={mode}
              candles={mode === "candle" ? feed.candles : undefined}
              liveCandle={mode === "candle" ? feed.liveCandle : undefined}
              candleWidth={3}
              static={isStatic}
            />
          )}
        </View>
      }
    >
      <ChipRow options={PANELS} value={panel} onChange={setPanel} />
      {panel === "compare" ? (
        <>
          <ChipRow
            label="Minimum fitted span"
            options={FLOORS}
            value={floor}
            onChange={setFloor}
          />
          <ChipRow
            label="Chart"
            options={MODES}
            value={mode}
            onChange={setMode}
          />
          <ChipRow
            label="Data and bounds"
            options={SCENARIOS}
            value={scenario}
            onChange={setScenario}
          />
          <Text style={styles.hint}>{HINTS[scenario]}</Text>
        </>
      ) : (
        <>
          <ControlRow label="Single-series playback">
            <ToggleChip
              label="Static chart"
              value={isStatic}
              onChange={setStatic}
            />
          </ControlRow>
          <Text style={styles.hint}>
            Static applies to line/candle charts. Change the floor in Compare:
            the range re-settles without replacing the data.
          </Text>
          <ControlRow label="Manual zoom applies after the floor">
            <Chip
              label="Zoom 0.5×"
              active={zoom === 0.5}
              onPress={() => setScale(0.5)}
            />
            <Chip
              label="Zoom 1×"
              active={zoom === 1}
              onPress={() => setScale(1)}
            />
            <Chip
              label="Zoom 2×"
              active={zoom === 2}
              onPress={() => setScale(2)}
            />
          </ControlRow>
          <Text style={styles.hint}>
            A 4-unit floor at 0.5× becomes a 2-unit span. The floor controls
            auto-fit; manual zoom can go below it. History and the clock are
            fixed for a repeatable comparison.
          </Text>
          <ControlRow>
            <Chip label="Reset demo" active={false} onPress={reset} />
          </ControlRow>
        </>
      )}
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  chart: { flex: 1 },
  readout: {
    position: "absolute",
    top: 0,
    left: 4,
    right: 4,
    height: 24,
    padding: 0,
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "JetBrainsMono_400Regular",
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: APP_FONT_FAMILY,
    marginVertical: 8,
  },
});
