import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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

export default function Index() {
  const [volatilityMode, setVolatilityMode] =
    useState<VolatilityMode>("normal");
  const [tradeSource, setTradeSource] = useState<TradeSource>("orderbook");
  const [paused, setPaused] = useState(false);

  const { data, value } = useSimulatedData({
    volatilityMode,
    tradeSource,
    paused,
  });

  const subtitleProps = useAnimatedProps(() => ({
    text: `${value.value.toFixed(2)} · ${volatilityMode} · ${tradeSource}`,
    defaultValue: `${value.value.toFixed(2)} · ${volatilityMode} · ${tradeSource}`,
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

      <View style={styles.controls}>
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
      </View>
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
  controls: {
    paddingHorizontal: 20,
    paddingTop: 20,
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
