import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import type { VolatilityMode } from "../sim/generators";
import { useSimulatedData, type TradeSource } from "../sim/useSimulatedData";
import { Liveline } from "../src";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const VOLATILITY_MODES: VolatilityMode[] = [
  "calm",
  "normal",
  "volatile",
  "chaotic",
];

const TRADE_SOURCES: TradeSource[] = ["orderbook", "bonding-curve"];

const PRICE_RANGES: { label: string; value: number }[] = [
  { label: "0.001", value: 0.001 },
  { label: "0.5", value: 0.5 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "1K", value: 1_000 },
  { label: "10K", value: 10_000 },
  { label: "67.5K", value: 67_500 },
  { label: "100K", value: 100_000 },
  { label: "1M", value: 1_000_000 },
  { label: "10M", value: 10_000_000 },
  { label: "100M", value: 100_000_000 },
];

export default function Index() {
  const [volatilityMode, setVolatilityMode] =
    useState<VolatilityMode>("normal");
  const [tradeSource, setTradeSource] = useState<TradeSource>("orderbook");
  const [paused, setPaused] = useState(false);
  const [startValue, setStartValue] = useState(100);

  const { data, value } = useSimulatedData({
    volatilityMode,
    tradeSource,
    paused,
    startValue,
  });

  const subtitleProps = useAnimatedProps(() => ({
    text: `${value.value.toFixed(6)} · ${volatilityMode}`,
    defaultValue: `${value.value.toFixed(6)} · ${volatilityMode}`,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>react-native-liveline</Text>
        <AnimatedTextInput
          editable={false}
          underlineColorAndroid="transparent"
          style={styles.subtitle}
          animatedProps={subtitleProps}
        />
      </View>

      <View style={styles.chartContainer}>
        <Liveline data={data} value={value} color="#3b82f6" theme="dark" />
      </View>

      <ScrollView
        style={styles.controlsScroll}
        contentContainerStyle={styles.controls}
      >
        <Text style={styles.sectionLabel}>Price Range</Text>
        <View style={styles.buttonRow}>
          {PRICE_RANGES.map((r) => (
            <Pressable
              key={r.label}
              style={[styles.chip, startValue === r.value && styles.chipActive]}
              onPress={() => setStartValue(r.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  startValue === r.value && styles.chipTextActive,
                ]}
              >
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Volatility</Text>
        <View style={styles.buttonRow}>
          {VOLATILITY_MODES.map((mode) => (
            <Pressable
              key={mode}
              style={[
                styles.chip,
                volatilityMode === mode && styles.chipActive,
              ]}
              onPress={() => setVolatilityMode(mode)}
            >
              <Text
                style={[
                  styles.chipText,
                  volatilityMode === mode && styles.chipTextActive,
                ]}
              >
                {mode}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Trade Source</Text>
        <View style={styles.buttonRow}>
          {TRADE_SOURCES.map((source) => (
            <Pressable
              key={source}
              style={[styles.chip, tradeSource === source && styles.chipActive]}
              onPress={() => setTradeSource(source)}
            >
              <Text
                style={[
                  styles.chipText,
                  tradeSource === source && styles.chipTextActive,
                ]}
              >
                {source}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.chip, paused && styles.chipActive]}
          onPress={() => setPaused((p) => !p)}
        >
          <Text style={[styles.chipText, paused && styles.chipTextActive]}>
            {paused ? "Resume" : "Pause"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgb(10, 10, 10)",
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontFamily: "monospace",
    marginTop: 4,
    padding: 0,
  },
  chartContainer: {
    height: 300,
    marginHorizontal: 12,
  },
  controlsScroll: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chipActive: {
    backgroundColor: "#3b82f6",
  },
  chipText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontFamily: "monospace",
  },
  chipTextActive: {
    color: "#fff",
  },
});
