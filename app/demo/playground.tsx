import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import {
  formatTime,
  LiveChart,
  type CandlePoint,
  type LiveChartPoint,
  type ScrubPoint,
} from "react-native-livechart";
import Animated, {
  useAnimatedProps,
  useSharedValue,
} from "react-native-reanimated";

import { AnimatedTrendTextInput } from "../../demo-lib/AnimatedTrendTextInput";
import { Chip, ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { APP_FONT_FAMILY } from "../../demo-lib/fonts";
import {
  ACCENT,
  HISTORY_RANGE_PRESETS,
  PRICE_RANGES,
  TIME_WINDOWS,
  viewportSecsForHistoryPreset,
  VOLATILITY_MODES,
} from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import type { VolatilityMode } from "../../sim/generators";
import {
  useSimulatedChartData,
  type HistoryRange,
} from "../../sim/useSimulatedChartData";

export const options = { title: "Playground" };

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// Built once at module scope so it isn't reconstructed per render (js-hoist-intl).
const PLAYGROUND_HEADER_FORMATTER = new Intl.NumberFormat("en-US", {
  useGrouping: true,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const READOUT_OPTIONS: { value: boolean; label: string }[] = [
  { value: false, label: "Plain toFixed" },
  { value: true, label: "Intl en-US (grouping)" },
];

const MODE_OPTIONS: { value: "line" | "candle"; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "candle", label: "Candle" },
];

const WINDOW_OPTIONS = TIME_WINDOWS.map((w) => ({
  value: w.secs,
  label: w.label,
}));

const HISTORY_OPTIONS = HISTORY_RANGE_PRESETS.map((r) => ({
  value: r.preset,
  label: r.label,
}));

const TRADES_PER_SECOND_OPTIONS = [1, 5, 10, 20].map((n) => ({
  value: n,
  label: String(n),
}));

const JITTER_OPTIONS = [
  { value: 0, label: "0" },
  { value: 0.25, label: "0.25" },
  { value: 0.5, label: "0.5" },
];

const PRICE_OPTIONS = PRICE_RANGES.map((r) => ({
  value: r.value,
  label: r.label,
}));

const VOLATILITY_OPTIONS = VOLATILITY_MODES.map((mode) => ({
  value: mode,
  label: mode,
}));

export default function PlaygroundScreen() {
  const [volatilityMode, setVolatilityMode] =
    useState<VolatilityMode>("normal");
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
    <DemoScreen
      docs="quickstart"
      description="Kitchen-sink showcase: line/candle, scrub, reference lines, trade stream, degen effects, loading + empty states."
      chart={
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
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={windowSecs}
          paused={paused}
          exaggerate={exaggerate}
          valueLine={valueLine}
          referenceLines={
            showRefLine
              ? [{ value: startValue * 1.05, label: "+5%" }]
              : undefined
          }
          scrub={{ tooltip: true }}
          loading={loading}
          onScrub={(point) => {
            scrubPoint.set(point);
          }}
          tradeStream={simTradeStream ? tradeStream : undefined}
          degen={degen ? true : undefined}
        />
      }
    >
      <AnimatedTrendTextInput
        sharedValue={forceEmpty ? emptyLineValue : value}
        {...(headerReadoutIntl
          ? { formatter: PLAYGROUND_HEADER_FORMATTER }
          : {})}
        style={styles.readout}
      />
      <AnimatedTextInput
        editable={false}
        underlineColorAndroid="transparent"
        style={styles.readoutMeta}
        animatedProps={metaProps}
      />

      <ChipRow
        label="Header readout (AnimatedTrendTextInput)"
        options={READOUT_OPTIONS}
        value={headerReadoutIntl}
        onChange={setHeaderReadoutIntl}
      />
      <Text style={styles.controlsHint}>
        Use Price Range ≥ 1K to see thousand separators with Intl on.
      </Text>

      <ChipRow
        label="Display mode"
        options={MODE_OPTIONS}
        value={displayMode}
        onChange={setDisplayMode}
      />

      <ChipRow
        label="Time window"
        options={WINDOW_OPTIONS}
        value={windowSecs}
        onChange={setWindowSecs}
      />

      <ChipRow
        label="History span (seed)"
        options={HISTORY_OPTIONS}
        value={historyRange}
        onChange={(preset) => {
          setHistoryRange(preset);
          setWindowSecs(viewportSecsForHistoryPreset(preset));
        }}
      />

      <ChipRow
        label="Trades / sec (live)"
        options={TRADES_PER_SECOND_OPTIONS}
        value={tradesPerSecond}
        onChange={setTradesPerSecond}
      />

      <ChipRow
        label="Trade arrival jitter"
        options={JITTER_OPTIONS}
        value={tradeArrivalJitter}
        onChange={setTradeArrivalJitter}
      />

      <Text style={styles.sectionLabel}>Token symbol (tape)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="e.g. PEPE"
        placeholderTextColor={colors.placeholder}
        value={tokenSymbol}
        onChangeText={setTokenSymbol}
      />

      <ChipRow
        label="Price range"
        options={PRICE_OPTIONS}
        value={startValue}
        onChange={setStartValue}
      />

      <ChipRow
        label="Volatility"
        options={VOLATILITY_OPTIONS}
        value={volatilityMode}
        onChange={setVolatilityMode}
      />

      <ControlRow label="Chart options">
        <Chip
          label="Degen demo"
          active={false}
          onPress={() => {
            setDegen(true);
            setExaggerate(true);
            setVolatilityMode("chaotic");
          }}
        />
        <ToggleChip
          label="Trade stream"
          value={simTradeStream}
          onChange={setSimTradeStream}
        />
        <ToggleChip label="Degen" value={degen} onChange={setDegen} />
        <ToggleChip label="Value Line" value={valueLine} onChange={setValueLine} />
        <ToggleChip label="Ref Line" value={showRefLine} onChange={setShowRefLine} />
        <ToggleChip
          label="Exaggerate"
          value={exaggerate}
          onChange={setExaggerate}
        />
      </ControlRow>

      <ControlRow label="State">
        <Chip
          label={paused ? "Resume" : "Pause"}
          active={paused}
          onPress={() => setPaused((p) => !p)}
        />
        <Chip
          label={loading ? "Loading…" : "Reload"}
          active={loading}
          disabled={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 2000);
          }}
        />
        <ToggleChip
          label="Empty data"
          value={forceEmpty}
          onChange={setForceEmpty}
        />
      </ControlRow>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  readout: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: APP_FONT_FAMILY,
    marginBottom: 2,
    padding: 0,
  },
  readoutMeta: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY,
    marginBottom: 4,
    padding: 0,
  },
  controlsHint: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: APP_FONT_FAMILY,
    marginTop: 4,
    marginBottom: 4,
    lineHeight: 15,
  },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: APP_FONT_FAMILY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 14,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: APP_FONT_FAMILY,
    fontSize: 14,
    marginBottom: 8,
  },
});
