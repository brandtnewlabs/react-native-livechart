import { Pressable, Text, View } from "react-native";
import { ACCENT, SMOOTHING_PRESETS, TIME_WINDOWS } from "./lib/shared";

import { useState } from "react";
import { useSimulatedData } from "../../sim/useSimulatedData";
import { LiveChart } from "react-native-livechart";
import { DemoScreen } from "./lib/DemoScreen";
import { demoStyles } from "./lib/styles";

export const options = { title: "Line & playback" };

export default function LinePlaybackScreen() {
  const [windowSecs, setWindowSecs] = useState(30);
  const [paused, setPaused] = useState(false);
  const [smoothing, setSmoothing] = useState(0.08);
  const [exaggerate, setExaggerate] = useState(false);

  const { data, value } = useSimulatedData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    paused,
  });

  return (
    <DemoScreen
      description="timeWindow, paused, smoothing, exaggerate"
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
    </DemoScreen>
  );
}
