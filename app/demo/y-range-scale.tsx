import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LiveChart, LiveChartSeries } from "react-native-livechart";

import { Chip, ChipRow, ControlRow } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Mode = "line" | "candle" | "series";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "candle", label: "Candles" },
  { value: "series", label: "Series" },
];

const ZERO_FLOOR_OPTIONS = [
  { value: false, label: "Off" },
  { value: true, label: "On" },
];

const RESET_DURATION_MS = 240;

export default function YRangeScaleScreen() {
  const [mode, setMode] = useState<Mode>("line");
  const [nonNegative, setNonNegative] = useState(false);
  const yRangeScale = useSharedValue(1);
  const [axis, setAxis] = useState<"right" | "left" | "float">("right");
  const [controlled, setControlled] = useState(true);
  const [scaleGesture, setScaleGesture] = useState(true);
  const [largeFont, setLargeFont] = useState(false);
  const [scroll, setScroll] = useState<"off" | "axisDrag" | "holdToScrub">(
    "axisDrag",
  );
  const { data, value, candles, liveCandle, series } = useSimulatedChartData({
    multiSeries: true,
    candleAggregation: true,
    tradeStream: false,
    candleWidth: 3,
    historySpanSeconds: 90,
    historyRange: "1m",
    volatilityMode: "volatile",
  });

  const animateToScale = (scale: number) => {
    cancelAnimation(yRangeScale);
    yRangeScale.set(withTiming(scale, { duration: RESET_DURATION_MS }));
  };

  const isCandle = mode === "candle";
  const isSeries = mode === "series";
  const scaleReadoutProps = useAnimatedProps(() => {
    const text = `${yRangeScale.get().toFixed(2)}×`;
    return { text, defaultValue: text };
  });

  const chartProps = {
    style: styles.chart,
    accentColor: ACCENT,
    theme: APP_THEME,
    timeWindow: 60,
    yAxis: {
      side: axis === "left" ? ("left" as const) : ("right" as const),
      float: axis === "float",
      scaleGesture,
    },
    insets: axis === "left" ? { left: 80 } : undefined,
    font: { fontSize: largeFont ? 18 : 11 },
    yRangeScale: controlled ? yRangeScale : undefined,
    nonNegative,
    timeScroll: scroll === "off" ? (false as const) : { gesture: scroll },
    zoom: true,
  };

  return (
    <DemoScreen
      title="Y-range scale"
      docs="guides/y-range-scale"
      description="Drag the price axis down to fit more range, up to zoom in. Double-tap it to reset. Scrub the plot, drag the time axis to scroll, or pinch to zoom time."
      chart={
        <View style={styles.chart}>
          {isSeries ? (
            <LiveChartSeries {...chartProps} series={series} legend={false} />
          ) : (
            <LiveChart
              {...chartProps}
              data={data}
              value={value}
              mode={mode}
              candles={isCandle ? candles : undefined}
              liveCandle={isCandle ? liveCandle : undefined}
              candleWidth={3}
              volume={isCandle}
            />
          )}
        </View>
      }
    >
      <ChipRow
        label="Chart type"
        options={MODE_OPTIONS}
        value={mode}
        onChange={setMode}
      />
      <ChipRow
        label="Zero floor (nonNegative)"
        options={ZERO_FLOOR_OPTIONS}
        value={nonNegative}
        onChange={setNonNegative}
      />
      <ChipRow
        label="Price axis"
        options={[
          { value: "right" as const, label: "Right" },
          { value: "left" as const, label: "Left" },
          { value: "float" as const, label: "Floating" },
        ]}
        value={axis}
        onChange={setAxis}
      />
      <ChipRow
        label="Time scroll"
        options={[
          { value: "axisDrag" as const, label: "Time axis" },
          { value: "holdToScrub" as const, label: "Drag plot" },
          { value: "off" as const, label: "Off" },
        ]}
        value={scroll}
        onChange={setScroll}
      />
      <ChipRow
        label="Axis scaling gesture"
        options={ZERO_FLOOR_OPTIONS}
        value={scaleGesture}
        onChange={setScaleGesture}
      />
      <ChipRow
        label="Large axis font"
        options={ZERO_FLOOR_OPTIONS}
        value={largeFont}
        onChange={setLargeFont}
      />
      <ChipRow
        label="Multiplier ownership"
        options={[
          { value: true, label: "SharedValue" },
          { value: false, label: "Internal" },
        ]}
        value={controlled}
        onChange={setControlled}
      />
      {controlled ? (
        <ScaleControls
          animateToScale={animateToScale}
          scaleReadoutProps={scaleReadoutProps}
        />
      ) : (
        <Text style={styles.hint}>
          The chart owns its scale. Double-tap the axis to return to auto-fit.
        </Text>
      )}
    </DemoScreen>
  );
}

function ScaleControls({
  animateToScale,
  scaleReadoutProps,
}: {
  animateToScale: (value: number) => void;
  scaleReadoutProps: Partial<{ text: string; defaultValue: string }>;
}) {
  return (
    <>
      <ControlRow label="Current multiplier">
        <AnimatedTextInput
          editable={false}
          underlineColorAndroid="transparent"
          accessibilityLabel="Current Y-range multiplier"
          style={styles.scaleReadout}
          animatedProps={scaleReadoutProps}
        />
      </ControlRow>
      <ControlRow label="Scale presets">
        <Chip label="0.5×" active={false} onPress={() => animateToScale(0.5)} />
        <Chip
          label="Auto 1×"
          active={false}
          onPress={() => animateToScale(1)}
        />
        <Chip label="2×" active={false} onPress={() => animateToScale(2)} />
        <Chip label="8×" active={false} onPress={() => animateToScale(8)} />
      </ControlRow>
    </>
  );
}

const styles = StyleSheet.create({
  chart: {
    flex: 1,
  },
  hint: { color: colors.textFaint },
  scaleReadout: {
    color: colors.text,
    fontSize: 18,
    fontVariant: ["tabular-nums"],
    padding: 0,
  },
});
