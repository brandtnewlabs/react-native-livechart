import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  formatTime,
  LiveChart,
  MONO_FONT_FAMILY,
  type CandlePoint,
  type LiveChartPoint,
  type ScrubPoint,
} from "react-native-livechart";
import Animated, {
  useAnimatedProps,
  useSharedValue,
} from "react-native-reanimated";
import type { VolatilityMode } from "../../sim/generators";
import {
  useSimulatedChartData,
  type HistoryRange,
  type TradeSource,
} from "../../sim/useSimulatedChartData";
import {
  AnimatedTrendTextInput,
  type NumberFormatConfig,
} from "./lib/AnimatedTrendTextInput";
import {
  HISTORY_RANGE_PRESETS,
  PRICE_RANGES,
  TIME_WINDOWS,
  TRADE_SOURCES,
  viewportSecsForHistoryPreset,
  VOLATILITY_MODES,
} from "./lib/shared";

export const options = { title: "Playground" };

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const PLAYGROUND_HEADER_NUMBER_FORMAT: NumberFormatConfig = {
  locales: "en-US",
  options: {
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
};

export default function PlaygroundScreen() {
  const [volatilityMode, setVolatilityMode] =
    useState<VolatilityMode>("normal");
  const [tradeSource, setTradeSource] = useState<TradeSource>("orderbook");
  const [paused, setPaused] = useState(false);
  const [windowSecs, setWindowSecs] = useState(30);
  const [historyRange, setHistoryRange] = useState<HistoryRange>("1d");
  const [tradesPerSecond, setTradesPerSecond] = useState(5);
  const [tradeArrivalJitter, setTradeArrivalJitter] = useState(0);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [startValue, setStartValue] = useState(100);
  const [loading, setLoading] = useState(false);
  const [forceEmpty, setForceEmpty] = useState(false);
  const [showRefLine, setShowRefLine] = useState(false);
  const [valueLine, setValueLine] = useState(false);
  const [exaggerate, setExaggerate] = useState(false);
  const [degen, setDegen] = useState(true);
  const [simTradeStream, setSimTradeStream] = useState(true);

  const [displayMode, setDisplayMode] = useState<"line" | "candle">("line");
  const [headerReadoutIntl, setHeaderReadoutIntl] = useState(true);

  const candleWidthSecs = Math.max(5, Math.round(windowSecs / 20));

  const { data, value, candles, liveCandle, tradeStream } =
    useSimulatedChartData({
      volatilityMode,
      tradeSource,
      paused,
      startValue,
      candleWidth: candleWidthSecs,
      multiSeries: false,
      candleAggregation: displayMode === "candle",
      tradeStream: simTradeStream,
      historyRange,
      tradesPerSecond,
      tradeArrivalJitter,
      tokenSymbol: tokenSymbol.trim() || undefined,
    });
  const volatilitySv = useSharedValue(volatilityMode);
  useEffect(() => {
    volatilitySv.set(volatilityMode);
  }, [volatilityMode, volatilitySv]);

  const scrubPoint = useSharedValue<ScrubPoint | null>(null);

  const emptyLineData = useSharedValue<LiveChartPoint[]>([]);
  const emptyLineValue = useSharedValue(0);
  const emptyCandles = useSharedValue<CandlePoint[]>([]);
  const nullLiveCandle = useSharedValue<CandlePoint | null>(null);

  const metaProps = useAnimatedProps(() => {
    const sp = scrubPoint.get();
    if (sp !== null) {
      const text = `${formatTime(sp.time)} · scrub`;
      return { text, defaultValue: text };
    }
    const text = String(volatilitySv.get());
    return { text, defaultValue: text };
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>react-native-livechart</Text>
        <Text style={styles.hint}>
          Chart reveals after ≥2 points (or ≥2 candles) and loading off — use
          Empty + Reload to preview.
        </Text>
        <AnimatedTrendTextInput
          sharedValue={value}
          maximumFractionDigits={headerReadoutIntl ? 2 : 6}
          {...(headerReadoutIntl
            ? { numberFormat: PLAYGROUND_HEADER_NUMBER_FORMAT }
            : {})}
          style={styles.subtitle}
        />
        <AnimatedTextInput
          editable={false}
          underlineColorAndroid="transparent"
          style={styles.subtitleMeta}
          animatedProps={metaProps}
        />
      </View>

      <View style={styles.chartContainer}>
        <LiveChart
          data={forceEmpty ? emptyLineData : data}
          value={forceEmpty ? emptyLineValue : value}
          mode={displayMode}
          candles={
            displayMode === "candle" && forceEmpty ? emptyCandles : candles
          }
          liveCandle={
            displayMode === "candle" && forceEmpty ? nullLiveCandle : liveCandle
          }
          candleWidth={candleWidthSecs}
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
            scrubPoint.set(point);
          }}
          tradeStream={simTradeStream ? tradeStream : undefined}
          degen={degen ? true : undefined}
        />
      </View>

      <ScrollView
        style={styles.controlsScroll}
        contentContainerStyle={styles.controls}
      >
        <Text style={styles.sectionLabel}>
          Header readout (AnimatedTrendTextInput)
        </Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.chip, !headerReadoutIntl && styles.chipActive]}
            onPress={() => setHeaderReadoutIntl(false)}
          >
            <Text
              style={[
                styles.chipText,
                !headerReadoutIntl && styles.chipTextActive,
              ]}
            >
              Plain toFixed
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, headerReadoutIntl && styles.chipActive]}
            onPress={() => setHeaderReadoutIntl(true)}
          >
            <Text
              style={[
                styles.chipText,
                headerReadoutIntl && styles.chipTextActive,
              ]}
            >
              Intl en-US (grouping)
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.controlsHint]}>
          Use Price Range ≥ 1K to see thousand separators with Intl on.
        </Text>

        <Text style={styles.sectionLabel}>Display Mode</Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.chip, displayMode === "line" && styles.chipActive]}
            onPress={() => setDisplayMode("line")}
          >
            <Text
              style={[
                styles.chipText,
                displayMode === "line" && styles.chipTextActive,
              ]}
            >
              Line
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, displayMode === "candle" && styles.chipActive]}
            onPress={() => setDisplayMode("candle")}
          >
            <Text
              style={[
                styles.chipText,
                displayMode === "candle" && styles.chipTextActive,
              ]}
            >
              Candle
            </Text>
          </Pressable>
        </View>

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

        <Text style={styles.sectionLabel}>History span (seed)</Text>
        <View style={styles.buttonRow}>
          {HISTORY_RANGE_PRESETS.map((r) => (
            <Pressable
              key={r.preset}
              style={[
                styles.chip,
                historyRange === r.preset && styles.chipActive,
              ]}
              onPress={() => {
                setHistoryRange(r.preset);
                setWindowSecs(viewportSecsForHistoryPreset(r.preset));
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  historyRange === r.preset && styles.chipTextActive,
                ]}
              >
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Trades / sec (live)</Text>
        <View style={styles.buttonRow}>
          {[1, 5, 10, 20].map((n) => (
            <Pressable
              key={n}
              style={[styles.chip, tradesPerSecond === n && styles.chipActive]}
              onPress={() => setTradesPerSecond(n)}
            >
              <Text
                style={[
                  styles.chipText,
                  tradesPerSecond === n && styles.chipTextActive,
                ]}
              >
                {n}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Trade arrival jitter</Text>
        <View style={styles.buttonRow}>
          {[
            { label: "0", v: 0 },
            { label: "0.25", v: 0.25 },
            { label: "0.5", v: 0.5 },
          ].map(({ label, v }) => (
            <Pressable
              key={label}
              style={[
                styles.chip,
                tradeArrivalJitter === v && styles.chipActive,
              ]}
              onPress={() => setTradeArrivalJitter(v)}
            >
              <Text
                style={[
                  styles.chipText,
                  tradeArrivalJitter === v && styles.chipTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Token symbol (tape)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. PEPE"
          placeholderTextColor="#64748b"
          value={tokenSymbol}
          onChangeText={setTokenSymbol}
        />

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
            style={styles.chip}
            onPress={() => {
              setDegen(true);
              setExaggerate(true);
              setVolatilityMode("chaotic");
            }}
          >
            <Text style={styles.chipText}>Degen demo</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, simTradeStream && styles.chipActive]}
            onPress={() => setSimTradeStream((v) => !v)}
          >
            <Text
              style={[styles.chipText, simTradeStream && styles.chipTextActive]}
            >
              Trade stream
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, degen && styles.chipActive]}
            onPress={() => setDegen((v) => !v)}
          >
            <Text style={[styles.chipText, degen && styles.chipTextActive]}>
              Degen
            </Text>
          </Pressable>
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

          <Pressable
            style={[styles.chip, forceEmpty && styles.chipActive]}
            onPress={() => setForceEmpty((v) => !v)}
          >
            <Text
              style={[styles.chipText, forceEmpty && styles.chipTextActive]}
            >
              Empty data
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
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: MONO_FONT_FAMILY,
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontFamily: MONO_FONT_FAMILY,
    marginTop: 4,
    padding: 0,
  },
  subtitleMeta: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    fontFamily: MONO_FONT_FAMILY,
    marginTop: 2,
    padding: 0,
  },
  hint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontFamily: MONO_FONT_FAMILY,
    marginTop: 6,
    lineHeight: 15,
  },
  controlsHint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontFamily: MONO_FONT_FAMILY,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 15,
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
    fontFamily: MONO_FONT_FAMILY,
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
    fontFamily: MONO_FONT_FAMILY,
  },
  chipTextActive: {
    color: "#fff",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontFamily: MONO_FONT_FAMILY,
    fontSize: 14,
    marginBottom: 8,
  },
});
