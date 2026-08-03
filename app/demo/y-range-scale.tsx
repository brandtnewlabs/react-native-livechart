import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LiveChart } from "react-native-livechart";

import { Chip, ChipRow, ControlRow } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Y-range scale" };

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Mode = "line" | "candle";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "candle", label: "Candles" },
];

const SCALE_MIN = 0.25;
const SCALE_MAX = 4;
const SCALE_DRAG_DISTANCE = 160;
const RESET_DURATION_MS = 240;

export default function YRangeScaleScreen() {
  const [mode, setMode] = useState<Mode>("line");
  const yRangeScale = useSharedValue(1);
  const dragStartScale = useSharedValue(1);
  const dragStartY = useSharedValue(0);
  const dragActive = useSharedValue(false);
  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
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

  // Manual activation keeps the narrow gutter deterministic even though the
  // LiveChart below owns its own gesture graph. A stationary touch fails this
  // recognizer so the double-tap reset can still win the race.
  const axisPan = Gesture.Manual()
    .onTouchesDown((event, manager) => {
      "worklet";
      const touch = event.allTouches[0];
      if (event.numberOfTouches !== 1 || !touch) {
        manager.fail();
        return;
      }
      cancelAnimation(yRangeScale);
      dragStartScale.set(yRangeScale.get());
      dragStartY.set(touch.y);
      dragActive.set(false);
      manager.begin();
    })
    .onTouchesMove((event, manager) => {
      "worklet";
      const touch = event.allTouches[0];
      if (!touch) return;
      const translationY = touch.y - dragStartY.get();
      if (!dragActive.get()) {
        if (Math.abs(translationY) <= 1) return;
        dragActive.set(true);
        manager.activate();
      }
      const requested =
        dragStartScale.get() * Math.exp(translationY / SCALE_DRAG_DISTANCE);
      yRangeScale.set(Math.max(SCALE_MIN, Math.min(SCALE_MAX, requested)));
    })
    .onTouchesUp((_event, manager) => {
      "worklet";
      if (dragActive.get()) manager.end();
      else manager.fail();
    })
    .onTouchesCancelled((_event, manager) => {
      "worklet";
      manager.fail();
    });

  const axisDoubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(16)
    .onEnd((_event, success) => {
      "worklet";
      if (success) {
        cancelAnimation(yRangeScale);
        yRangeScale.set(withTiming(1, { duration: RESET_DURATION_MS }));
      }
    });

  // Movement activates the pan; a stationary two-tap sequence activates reset.
  // Race prevents the losing recognizer from holding the winning one open.
  const axisGesture = Gesture.Race(axisPan, axisDoubleTap);
  const isCandle = mode === "candle";
  const scaleReadoutProps = useAnimatedProps(() => {
    const text = `${yRangeScale.get().toFixed(2)}×`;
    return { text, defaultValue: text };
  });

  return (
    <DemoScreen
      title="Y-range scale"
      docs="guides/y-range-scale"
      description="Drag the right price-axis gutter vertically to stretch or compress the fitted Y-range. Double-tap the gutter to reset to auto-fit."
      chart={
        <View style={styles.chart}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <LiveChart
              style={styles.chart}
              data={data}
              value={value}
              mode={mode}
              candles={isCandle ? candles : undefined}
              liveCandle={isCandle ? liveCandle : undefined}
              candleWidth={3}
              accentColor={ACCENT}
              theme={APP_THEME}
              timeWindow={60}
              yAxis
              yRangeScale={yRangeScale}
              scrub={false}
            />
          </View>
          <GestureDetector gesture={axisGesture}>
            <Animated.View
              accessible
              collapsable={false}
              accessibilityRole="adjustable"
              accessibilityLabel="Price scale: drag vertically, double tap to reset"
              style={styles.axisGestureTarget}
            >
              <Text style={styles.axisHint}>↕</Text>
            </Animated.View>
          </GestureDetector>
        </View>
      }
    >
      <ChipRow
        label="Chart type"
        options={MODE_OPTIONS}
        value={mode}
        onChange={setMode}
      />
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
        <Chip label="Auto 1×" active={false} onPress={() => animateToScale(1)} />
        <Chip label="2×" active={false} onPress={() => animateToScale(2)} />
      </ControlRow>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  chart: {
    flex: 1,
  },
  axisGestureTarget: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 24,
    width: 72,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 3,
  },
  axisHint: {
    color: colors.textFaint,
    fontSize: 12,
  },
  scaleReadout: {
    color: colors.text,
    fontSize: 18,
    fontVariant: ["tabular-nums"],
    padding: 0,
  },
});
