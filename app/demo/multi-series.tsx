import { useEffect, useRef, useState } from "react";
import { TextInput } from "react-native";
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
import { ACCENT, TIME_WINDOWS } from "../../demo-lib/shared";

import { useSimulatedChartData } from "../../sim/useSimulatedChartData";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { Chip, ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { demoStyles } from "../../demo-lib/styles";
import { APP_THEME } from "../../demo-lib/theme";

export const options = { title: "Multi-series" };

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const DATA_OPTIONS: { value: boolean; label: string }[] = [
  { value: false, label: "Simulated series" },
  { value: true, label: "Empty series[]" },
];

const DOT_RADIUS_OPTIONS: { value: number; label: string }[] = [
  { value: 2, label: "r=2" },
  { value: 3.5, label: "r=3.5" },
  { value: 5, label: "r=5" },
  { value: 7, label: "r=7" },
];

const LEGEND_POSITION_OPTIONS: { value: "top" | "bottom"; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
];

const WINDOW_OPTIONS = TIME_WINDOWS.slice(0, 4).map((w) => ({
  value: w.secs,
  label: w.label,
}));

// Honest control: `smoothing` is the engine's lerp rate for how fast the y-range
// and live tips track new values — not curve smoothing. Lower = gentler/laggier
// tracking, higher = snappier. Spread wide so the effect is visible.
const RESPONSIVENESS_OPTIONS: { value: number; label: string }[] = [
  { value: 0.03, label: "Smooth" },
  { value: 0.12, label: "Default" },
  { value: 0.5, label: "Snappy" },
];

// Opacity of the chart content right of the crosshair while scrubbing.
// `1` = no fade, `0` = fully faded.
const SCRUB_DIM_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Off" },
  { value: 0.6, label: "Light" },
  { value: 0.3, label: "Default" },
  { value: 0, label: "Full" },
];

const THEME_OPTIONS: { value: "dark" | "light"; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const AXIS_OPTIONS: { value: "both" | "noY" | "noX" | "none"; label: string }[] =
  [
    { value: "both", label: "Both" },
    { value: "noY", label: "No Y" },
    { value: "noX", label: "No X" },
    { value: "none", label: "None" },
  ];

// Per-series interpolation. "linear" draws straight segments between samples
// instead of the default monotone cubic.
const CURVE_OPTIONS: { value: "monotone" | "linear"; label: string }[] = [
  { value: "monotone", label: "Monotone" },
  { value: "linear", label: "Linear" },
];

export default function MultiSeriesScreen() {
  const seriesVisibilityRef = useRef<Record<string, boolean>>({});
  const emptySeries = useSharedValue<SeriesConfig[]>([]);

  const [empty, setEmpty] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [windowSecs, setWindowSecs] = useState(30);
  const [smoothing, setSmoothing] = useState(0.12);
  const [exaggerate, setExaggerate] = useState(false);
  const [degen, setDegen] = useState(false);
  const [scrubDim, setScrubDim] = useState(0.3);
  const [theme, setTheme] = useState<"dark" | "light">(APP_THEME);
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
  const [dots, setDots] = useState(true);
  const [ring, setRing] = useState(true);

  const [legendVisible, setLegendVisible] = useState(true);
  const [legendCompact, setLegendCompact] = useState(true);
  const [legendPosition, setLegendPosition] = useState<"top" | "bottom">("top");
  const [styled, setStyled] = useState(false);
  const [legendStyled, setLegendStyled] = useState(false);
  const [curve, setCurve] = useState<"monotone" | "linear">("monotone");

  const sim = useSimulatedChartData({
    multiSeries: !empty,
    candleAggregation: false,
    tradeStream: false,
    paused,
    // Sparse stream (≈1 point / 1.4s) so the per-series `curve` toggle is
    // actually visible — on a dense feed linear vs. monotone is sub-pixel.
    tradesPerSecond: 0.7,
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
        arr[i].curve = curve;
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
  }, [styled, curve, empty, sim.series]);

  const dotConfig: MultiSeriesDotConfig = {
    radius: dotRadius,
    show: dots,
    ring,
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
          activeColor: "#0f172a",
          hiddenColor: "rgba(0,0,0,0.35)",
        }
      : undefined,
  };

  return (
    <DemoScreen
      title="Multi-series"
      docs="guides/multi-series"
      description="series, onSeriesToggle, scrub, axis visibility. Chart stays empty until at least one series has ≥2 points (toggle No series for shell)."
      chartWrapperStyle={{ height: 360 }}
      chart={
        <>
          <AnimatedTextInput
            editable={false}
            multiline
            numberOfLines={2}
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
            degen={degen ? true : undefined}
            referenceLines={
              showRef ? [{ value: 33.3, label: "even" }] : undefined
            }
            yAxis={yOn}
            xAxis={xOn}
            emptyText="No series"
            dot={dotConfig}
            legend={legendConfig}
            scrub={{ dimOpacity: scrubDim }}
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
      <ChipRow label="Data" options={DATA_OPTIONS} value={empty} onChange={setEmpty} />

      <ControlRow label="Dot">
        <ToggleChip label="Dots" value={dots} onChange={setDots} />
        <ToggleChip label="Ring" value={ring} onChange={setRing} />
        <ToggleChip label="Pulse" value={pulse} onChange={setPulse} />
        <ToggleChip label="Labels" value={valueLabels} onChange={setValueLabels} />
        <ToggleChip
          label="Value lines"
          value={valueLines}
          onChange={setValueLines}
        />
      </ControlRow>
      <ChipRow
        options={DOT_RADIUS_OPTIONS}
        value={dotRadius}
        onChange={setDotRadius}
      />

      <ControlRow label="Legend">
        <ToggleChip
          label="Visible"
          value={legendVisible}
          onChange={setLegendVisible}
        />
        <ToggleChip
          label="Compact"
          value={legendCompact}
          onChange={setLegendCompact}
        />
      </ControlRow>
      <ChipRow
        options={LEGEND_POSITION_OPTIONS}
        value={legendPosition}
        onChange={setLegendPosition}
      />

      <ControlRow label="Per-series style">
        <ToggleChip label="Styled lines" value={styled} onChange={setStyled} />
        <ToggleChip
          label="Legend style"
          value={legendStyled}
          onChange={setLegendStyled}
        />
      </ControlRow>

      <ChipRow
        label="Curve (per-series interpolation)"
        options={CURVE_OPTIONS}
        value={curve}
        onChange={setCurve}
      />

      <ChipRow
        label="Time window"
        options={WINDOW_OPTIONS}
        value={windowSecs}
        onChange={setWindowSecs}
      />

      <ChipRow
        label="Responsiveness"
        options={RESPONSIVENESS_OPTIONS}
        value={smoothing}
        onChange={setSmoothing}
      />

      <ChipRow
        label="Scrub trailing fade (dimOpacity)"
        options={SCRUB_DIM_OPTIONS}
        value={scrubDim}
        onChange={setScrubDim}
      />

      <ControlRow label="Playback & theme">
        <ToggleChip
          label="Pause"
          value={paused}
          onChange={() => setPaused((p) => !p)}
        />
        <ToggleChip
          label="Exaggerate"
          value={exaggerate}
          onChange={() => setExaggerate((e) => !e)}
        />
        <ToggleChip
          label="Degen"
          value={degen}
          onChange={() => setDegen((d) => !d)}
        />
        <Chip
          label={loading ? "…" : "Load"}
          active={loading}
          disabled={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 2000);
          }}
        />
        <ToggleChip
          label="Ref line"
          value={showRef}
          onChange={() => setShowRef((r) => !r)}
        />
      </ControlRow>
      <ChipRow options={THEME_OPTIONS} value={theme} onChange={setTheme} />

      <ChipRow
        label="Axes"
        options={AXIS_OPTIONS}
        value={axisVis}
        onChange={setAxisVis}
      />
    </DemoScreen>
  );
}
