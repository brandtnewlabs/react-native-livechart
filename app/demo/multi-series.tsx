import { Ionicons } from "@expo/vector-icons";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  formatTime,
  LiveChartSeries,
  type LegendConfig,
  type MultiSeriesDotConfig,
  type ReferenceLineRenderProps,
  type SeriesConfig,
} from "react-native-livechart";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { ACCENT, TIME_WINDOWS } from "../../demo-lib/shared";

import { useSimulatedChartData } from "../../sim/useSimulatedChartData";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { Chip, ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { demoStyles } from "../../demo-lib/styles";
import { APP_THEME } from "../../demo-lib/theme";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

function SeriesReadout({ text }: { text: SharedValue<string> }) {
  const animatedProps = useAnimatedProps(() => {
    const value = text.get();
    return { text: value, defaultValue: value };
  });
  return (
    <AnimatedTextInput
      editable={false}
      multiline
      numberOfLines={2}
      scrollEnabled={false}
      underlineColorAndroid="transparent"
      style={demoStyles.scrubReadout}
      animatedProps={animatedProps}
    />
  );
}

function CustomTargetTag({ ctx }: { ctx: ReferenceLineRenderProps }) {
  const caretStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: ctx.edge.get() === "below" ? "180deg" : "0deg" }],
  }));

  return (
    <View style={styles.targetTag}>
      <Animated.View style={caretStyle}>
        <Ionicons name="arrow-up-circle" size={14} color="#86efac" />
      </Animated.View>
      <Text style={styles.targetTagText}>
        {ctx.line.label}: {ctx.line.value?.toFixed(1)}%
      </Text>
    </View>
  );
}

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

const AXIS_OPTIONS: {
  value: "both" | "noY" | "noX" | "none";
  label: string;
}[] = [
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

// Values straddling the simulated data range (~33–34). This lets the QA demo
// exercise the same reference line above the plot, within it, and below it.
const QA_REFERENCE_EDGE_OPTIONS: { value: number; label: string }[] = [
  { value: 66.7, label: "Above" },
  { value: 33.8, label: "In range" },
  { value: 0, label: "Below" },
];

type DotLegendControlsProps = {
  dots: boolean;
  setDots: Dispatch<SetStateAction<boolean>>;
  ring: boolean;
  setRing: Dispatch<SetStateAction<boolean>>;
  pulse: boolean;
  setPulse: Dispatch<SetStateAction<boolean>>;
  valueLabels: boolean;
  setValueLabels: Dispatch<SetStateAction<boolean>>;
  valueLines: boolean;
  setValueLines: Dispatch<SetStateAction<boolean>>;
  dotRadius: number;
  setDotRadius: Dispatch<SetStateAction<number>>;
  legendVisible: boolean;
  setLegendVisible: Dispatch<SetStateAction<boolean>>;
  legendCompact: boolean;
  setLegendCompact: Dispatch<SetStateAction<boolean>>;
  legendPosition: "top" | "bottom";
  setLegendPosition: Dispatch<SetStateAction<"top" | "bottom">>;
  styled: boolean;
  setStyled: Dispatch<SetStateAction<boolean>>;
  legendStyled: boolean;
  setLegendStyled: Dispatch<SetStateAction<boolean>>;
  curve: "monotone" | "linear";
  setCurve: Dispatch<SetStateAction<"monotone" | "linear">>;
};

function DotLegendControls(props: DotLegendControlsProps) {
  return (
    <>
      <ControlRow label="Dot">
        <ToggleChip label="Dots" value={props.dots} onChange={props.setDots} />
        <ToggleChip label="Ring" value={props.ring} onChange={props.setRing} />
        <ToggleChip
          label="Pulse"
          value={props.pulse}
          onChange={props.setPulse}
        />
        <ToggleChip
          label="Labels"
          value={props.valueLabels}
          onChange={props.setValueLabels}
        />
        <ToggleChip
          label="Value lines"
          value={props.valueLines}
          onChange={props.setValueLines}
        />
      </ControlRow>
      <ChipRow
        options={DOT_RADIUS_OPTIONS}
        value={props.dotRadius}
        onChange={props.setDotRadius}
      />
      <ControlRow label="Legend">
        <ToggleChip
          label="Visible"
          value={props.legendVisible}
          onChange={props.setLegendVisible}
        />
        <ToggleChip
          label="Compact"
          value={props.legendCompact}
          onChange={props.setLegendCompact}
        />
      </ControlRow>
      <ChipRow
        options={LEGEND_POSITION_OPTIONS}
        value={props.legendPosition}
        onChange={props.setLegendPosition}
      />
      <ControlRow label="Per-series style">
        <ToggleChip
          label="Styled lines"
          value={props.styled}
          onChange={props.setStyled}
        />
        <ToggleChip
          label="Legend style"
          value={props.legendStyled}
          onChange={props.setLegendStyled}
        />
      </ControlRow>
      <ChipRow
        label="Curve (per-series interpolation)"
        options={CURVE_OPTIONS}
        value={props.curve}
        onChange={props.setCurve}
      />
    </>
  );
}

type PlaybackControlsProps = {
  paused: boolean;
  setPaused: Dispatch<SetStateAction<boolean>>;
  exaggerate: boolean;
  setExaggerate: Dispatch<SetStateAction<boolean>>;
  degen: boolean;
  setDegen: Dispatch<SetStateAction<boolean>>;
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  showRef: boolean;
  setShowRef: Dispatch<SetStateAction<boolean>>;
  panZoom: boolean;
  setPanZoom: Dispatch<SetStateAction<boolean>>;
};

function PlaybackControls(props: PlaybackControlsProps) {
  return (
    <ControlRow label="Playback & theme">
      <ToggleChip
        label="Pause"
        value={props.paused}
        onChange={props.setPaused}
      />
      <ToggleChip
        label="Exaggerate"
        value={props.exaggerate}
        onChange={props.setExaggerate}
      />
      <ToggleChip label="Degen" value={props.degen} onChange={props.setDegen} />
      <Chip
        label={props.loading ? "…" : "Load"}
        active={props.loading}
        disabled={props.loading}
        onPress={() => {
          props.setLoading(true);
          setTimeout(() => props.setLoading(false), 2000);
        }}
      />
      <ToggleChip
        label="QA connector"
        value={props.showRef}
        onChange={props.setShowRef}
      />
      <ToggleChip
        label="Pan + zoom"
        value={props.panZoom}
        onChange={props.setPanZoom}
      />
    </ControlRow>
  );
}

type ChartSettingsControlsProps = {
  windowSecs: number;
  setWindowSecs: Dispatch<SetStateAction<number>>;
  smoothing: number;
  setSmoothing: Dispatch<SetStateAction<number>>;
  scrubDim: number;
  setScrubDim: Dispatch<SetStateAction<number>>;
  seriesTooltip: boolean;
  setSeriesTooltip: Dispatch<SetStateAction<boolean>>;
  tooltipAlwaysShow: boolean;
  setTooltipAlwaysShow: Dispatch<SetStateAction<boolean>>;
  styledTooltip: boolean;
  setStyledTooltip: Dispatch<SetStateAction<boolean>>;
};

function ChartSettingsControls(props: ChartSettingsControlsProps) {
  return (
    <>
      <ChipRow
        label="Time window"
        options={WINDOW_OPTIONS}
        value={props.windowSecs}
        onChange={props.setWindowSecs}
      />
      <ChipRow
        label="Responsiveness"
        options={RESPONSIVENESS_OPTIONS}
        value={props.smoothing}
        onChange={props.setSmoothing}
      />
      <ChipRow
        label="Scrub trailing fade (dimOpacity)"
        options={SCRUB_DIM_OPTIONS}
        value={props.scrubDim}
        onChange={props.setScrubDim}
      />
      <ControlRow label="Series scrub tooltip">
        <ToggleChip
          label="Pills"
          value={props.seriesTooltip}
          onChange={props.setSeriesTooltip}
        />
        <ToggleChip
          label="Pin while idle"
          value={props.tooltipAlwaysShow}
          onChange={props.setTooltipAlwaysShow}
        />
        <ToggleChip
          label="Styled"
          value={props.styledTooltip}
          onChange={props.setStyledTooltip}
        />
      </ControlRow>
    </>
  );
}

export default function MultiSeriesScreen() {
  const seriesVisibilityRef = useRef<Record<string, boolean>>({});
  const emptySeries = useSharedValue<SeriesConfig[]>([]);

  const [empty, setEmpty] = useState(false);
  const [paused, setPaused] = useState(false);
  const [panZoom, setPanZoom] = useState(true);
  const [loading, setLoading] = useState(false);
  const [windowSecs, setWindowSecs] = useState(30);
  const [smoothing, setSmoothing] = useState(0.12);
  const [exaggerate, setExaggerate] = useState(false);
  const [degen, setDegen] = useState(false);
  const [scrubDim, setScrubDim] = useState(0.3);
  const [seriesTooltip, setSeriesTooltip] = useState(true);
  const [tooltipAlwaysShow, setTooltipAlwaysShow] = useState(false);
  const [styledTooltip, setStyledTooltip] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(APP_THEME);
  // Keep this on by default: it is the visual QA case for a custom left-pinned
  // reference tag. Its dashed connector must start at the native tag's right
  // edge and continue across the plot.
  const [showRef, setShowRef] = useState(true);
  const [qaReferenceValue, setQaReferenceValue] = useState(66.7);
  const [axisVis, setAxisVis] = useState<"both" | "noY" | "noX" | "none">(
    "both",
  );

  const readoutText = useSharedValue("—");

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
      description="series, onSeriesToggle, scrub, axis visibility. Use the QA reference buttons to move one line above, into, or below the plot: the custom tag takes over only off-axis, its caret flips with the edge, and its dashed connector continues right from the badge edge. One point in any series is valid data; toggle No series for the empty shell."
      chartWrapperStyle={{ height: 360 }}
      chart={
        <>
          <SeriesReadout text={readoutText} />
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
              showRef
                ? [
                    {
                      // The controls below move this one line through all three
                      // states so QA can observe the off-axis tag hand back to
                      // the native, in-range tag.
                      id: "qa-custom-connector",
                      value: qaReferenceValue,
                      label: "QA custom",
                      color: "#22c55e",
                      badge: { position: "left" },
                      excludeFromRange: true,
                    },
                  ]
                : undefined
            }
            renderOffAxisReferenceLine={
              showRef
                ? (ctx) =>
                    ctx.line.label === "QA custom" ? (
                      <CustomTargetTag ctx={ctx} />
                    ) : null
                : undefined
            }
            yAxis={yOn}
            xAxis={xOn}
            timeScroll={panZoom}
            zoom={panZoom}
            emptyText="No series"
            dot={dotConfig}
            legend={legendConfig}
            scrub={{
              dimOpacity: scrubDim,
              seriesTooltip: seriesTooltip
                ? {
                    alwaysShow: tooltipAlwaysShow,
                    formatSeriesValue: (value) => {
                      "worklet";
                      return `${value.toFixed(2)}%`;
                    },
                    formatTimeRange: (from, to) => {
                      "worklet";
                      return `${formatTime(from)} – ${formatTime(to)}`;
                    },
                    ...(styledTooltip
                      ? {
                          guideColor: "#f59e0b",
                          guideDashPattern: [2, 4],
                          timePillBackground: "#1e293b",
                          timePillColor: "#fbbf24",
                          timePillBorderColor: "#f59e0b",
                          seriesPillBackground: "#1e293b",
                          seriesPillLabelColor: "#94a3b8",
                          seriesPillValueColor: "#f8fafc",
                          seriesPillBorderColor: "#334155",
                          seriesPillRadius: 10,
                        }
                      : null),
                  }
                : false,
            }}
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
      <ChipRow
        label="Data"
        options={DATA_OPTIONS}
        value={empty}
        onChange={setEmpty}
      />

      <DotLegendControls
        dots={dots}
        setDots={setDots}
        ring={ring}
        setRing={setRing}
        pulse={pulse}
        setPulse={setPulse}
        valueLabels={valueLabels}
        setValueLabels={setValueLabels}
        valueLines={valueLines}
        setValueLines={setValueLines}
        dotRadius={dotRadius}
        setDotRadius={setDotRadius}
        legendVisible={legendVisible}
        setLegendVisible={setLegendVisible}
        legendCompact={legendCompact}
        setLegendCompact={setLegendCompact}
        legendPosition={legendPosition}
        setLegendPosition={setLegendPosition}
        styled={styled}
        setStyled={setStyled}
        legendStyled={legendStyled}
        setLegendStyled={setLegendStyled}
        curve={curve}
        setCurve={setCurve}
      />

      <ChartSettingsControls
        windowSecs={windowSecs}
        setWindowSecs={setWindowSecs}
        smoothing={smoothing}
        setSmoothing={setSmoothing}
        scrubDim={scrubDim}
        setScrubDim={setScrubDim}
        seriesTooltip={seriesTooltip}
        setSeriesTooltip={setSeriesTooltip}
        tooltipAlwaysShow={tooltipAlwaysShow}
        setTooltipAlwaysShow={setTooltipAlwaysShow}
        styledTooltip={styledTooltip}
        setStyledTooltip={setStyledTooltip}
      />

      <PlaybackControls
        paused={paused}
        setPaused={setPaused}
        exaggerate={exaggerate}
        setExaggerate={setExaggerate}
        degen={degen}
        setDegen={setDegen}
        loading={loading}
        setLoading={setLoading}
        showRef={showRef}
        setShowRef={setShowRef}
        panZoom={panZoom}
        setPanZoom={setPanZoom}
      />
      <ChipRow
        label="QA reference edge"
        options={QA_REFERENCE_EDGE_OPTIONS}
        value={qaReferenceValue}
        onChange={setQaReferenceValue}
      />
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

const styles = StyleSheet.create({
  targetTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#22c55e",
    backgroundColor: "#14532d",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  targetTagText: {
    color: "#f0fdf4",
    fontSize: 11,
    fontWeight: "700",
  },
});
