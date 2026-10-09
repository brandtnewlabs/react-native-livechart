import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  LiveChart,
  type CandlePoint,
  type ChartOverlayContext,
} from "react-native-livechart";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { Chip, ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { APP_FONT_FAMILY, APP_FONT_FAMILY_SEMIBOLD } from "../../demo-lib/fonts";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import {
  FEEDBACK_CANDLE_WIDTH,
  FEEDBACK_WINDOW,
  useCandleFeedbackData,
} from "../../demo-lib/useCandleFeedbackData";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const PANELS = [
  { value: "feedback", label: "Feedback" },
  { value: "options", label: "Options" },
] as const;
const MODES = [
  { value: "candle", label: "Candles" },
  { value: "line", label: "Line" },
] as const;
const EMPTY = {
  entries: 0,
  exits: 0,
  selected: null as CandlePoint | null,
  events: [] as { id: number; label: string }[],
};

function clock(time: number) {
  const date = new Date(time * 1000);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function LiveUpdates({ updates }: { updates: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    const text = `Forming candle updates: ${updates.get()}`;
    return { text, defaultValue: text };
  });
  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      style={styles.feed}
      animatedProps={animatedProps}
    />
  );
}

function Count({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.count}>
      <Text style={styles.number}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function ScrubGuide({ scale, timeToX, time }: ChartOverlayContext & { time: number }) {
  const startStyle = useAnimatedStyle(() => ({
    left: timeToX(time - 315, scale.get()) - 14,
  }));
  const endStyle = useAnimatedStyle(() => ({
    left: timeToX(time - 10, scale.get()) - 14,
  }));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.Text
        accessibilityLabel="Start scrub"
        style={[styles.scrubGuide, startStyle]}
      >
        Drag
      </Animated.Text>
      <Animated.Text
        accessibilityLabel="Hold forming candle"
        style={[styles.scrubGuide, endStyle]}
      >
        Hold
      </Animated.Text>
    </View>
  );
}

export default function CandleFeedbackScreen() {
  const [panel, setPanel] = useState<"feedback" | "options">("feedback");
  const [mode, setMode] = useState<"candle" | "line">("candle");
  const [snap, setSnap] = useState(true);
  const [gap, setGap] = useState(true);
  const [paused, setPaused] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [compare, setCompare] = useState(false);
  const [stats, setStats] = useState(EMPTY);
  const [frames, setFrames] = useState(0);
  const frameCalls = useRef(0);
  const feed = useCandleFeedbackData(gap, paused);

  // The optional per-frame callback is counted on JS and displayed at 5 Hz.
  // Omitted by default: the normal demo only bridges candle entry/exit events.
  useEffect(() => {
    if (!compare) return;
    const timer = setInterval(() => setFrames(frameCalls.current), 200);
    return () => clearInterval(timer);
  }, [compare]);

  const onCandleChange = (candle: CandlePoint | null) => {
    setStats((previous) => ({
      entries: previous.entries + (candle ? 1 : 0),
      exits: previous.exits + (candle ? 0 : 1),
      selected: candle,
      events: [
        {
          id: previous.entries + previous.exits + 1,
          label: candle
            ? `Enter ${clock(candle.time)} · close ${candle.close.toFixed(2)}`
            : "Exit / gap → null",
        },
        ...previous.events,
      ].slice(0, 3),
    }));
    if (candle && haptics) void Haptics.selectionAsync();
  };
  const reset = () => {
    setStats(EMPTY);
    frameCalls.current = 0;
    setFrames(0);
  };

  return (
    <DemoScreen
      title="Candle feedback"
      description="One callback per candle entered. Scrub across the gap, revisit a candle, then hold on the forming candle while it keeps ticking."
      docs="guides/candle-feedback"
      chart={
        <View style={styles.chartWrap}>
          <LiveUpdates updates={feed.updates} />
          <View style={styles.chart}>
            <LiveChart
              data={feed.data}
              value={feed.value}
              candles={feed.candles}
              liveCandle={feed.liveCandle}
              mode={mode}
              candleWidth={FEEDBACK_CANDLE_WIDTH}
              timeWindow={FEEDBACK_WINDOW}
              nowOverride={feed.time}
              candleGaps={gap ? [feed.gap] : undefined}
              lineGaps={gap ? [feed.gap] : undefined}
              accentColor={ACCENT}
              theme={APP_THEME}
              renderOverlay={(ctx) => <ScrubGuide {...ctx} time={feed.time} />}
              scrub={{ snapToCandles: snap }}
              onScrubCandleChange={enabled ? onCandleChange : undefined}
              onScrub={compare ? (point) => {
                if (point) frameCalls.current++;
              } : undefined}
              pulse={false}
            />
          </View>
        </View>
      }
    >
      <ChipRow options={PANELS} value={panel} onChange={setPanel} />
      {panel === "feedback" ? (
        <>
          <View style={styles.counts}>
            <Count label="Candle entries" value={stats.entries} />
            <Count label="Exits / gaps" value={stats.exits} />
            <Count label="onScrub updates" value={compare ? frames : "Off"} />
          </View>
          <Text style={styles.selection}>
            {stats.selected
              ? `Selected bucket: ${clock(stats.selected.time)}`
              : "No candle selected"}
          </Text>
          <ControlRow>
            <ToggleChip label="Compare onScrub" value={compare} onChange={setCompare} />
            <Chip label="Reset counts" active={false} onPress={reset} />
          </ControlRow>
          <Text style={styles.hint}>The tooltip stays live; the callback gives an entry snapshot.</Text>
          {stats.events.map((event) => (
            <Text key={event.id} style={styles.event}>
              {event.label}
            </Text>
          ))}
        </>
      ) : (
        <>
          <ChipRow label="Chart" options={MODES} value={mode} onChange={setMode} />
          <ControlRow label="Scrub">
            <ToggleChip label="Snap to candles" value={snap} onChange={setSnap} />
            <ToggleChip label="Gap" value={gap} onChange={setGap} />
            <ToggleChip label="Pause feed" value={paused} onChange={setPaused} />
          </ControlRow>
          <ControlRow label="Feedback">
            <ToggleChip
              label="Callback"
              value={enabled}
              onChange={(next) => {
                setEnabled(next);
                reset();
              }}
            />
            <ToggleChip label="Haptics" value={haptics} onChange={setHaptics} />
          </ControlRow>
          <Text style={styles.hint}>
            Haptics fire on candle entry. Line mode and a disabled callback stay quiet.
            The clock is fixed for repeatable holds; the forming candle updates on the UI thread.
          </Text>
        </>
      )}
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  chartWrap: { flex: 1 },
  chart: { flex: 1 },
  feed: {
    height: 24,
    padding: 0,
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: "JetBrainsMono_400Regular",
  },
  counts: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 14 },
  count: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.chipBackground,
  },
  number: {
    fontSize: 25,
    color: colors.text,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
  },
  label: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: APP_FONT_FAMILY,
    marginTop: 3,
  },
  selection: {
    fontSize: 14,
    color: colors.text,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    marginBottom: 14,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    fontFamily: APP_FONT_FAMILY,
    marginVertical: 8,
  },
  event: {
    fontSize: 12,
    lineHeight: 20,
    color: colors.textMuted,
    fontFamily: "JetBrainsMono_400Regular",
  },
  scrubGuide: {
    position: "absolute",
    top: 40,
    width: 28,
    lineHeight: 18,
    textAlign: "center",
    fontSize: 10,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    color: ACCENT,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 4,
  },
});
