import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  LiveChart,
  type CandlePoint,
  type ChartOverlayContext,
  type LiveChartPoint,
} from "react-native-livechart";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import {
  APP_FONT_FAMILY,
  APP_FONT_FAMILY_SEMIBOLD,
} from "../../demo-lib/fonts";

/** Repeatable large swings with fast noise and sudden spikes; synthetic prices. */
function volatilePrice(t: number): number {
  "worklet";
  return Math.max(
    8,
    100 +
      42 * Math.sin(t * 2.3) +
      24 * Math.sin(t * 13.7) +
      95 * Math.pow(Math.max(0, Math.sin(t * 0.9)), 18),
  );
}

/** Small baseline makes both directions of range expansion unmistakable. */
function quietPrice(t: number): number {
  "worklet";
  return 100 + 8 * Math.sin(t * 3);
}

function seedFeed(
  data: SharedValue<LiveChartPoint[]>,
  value: SharedValue<number>,
  candles: SharedValue<CandlePoint[]>,
  liveCandle: SharedValue<CandlePoint | null>,
  now: number,
  quiet: boolean,
) {
  "worklet";
  const history: LiveChartPoint[] = [];
  for (let i = 5999; i >= 0; i--) {
    const time = now - i / 30;
    history.push({
      time,
      value: quiet ? quietPrice(time) : volatilePrice(time),
    });
  }
  data.set(history);
  const price = quiet ? quietPrice(now) : volatilePrice(now);
  value.set(price);
  const bars: CandlePoint[] = [];
  for (let i = 200; i > 0; i--) {
    const time = Math.floor(now) - i;
    const open = quiet ? quietPrice(time) : volatilePrice(time);
    const close = quiet ? quietPrice(time + 0.99) : volatilePrice(time + 0.99);
    let low = Math.min(open, close),
      high = Math.max(open, close);
    for (let j = 1; j < 30; j++) {
      const sample = quiet
        ? quietPrice(time + j / 30)
        : volatilePrice(time + j / 30);
      low = Math.min(low, sample);
      high = Math.max(high, sample);
    }
    bars.push({ time, open, close, low, high });
  }
  candles.set(bars);
  liveCandle.set({
    time: Math.floor(now),
    open: price,
    close: price,
    low: price,
    high: price,
  });
}

export default function RangeStressScreen() {
  const [paused, setPaused] = useState(false);
  const [candle, setCandle] = useState(false);
  const [windowSecs, setWindowSecs] = useState(12);
  const data = useSharedValue<LiveChartPoint[]>([]);
  const value = useSharedValue(100);
  const candles = useSharedValue<CandlePoint[]>([]);
  const liveCandle = useSharedValue<CandlePoint | null>(null);
  const shock = useSharedValue(0);
  const edit = useSharedValue(0);
  const scenarioStart = useSharedValue(0);

  useEffect(() => {
    scheduleOnUI(() => {
      "worklet";
      seedFeed(data, value, candles, liveCandle, Date.now() / 1000, false);
    });
  }, [data, value, candles, liveCandle]);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(
      () =>
        scheduleOnUI(() => {
          "worklet";
          const now = Date.now() / 1000;
          const forced = shock.get();
          const started = scenarioStart.get();
          const elapsed = now - started;
          const scenarioPrice =
            elapsed >= 3 && elapsed < 4
              ? 1000
              : elapsed >= 7 && elapsed < 8
                ? -500
                : quietPrice(now);
          const price =
            forced || (started > 0 ? scenarioPrice : volatilePrice(now));
          if (forced) shock.set(0);
          value.set(price);
          data.modify((points) => {
            "worklet";
            points.push({ time: now, value: price });
            if (points.length > 6000) points.shift();
            return points;
          });
          const bucket = Math.floor(now);
          const previous = liveCandle.get();
          if (previous && previous.time !== bucket) {
            candles.modify((bars) => {
              "worklet";
              bars.push({ ...previous });
              if (bars.length > 600) bars.shift();
              return bars;
            });
            liveCandle.set({
              time: bucket,
              open: price,
              close: price,
              low: price,
              high: price,
            });
          } else {
            liveCandle.modify((bar) => {
              "worklet";
              if (bar) {
                bar.close = price;
                bar.low = Math.min(bar.low, price);
                bar.high = Math.max(bar.high, price);
              }
              return bar;
            });
          }
        }),
      1000 / 30,
    );
    return () => clearInterval(timer);
  }, [paused, data, value, candles, liveCandle, shock, scenarioStart]);

  const runOutliers = () => {
    setPaused(false);
    setWindowSecs(12);
    scheduleOnUI(() => {
      "worklet";
      const now = Date.now() / 1000;
      shock.set(0);
      edit.set(0);
      seedFeed(data, value, candles, liveCandle, now, true);
      scenarioStart.set(now);
    });
  };
  const correctHistory = () =>
    scheduleOnUI(() => {
      "worklet";
      const peak = edit.get() === 500 ? 40 : 500;
      edit.set(peak);
      data.modify((points) => {
        "worklet";
        const index = Math.max(0, points.length - 120);
        if (points[index]) points[index].value = peak;
        return points;
      });
      candles.modify((bars) => {
        "worklet";
        const bar = bars[Math.max(0, bars.length - 4)];
        if (bar) {
          bar.high = Math.max(bar.open, bar.close, peak);
          bar.low = Math.min(bar.open, bar.close, peak);
        }
        return bars;
      });
    });
  return (
    <DemoScreen
      title="Volatile range stress"
      docs="guides/range-stress"
      description="30 updates/sec · 6,000 rolling points · large price swings"
      chartWrapperStyle={{ height: 300 }}
      chart={
        <LiveChart
          data={data}
          value={value}
          candles={candles}
          liveCandle={liveCandle}
          mode={candle ? "candle" : "line"}
          candleWidth={1}
          timeWindow={windowSecs}
          paused={paused}
          nonNegative={false}
          smoothing={0.08}
          pulse={false}
          scrub={false}
          theme={APP_THEME}
          accentColor={ACCENT}
          renderOverlay={(ctx) => (
            <RangeReadout ctx={ctx} start={scenarioStart} />
          )}
        />
      }
    >
      <Text style={styles.state}>
        {paused ? "Paused" : "LIVE"} · {candle ? "1-second candles" : "Line"} ·{" "}
        {windowSecs}s window
      </Text>
      <View style={styles.row}>
        <Control label="Run Y-axis outlier test" onPress={runOutliers} />
        <Control label="Volatile feed" onPress={() => scenarioStart.set(0)} />
      </View>
      <View style={styles.row}>
        <Control
          label={paused ? "Resume" : "Pause"}
          onPress={() => setPaused((p) => !p)}
        />
        <Control
          label={candle ? "Show line" : "Show candles"}
          onPress={() => setCandle((c) => !c)}
        />
        <Control
          label={windowSecs === 12 ? "Zoom out" : "Zoom in"}
          onPress={() => setWindowSecs((w) => (w === 12 ? 30 : 12))}
        />
      </View>
      <View style={styles.row}>
        <Control label="Spike to 400" onPress={() => shock.set(400)} />
        <Control label="Crash to 8" onPress={() => shock.set(8)} />
      </View>
      <Control
        label="Correct visible history in place"
        onPress={correctHistory}
      />
      <Text style={styles.note}>
        Outlier test: baseline near 100 → +1,000 → −500 → recovery as outliers
        leave the 12s window. The feed keeps the same 6,000-point array length.
        History corrections edit an interior point or candle with .modify().
        Candles update in place between commits. Synthetic data, not market
        prices.
      </Text>
    </DemoScreen>
  );
}
function RangeReadout({
  ctx,
  start,
}: {
  ctx: ChartOverlayContext;
  start: SharedValue<number>;
}) {
  const [text, setText] = useState("Measuring Y range…");
  useEffect(() => {
    const timer = setInterval(() => {
      const scale = ctx.scale.get();
      const started = start.get();
      const elapsed = Date.now() / 1000 - started;
      const phase =
        elapsed < 3
          ? "Baseline"
          : elapsed < 4
            ? "+1,000 outlier"
            : elapsed < 7
              ? "High stays in history"
              : elapsed < 8
                ? "−500 outlier"
                : elapsed < 20
                  ? "Outliers leaving window"
                  : "Recovering baseline";
      setText(
        `Y range ${scale.min.toFixed(1)} to ${scale.max.toFixed(1)}${started > 0 ? `\n${phase} · ${Math.floor(elapsed)}s` : ""}`,
      );
    }, 250);
    return () => clearInterval(timer);
  }, [ctx.scale, start]);
  return (
    <View pointerEvents="none" style={styles.rangeReadout}>
      <Text style={styles.rangeText}>{text}</Text>
    </View>
  );
}
function Control({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.button}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  rangeReadout: {
    position: "absolute",
    top: 5,
    left: 8,
    backgroundColor: "#fffffff0",
    padding: 5,
    borderRadius: 5,
  },
  rangeText: { fontFamily: APP_FONT_FAMILY, fontSize: 12, color: "#24332f" },
  state: {
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    fontSize: 16,
    color: ACCENT,
    marginBottom: 10,
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  button: {
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: "#eeebff",
    borderRadius: 9,
  },
  buttonText: {
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    fontSize: 13,
    color: ACCENT,
  },
  note: {
    fontFamily: APP_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
    color: "#66716c",
    marginVertical: 10,
  },
});
