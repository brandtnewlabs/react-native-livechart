import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  formatTime,
  LiveChartSeries,
  type LegendConfig,
  type MultiSeriesDotConfig,
  type SeriesConfig,
} from "react-native-livechart";
import Animated, {
  useAnimatedProps,
  useSharedValue,
} from "react-native-reanimated";
import { ACCENT, SMOOTHING_PRESETS, TIME_WINDOWS } from "../../demo-lib/shared";

import { useSimulatedChartData } from "../../sim/useSimulatedChartData";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { demoStyles } from "../../demo-lib/styles";

export const options = { title: "Multi-series" };

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export default function MultiSeriesScreen() {
  const seriesVisibilityRef = useRef<Record<string, boolean>>({});
  const emptySeries = useSharedValue<SeriesConfig[]>([]);

  const [empty, setEmpty] = useState(false);
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

  const readoutText = useSharedValue("—");
  const readoutProps = useAnimatedProps(() => {
    const text = readoutText.get();
    return { text, defaultValue: text };
  });

  const [pulse, setPulse] = useState(true);
  const [valueLines, setValueLines] = useState(false);
  const [valueLabels, setValueLabels] = useState(true);
  const [dotRadius, setDotRadius] = useState(3.5);

  const [legendVisible, setLegendVisible] = useState(true);
  const [legendCompact, setLegendCompact] = useState(false);
  const [legendPosition, setLegendPosition] = useState<"top" | "bottom">("top");
  const [styled, setStyled] = useState(false);
  const [legendStyled, setLegendStyled] = useState(false);
  const [degenOn, setDegenOn] = useState(false);
  const [degenColors, setDegenColors] = useState(false);

  const sim = useSimulatedChartData({
    multiSeries: !empty,
    candleAggregation: false,
    tradeStream: false,
    paused,
    seriesVisibilityRef: empty ? undefined : seriesVisibilityRef,
  });

  const yOn = axisVis !== "noY" && axisVis !== "none";
  const xOn = axisVis !== "noX" && axisVis !== "none";

  const seriesSource = empty ? emptySeries : sim.series;

  // Inject per-series stroke style onto the sim's series objects (mutated in
  // place, so style survives the sim's per-tick data appends).
  useEffect(() => {
    if (empty) return;
    sim.series.modify((arr) => {
      "worklet";
      for (let i = 0; i < arr.length; i++) {
        if (styled) {
          arr[i].style = i % 2 === 1 ? "dashed" : "solid";
          arr[i].glow = i === 0;
          arr[i].strokeWidth = i === 0 ? 3 : 2;
        } else {
          arr[i].style = undefined;
          arr[i].glow = undefined;
          arr[i].strokeWidth = undefined;
        }
      }
      return arr;
    });
  }, [styled, empty, sim.series]);

  const dotConfig: MultiSeriesDotConfig = {
    radius: dotRadius,
    pulse,
    valueLine: valueLines,
    valueLabel: valueLabels,
  };

  const legendConfig: LegendConfig = {
    visible: legendVisible,
    compact: legendCompact,
    position: legendPosition,
    style: legendStyled
      ? {
          borderRadius: 20,
          fontSize: 14,
          dotSize: 10,
          activeBackground: "rgba(96,165,250,0.18)",
          activeColor: "#ffffff",
          hiddenColor: "rgba(255,255,255,0.35)",
        }
      : undefined,
  };

  return (
    <DemoScreen
      description="series, onSeriesToggle, scrub, axis visibility. Chart stays empty until at least one series has ≥2 points (toggle No series for shell)."
      chart={
        <>
          <AnimatedTextInput
            editable={false}
            multiline
            numberOfLines={4}
            scrollEnabled={false}
            underlineColorAndroid="transparent"
            style={demoStyles.scrubReadout}
            animatedProps={readoutProps}
          />
          <LiveChartSeries
            series={seriesSource}
            accentColor={ACCENT}
            theme={theme}
            timeWindow={windowSecs}
            paused={paused}
            loading={loading}
            smoothing={smoothing}
            exaggerate={exaggerate}
            referenceLines={showRef ? [{ value: 52, label: "mid" }] : undefined}
            yAxis={yOn}
            xAxis={xOn}
            emptyText="No series"
            dot={dotConfig}
            legend={legendConfig}
            degen={
              degenOn
                ? degenColors
                  ? { colors: ["#f472b6", "#22d3ee", "#fde047"] }
                  : true
                : false
            }
            scrub
            onSeriesToggle={
              empty
                ? undefined
                : (id, visible) => {
                    seriesVisibilityRef.current[id] = visible;
                    const cur = sim.series.get();
                    sim.series.set(
                      cur.map((s) => (s.id === id ? { ...s, visible } : s)),
                    );
                  }
            }
            onScrub={(p) => {
              "worklet";
              if (p === null) {
                readoutText.set("—");
                return;
              }
              const parts: string[] = [];
              for (let i = 0; i < p.seriesValues.length; i++) {
                const sv = p.seriesValues[i];
                const label = sv.label ?? sv.id;
                parts.push(`${label}:${sv.value.toFixed(2)}`);
              }
              const text = `${formatTime(p.time)} · ${parts.join(" · ") || p.value.toFixed(4)}`;
              readoutText.set(text);
            }}
          />
        </>
      }
    >
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

      <Text style={demoStyles.sectionLabel}>Dot</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, pulse && demoStyles.chipActive]}
          onPress={() => setPulse((v) => !v)}
        >
          <Text
            style={[demoStyles.chipText, pulse && demoStyles.chipTextActive]}
          >
            Pulse
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, valueLabels && demoStyles.chipActive]}
          onPress={() => setValueLabels((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              valueLabels && demoStyles.chipTextActive,
            ]}
          >
            Labels
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, valueLines && demoStyles.chipActive]}
          onPress={() => setValueLines((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              valueLines && demoStyles.chipTextActive,
            ]}
          >
            Value lines
          </Text>
        </Pressable>
      </View>
      <View style={demoStyles.buttonRow}>
        {([2, 3.5, 5, 7] as const).map((r) => (
          <Pressable
            key={r}
            style={[demoStyles.chip, dotRadius === r && demoStyles.chipActive]}
            onPress={() => setDotRadius(r)}
          >
            <Text
              style={[
                demoStyles.chipText,
                dotRadius === r && demoStyles.chipTextActive,
              ]}
            >
              r={r}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={demoStyles.sectionLabel}>Legend</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, legendVisible && demoStyles.chipActive]}
          onPress={() => setLegendVisible((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              legendVisible && demoStyles.chipTextActive,
            ]}
          >
            Visible
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, legendCompact && demoStyles.chipActive]}
          onPress={() => setLegendCompact((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              legendCompact && demoStyles.chipTextActive,
            ]}
          >
            Compact
          </Text>
        </Pressable>
        <Pressable
          style={[
            demoStyles.chip,
            legendPosition === "top" && demoStyles.chipActive,
          ]}
          onPress={() => setLegendPosition("top")}
        >
          <Text
            style={[
              demoStyles.chipText,
              legendPosition === "top" && demoStyles.chipTextActive,
            ]}
          >
            Top
          </Text>
        </Pressable>
        <Pressable
          style={[
            demoStyles.chip,
            legendPosition === "bottom" && demoStyles.chipActive,
          ]}
          onPress={() => setLegendPosition("bottom")}
        >
          <Text
            style={[
              demoStyles.chipText,
              legendPosition === "bottom" && demoStyles.chipTextActive,
            ]}
          >
            Bottom
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Per-series style & degen</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, styled && demoStyles.chipActive]}
          onPress={() => setStyled((v) => !v)}
        >
          <Text
            style={[demoStyles.chipText, styled && demoStyles.chipTextActive]}
          >
            Styled lines
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, legendStyled && demoStyles.chipActive]}
          onPress={() => setLegendStyled((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              legendStyled && demoStyles.chipTextActive,
            ]}
          >
            Legend style
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, degenOn && demoStyles.chipActive]}
          onPress={() => setDegenOn((v) => !v)}
        >
          <Text
            style={[demoStyles.chipText, degenOn && demoStyles.chipTextActive]}
          >
            Degen
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, degenColors && demoStyles.chipActive]}
          onPress={() => setDegenColors((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              degenColors && demoStyles.chipTextActive,
            ]}
          >
            Degen colors
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
