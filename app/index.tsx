import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
} from "react-native-reanimated";
import type { VolatilityMode } from "../sim/generators";
import { useSimulatedData, type TradeSource } from "../sim/useSimulatedData";
import type { ScrubPoint } from "../src";
import { Liveline } from "../src";
import { formatTime } from "../src/format";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const TIME_WINDOWS: { label: string; secs: number }[] = [
  { label: "30s", secs: 30 },
  { label: "1m", secs: 60 },
  { label: "5m", secs: 300 },
  { label: "1h", secs: 3_600 },
  { label: "24h", secs: 86_400 },
];

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
  const [windowSecs, setWindowSecs] = useState(30);
  const [startValue, setStartValue] = useState(100);
  const [loading, setLoading] = useState(false);
  const [showRefLine, setShowRefLine] = useState(false);
  const [valueLine, setValueLine] = useState(false);
  const [exaggerate, setExaggerate] = useState(false);

  const { data, value } = useSimulatedData({
    volatilityMode,
    tradeSource,
    paused,
    startValue,
  });

  // Shared value updated by onScrub on the JS thread; null = live mode
  const scrubPoint = useSharedValue<ScrubPoint | null>(null);

  const subtitleProps = useAnimatedProps(() => {
    const sp = scrubPoint.value;
    if (sp !== null) {
      // Scrub mode: show the historical price and its local timestamp
      const text = `${sp.value.toFixed(6)} · ${formatTime(sp.time)}`;
      return { text, defaultValue: text };
    }
    // Live mode: show current value and volatility label
    const text = `${value.value.toFixed(6)} · ${volatilityMode}`;
    return { text, defaultValue: text };
  });

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
        <Liveline
          data={data}
          value={value}
          accentColor="#3b82f6"
          theme="dark"
          timeWindow={windowSecs}
          paused={paused}
          exaggerate={exaggerate}
          valueLine={valueLine}
          referenceLine={
            showRefLine ? { value: startValue * 1.05, label: "+5%" } : undefined
          }
          scrub={{ tooltip: true }}
          loading={loading}
          onScrub={(point) => {
            scrubPoint.value = point;
          }}
        />
      </View>

      <ScrollView
        style={styles.controlsScroll}
        contentContainerStyle={styles.controls}
      >
        <Text style={styles.sectionLabel}>Time Window</Text>
        <View style={styles.buttonRow}>
          {TIME_WINDOWS.map((w) => (
            <Pressable
              key={w.label}
              style={[styles.chip, windowSecs === w.secs && styles.chipActive]}
              onPress={() => setWindowSecs(w.secs)}
            >
              <Text
                style={[
                  styles.chipText,
                  windowSecs === w.secs && styles.chipTextActive,
                ]}
              >
                {w.label}
              </Text>
            </Pressable>
          ))}
        </View>

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

        <Text style={styles.sectionLabel}>Chart Options</Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.chip, valueLine && styles.chipActive]}
            onPress={() => setValueLine((v) => !v)}
          >
            <Text style={[styles.chipText, valueLine && styles.chipTextActive]}>
              Value Line
            </Text>
          </Pressable>

          <Pressable
            style={[styles.chip, showRefLine && styles.chipActive]}
            onPress={() => setShowRefLine((v) => !v)}
          >
            <Text
              style={[styles.chipText, showRefLine && styles.chipTextActive]}
            >
              Ref Line
            </Text>
          </Pressable>

          <Pressable
            style={[styles.chip, exaggerate && styles.chipActive]}
            onPress={() => setExaggerate((v) => !v)}
          >
            <Text
              style={[styles.chipText, exaggerate && styles.chipTextActive]}
            >
              Exaggerate
            </Text>
          </Pressable>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.chip, paused && styles.chipActive]}
            onPress={() => setPaused((p) => !p)}
          >
            <Text style={[styles.chipText, paused && styles.chipTextActive]}>
              {paused ? "Resume" : "Pause"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.chip, loading && styles.chipActive]}
            onPress={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 2000);
            }}
            disabled={loading}
          >
            <Text style={[styles.chipText, loading && styles.chipTextActive]}>
              {loading ? "Loading…" : "Reload"}
            </Text>
          </Pressable>
        </View>
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
