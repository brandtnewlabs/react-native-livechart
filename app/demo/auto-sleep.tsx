import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { LiveChart, type LiveChartFrameStats } from "react-native-livechart";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { APP_FONT_FAMILY, APP_FONT_FAMILY_SEMIBOLD } from "../../demo-lib/fonts";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export default function AutoSleepScreen() {
  const [paused, setPaused] = useState(false);
  const [autoSleep, setAutoSleep] = useState(true);
  const stats = useSharedValue<LiveChartFrameStats>({ frames: 0, published: 0, skipped: 0 });
  const { data, value } = useSimulatedChartData({
    paused,
    startValue: 100,
    volatilityMode: "volatile",
    tradesPerSecond: 12,
    historySpanSeconds: 30,
    maxPoints: 1200,
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
  });

  return (
    <DemoScreen
      title="Automatic sleep"
      docs="guides/auto-sleep"
      description="A live price feed. Pause it, let the chart settle, then resume."
      chartWrapperStyle={{ height: 300 }}
      chart={
        <LiveChart
          data={data}
          value={value}
          theme={APP_THEME}
          accentColor={ACCENT}
          timeWindow={15}
          paused={paused}
          autoSleep={autoSleep}
          debugFrameStats={stats}
          pulse={false}
          momentum={false}
          smoothing={0.08}
          scrub={false}
          formatValue={(price) => { "worklet"; return `$${price.toFixed(2)}`; }}
        />
      }
    >
      <EngineStatus stats={stats} value={value} paused={paused} autoSleep={autoSleep} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={paused ? "Resume live feed" : "Pause live feed"}
        onPress={() => setPaused((current) => !current)}
        style={styles.playback}
      >
        <Text style={styles.playbackText}>{paused ? "Resume live feed" : "Pause live feed"}</Text>
      </Pressable>
      <Text style={styles.description}>
        {paused
          ? "The feed and scrolling are paused. Resume to receive new prices and watch the chart animate again."
          : "12 new prices each second. Watch the line move and the time axis scroll."}
      </Text>
      <View style={styles.setting}>
        <View style={styles.settingCopy}>
          <Text style={styles.settingTitle}>Automatic sleep</Text>
          <Text style={styles.description}>Turn off while paused to compare engine activity.</Text>
        </View>
        <Switch
          accessibilityLabel="Automatic sleep"
          value={autoSleep}
          onValueChange={setAutoSleep}
          trackColor={{ true: ACCENT }}
        />
      </View>
      <Text style={styles.note}>
        Pause stops this demo&apos;s simulated feed as well as the chart clock. A paused chart
        receiving new data can still wake. Pulse is off so it can sleep completely.
      </Text>
    </DemoScreen>
  );
}

// Sampling stays in a sibling of the chart: updating the readout must not
// re-render the chart or wake it. The displayed state is measured, not a timer.
function EngineStatus({ stats, value, paused, autoSleep }: {
  stats: SharedValue<LiveChartFrameStats>;
  value: SharedValue<number>;
  paused: boolean;
  autoSleep: boolean;
}) {
  const [sample, setSample] = useState<{ ticks: number; price: number } | null>(null);
  useEffect(() => {
    let previousFrames = stats.get().frames;
    let previousTime = Date.now();
    const timer = setInterval(() => {
      const frames = stats.get().frames;
      const now = Date.now();
      setSample({ ticks: Math.round((frames - previousFrames) * 1000 / Math.max(1, now - previousTime)), price: value.get() });
      previousFrames = frames;
      previousTime = now;
    }, 500);
    return () => clearInterval(timer);
  }, [stats, value]);
  const label = !paused ? "Live" : !autoSleep ? "Paused · engine running" : sample?.ticks === 0 ? "Asleep" : "Settling";
  return (
    <View style={styles.status}>
      <View style={styles.statusRow}>
        <Text style={styles.statusTitle}>{label}</Text>
        <Text style={styles.price}>{sample ? `$${sample.price.toFixed(2)}` : "—"}</Text>
      </View>
      <Text style={styles.description}>
        {sample ? `${sample.ticks} engine ticks / second` : "Measuring engine activity…"}
      </Text>
      <Text style={styles.note}>Engine activity, not screen FPS.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { padding: 16, backgroundColor: colors.chipBackground, borderRadius: 14, gap: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statusTitle: { fontFamily: APP_FONT_FAMILY_SEMIBOLD, fontSize: 17, color: ACCENT },
  price: { fontFamily: APP_FONT_FAMILY_SEMIBOLD, fontSize: 23, color: colors.text, fontVariant: ["tabular-nums"] },
  playback: { backgroundColor: ACCENT, paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 16 },
  playbackText: { fontFamily: APP_FONT_FAMILY_SEMIBOLD, fontSize: 17, color: "white" },
  description: { fontFamily: APP_FONT_FAMILY, fontSize: 14, lineHeight: 21, color: colors.textMuted },
  setting: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, borderTopWidth: 1, borderColor: colors.border, marginTop: 12 },
  settingCopy: { flex: 1, gap: 5 },
  settingTitle: { fontFamily: APP_FONT_FAMILY_SEMIBOLD, fontSize: 16, color: colors.text },
  note: { fontFamily: APP_FONT_FAMILY, fontSize: 12, lineHeight: 18, color: colors.textFaint },
});
