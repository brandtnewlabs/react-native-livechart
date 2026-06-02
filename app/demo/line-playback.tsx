import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LiveChart, type LiveChartPoint } from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { DemoScreen } from "./lib/DemoScreen";
import { ACCENT, SMOOTHING_PRESETS, TIME_WINDOWS } from "./lib/shared";
import { demoStyles } from "./lib/styles";

export const options = { title: "Line & playback" };

/** Wide sine sweep (≈ -50…200) so the Y-axis clamps below are visibly testable. */
const wave = (t: number) => 75 + 125 * Math.sin(t / 3);

export default function LinePlaybackScreen() {
  const [windowSecs, setWindowSecs] = useState(30);
  const [paused, setPaused] = useState(false);
  const [smoothing, setSmoothing] = useState(0.08);
  const [exaggerate, setExaggerate] = useState(false);
  const [nonNegative, setNonNegative] = useState(false);
  const [maxValue, setMaxValue] = useState<number | undefined>(undefined);

  const data = useSharedValue<LiveChartPoint[]>([]);
  const [initialValue] = useState(() => wave(Date.now() / 1000));
  const value = useSharedValue(initialValue);

  // Seed a little history once so the chart reveals immediately.
  useEffect(() => {
    const now = Date.now() / 1000;
    const seed: LiveChartPoint[] = [];
    for (let i = 80; i >= 0; i--) {
      const t = now - i * 0.25;
      seed.push({ time: t, value: wave(t) });
    }
    data.set(seed);
    value.set(wave(now));
    // data/value are stable useSharedValue refs and `wave` is module-level, so
    // this seeds exactly once despite the complete dependency list.
  }, [data, value]);

  // Live oscillator (paused freezes it, matching the chart's paused prop).
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const now = Date.now() / 1000;
      const v = wave(now);
      data.modify((arr) => {
        "worklet";
        arr.push({ time: now, value: v });
        if (arr.length > 600) arr.shift();
        return arr;
      });
      value.set(v);
    }, 1000 / 30);
    return () => clearInterval(id);
  }, [paused, data, value]);

  return (
    <DemoScreen
      description="timeWindow, paused, smoothing, exaggerate, nonNegative, maxValue (data sweeps ≈ -50…200)"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme="dark"
          timeWindow={windowSecs}
          paused={paused}
          smoothing={smoothing}
          exaggerate={exaggerate}
          nonNegative={nonNegative}
          maxValue={maxValue}
          scrub={false}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>Time window</Text>
      <View style={demoStyles.buttonRow}>
        {TIME_WINDOWS.map((w) => (
          <Pressable
            key={w.label}
            style={[
              demoStyles.chip,
              windowSecs === w.secs && demoStyles.chipActive,
            ]}
            onPress={() => setWindowSecs(w.secs)}
          >
            <Text
              style={[
                demoStyles.chipText,
                windowSecs === w.secs && demoStyles.chipTextActive,
              ]}
            >
              {w.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={demoStyles.sectionLabel}>Smoothing</Text>
      <View style={demoStyles.buttonRow}>
        {SMOOTHING_PRESETS.map((s) => (
          <Pressable
            key={s.label}
            style={[
              demoStyles.chip,
              smoothing === s.value && demoStyles.chipActive,
            ]}
            onPress={() => setSmoothing(s.value)}
          >
            <Text
              style={[
                demoStyles.chipText,
                smoothing === s.value && demoStyles.chipTextActive,
              ]}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={demoStyles.sectionLabel}>Playback</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, paused && demoStyles.chipActive]}
          onPress={() => setPaused((p) => !p)}
        >
          <Text
            style={[demoStyles.chipText, paused && demoStyles.chipTextActive]}
          >
            {paused ? "Resume" : "Pause"}
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, exaggerate && demoStyles.chipActive]}
          onPress={() => setExaggerate((e) => !e)}
        >
          <Text
            style={[
              demoStyles.chipText,
              exaggerate && demoStyles.chipTextActive,
            ]}
          >
            Exaggerate
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Y-axis range</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, nonNegative && demoStyles.chipActive]}
          onPress={() => setNonNegative((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              nonNegative && demoStyles.chipTextActive,
            ]}
          >
            nonNegative
          </Text>
        </Pressable>
        {[
          { label: "max off", value: undefined },
          { label: "max 150", value: 150 },
        ].map((m) => (
          <Pressable
            key={m.label}
            style={[demoStyles.chip, maxValue === m.value && demoStyles.chipActive]}
            onPress={() => setMaxValue(m.value)}
          >
            <Text
              style={[
                demoStyles.chipText,
                maxValue === m.value && demoStyles.chipTextActive,
              ]}
            >
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </DemoScreen>
  );
}
