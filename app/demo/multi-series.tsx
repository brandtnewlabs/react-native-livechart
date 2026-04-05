import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ScrubPointMulti, SeriesConfig } from "../../src/types";
import { ACCENT, SMOOTHING_PRESETS, TIME_WINDOWS } from "./_lib/shared";

import { useSharedValue } from "react-native-reanimated";
import { useSimulatedData } from "../../sim/useSimulatedData";
import { LiveChartSeries } from "../../src";
import { formatTime } from "../../src/format";
import { DemoScreen } from "./_lib/DemoScreen";
import { demoStyles } from "./_lib/styles";

export const options = { title: "Multi-series" };

export default function MultiSeriesScreen() {
  const seriesVisibilityRef = useRef<Record<string, boolean>>({});
  const emptySeries = useSharedValue<SeriesConfig[]>([]);

  const [empty, setEmpty] = useState(false);
  const [compact, setCompact] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [windowSecs, setWindowSecs] = useState(60);
  const [smoothing, setSmoothing] = useState(0.08);
  const [exaggerate, setExaggerate] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showRef, setShowRef] = useState(false);
  const [axisVis, setAxisVis] = useState<"both" | "noY" | "noX" | "none">(
    "both",
  );
  const [readout, setReadout] = useState("—");

  const sim = useSimulatedData({
    multiSeries: !empty,
    candleAggregation: false,
    tradeStream: false,
    paused,
    seriesVisibilityRef: empty ? undefined : seriesVisibilityRef,
  });

  const yOn = axisVis !== "noY" && axisVis !== "none";
  const xOn = axisVis !== "noX" && axisVis !== "none";

  const seriesSource = empty ? emptySeries : sim.series;

  return (
    <DemoScreen
      description="series, onSeriesToggle, scrub, shared core props, axis visibility"
      chart={
        <LiveChartSeries
          series={seriesSource}
          accentColor={ACCENT}
          theme={theme}
          timeWindow={windowSecs}
          paused={paused}
          loading={loading}
          smoothing={smoothing}
          exaggerate={exaggerate}
          referenceLine={showRef ? { value: 52, label: "mid" } : undefined}
          yAxis={yOn}
          xAxis={xOn}
          emptyText="No series"
          seriesToggleCompact={compact}
          scrub={{ tooltip: true }}
          onSeriesToggle={
            empty
              ? undefined
              : (id, visible) => {
                  seriesVisibilityRef.current[id] = visible;
                  const cur = sim.series.value;
                  sim.series.value = cur.map((s) =>
                    s.id === id ? { ...s, visible } : s,
                  );
                }
          }
          onScrub={(p) => {
            if (p === null) {
              setReadout("—");
              return;
            }
            const m = p as ScrubPointMulti;
            const parts = m.seriesValues.map(
              (sv) => `${sv.label ?? sv.id}:${sv.value.toFixed(2)}`,
            );
            setReadout(
              `${formatTime(m.time)} · ${parts.join(" · ") || m.value.toFixed(4)}`,
            );
          }}
        />
      }
    >
      <Text style={demoStyles.scrubReadout} numberOfLines={4}>
        {readout}
      </Text>

      <Text style={demoStyles.sectionLabel}>Data</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, !empty && demoStyles.chipActive]}
          onPress={() => setEmpty(false)}
        >
          <Text
            style={[demoStyles.chipText, !empty && demoStyles.chipTextActive]}
          >
            Simulated series
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, empty && demoStyles.chipActive]}
          onPress={() => setEmpty(true)}
        >
          <Text
            style={[demoStyles.chipText, empty && demoStyles.chipTextActive]}
          >
            Empty series[]
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Toggle chips</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, compact && demoStyles.chipActive]}
          onPress={() => setCompact((c) => !c)}
        >
          <Text
            style={[demoStyles.chipText, compact && demoStyles.chipTextActive]}
          >
            Compact dots
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Time window</Text>
      <View style={demoStyles.buttonRow}>
        {TIME_WINDOWS.slice(0, 4).map((w) => (
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

      <Text style={demoStyles.sectionLabel}>Playback & theme</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, paused && demoStyles.chipActive]}
          onPress={() => setPaused((p) => !p)}
        >
          <Text
            style={[demoStyles.chipText, paused && demoStyles.chipTextActive]}
          >
            Pause
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
        <Pressable
          style={[demoStyles.chip, loading && demoStyles.chipActive]}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 2000);
          }}
          disabled={loading}
        >
          <Text
            style={[demoStyles.chipText, loading && demoStyles.chipTextActive]}
          >
            {loading ? "…" : "Load"}
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, theme === "dark" && demoStyles.chipActive]}
          onPress={() => setTheme("dark")}
        >
          <Text
            style={[
              demoStyles.chipText,
              theme === "dark" && demoStyles.chipTextActive,
            ]}
          >
            Dark
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, theme === "light" && demoStyles.chipActive]}
          onPress={() => setTheme("light")}
        >
          <Text
            style={[
              demoStyles.chipText,
              theme === "light" && demoStyles.chipTextActive,
            ]}
          >
            Light
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, showRef && demoStyles.chipActive]}
          onPress={() => setShowRef((r) => !r)}
        >
          <Text
            style={[demoStyles.chipText, showRef && demoStyles.chipTextActive]}
          >
            Ref line
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Axes</Text>
      <View style={demoStyles.buttonRow}>
        {(
          [
            ["both", "Both"],
            ["noY", "No Y"],
            ["noX", "No X"],
            ["none", "None"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[demoStyles.chip, axisVis === k && demoStyles.chipActive]}
            onPress={() => setAxisVis(k)}
          >
            <Text
              style={[
                demoStyles.chipText,
                axisVis === k && demoStyles.chipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </DemoScreen>
  );
}
