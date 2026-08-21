import { useState } from "react";
import {
  LiveChart,
  type CandlePoint,
  type ChartGap,
  type ChartGapsConfig,
  type ChartGapStyle,
} from "react-native-livechart";
import { useDerivedValue } from "react-native-reanimated";

import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Chart gaps" };

type ChartMode = "line" | "candle";
type Scenario = "no-trades" | "unavailable" | "unknown";
type Treatment = "raw" | "forward" | "semantic" | "styled";
type BridgeCap = "butt" | "round" | "square";
type LabelPosition = "left" | "right";
type DashPattern = "tight" | "balanced" | "wide";

type StyledGapControls = {
  bridge: boolean;
  bridgeOpacity: number;
  bridgeWidth: number;
  bridgeCap: BridgeCap;
  band: boolean;
  bandFillOpacity: number;
  borderOpacity: number;
  borderWidth: number;
  dashPattern: DashPattern;
  label: boolean;
  labelPosition: LabelPosition;
  independentColors: boolean;
};

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: "no-trades", label: "No trades" },
  { value: "unavailable", label: "Maintenance" },
  { value: "unknown", label: "Unknown feed" },
];
const CHART_MODES: { value: ChartMode; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "candle", label: "Candles" },
];
const TREATMENTS: { value: Treatment; label: string }[] = [
  { value: "raw", label: "Raw gap" },
  { value: "forward", label: "Forward only" },
  { value: "semantic", label: "Semantic" },
  { value: "styled", label: "Styled" },
];

const OPACITY_OPTIONS = [
  { value: 0.4, label: "40%" },
  { value: 0.7, label: "70%" },
  { value: 1, label: "100%" },
] as const;
const BRIDGE_WIDTH_OPTIONS = [
  { value: 1, label: "1 px" },
  { value: 2, label: "2 px" },
  { value: 4, label: "4 px" },
] as const;
const BRIDGE_CAP_OPTIONS: { value: BridgeCap; label: string }[] = [
  { value: "butt", label: "Butt" },
  { value: "round", label: "Round" },
  { value: "square", label: "Square" },
];
const BAND_FILL_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 0.08, label: "8%" },
  { value: 0.16, label: "16%" },
] as const;
const BORDER_WIDTH_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 1, label: "1 px" },
  { value: 3, label: "3 px" },
] as const;
const DASH_OPTIONS: { value: DashPattern; label: string }[] = [
  { value: "tight", label: "2 / 2" },
  { value: "balanced", label: "6 / 3" },
  { value: "wide", label: "10 / 4" },
];
const DASH_INTERVALS: Record<DashPattern, [number, number]> = {
  tight: [2, 2],
  balanced: [6, 3],
  wide: [10, 4],
};
const COLOR_MODE_OPTIONS = [
  { value: false, label: "Theme fallback" },
  { value: true, label: "Independent" },
] as const;
const LABEL_POSITION_OPTIONS: { value: LabelPosition; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const CANDLE_WIDTH_SECS = 60;
const BUCKET_COUNT = 12;

function labelFor(kind: Scenario): string {
  if (kind === "no-trades") return "No trades";
  if (kind === "unavailable") return "Exchange maintenance";
  return "Feed unavailable";
}

function GapChart({
  mode,
  scenario,
  treatment,
  volume,
  snap,
  paused,
  styled,
}: {
  mode: ChartMode;
  scenario: Scenario;
  treatment: Treatment;
  volume: boolean;
  snap: boolean;
  paused: boolean;
  styled: StyledGapControls;
}) {
  const [mountedAt] = useState(() => Date.now() / 1000);
  const currentBucket =
    Math.floor(mountedAt / CANDLE_WIDTH_SECS) * CANDLE_WIDTH_SECS;
  const gap: ChartGap = {
    // Keep three complete empty buckets in recent history while the current
    // bucket continues forming from the live simulated trade feed.
    from: currentBucket - 6 * CANDLE_WIDTH_SECS,
    to: currentBucket - 3 * CANDLE_WIDTH_SECS,
    kind: scenario,
    label: labelFor(scenario),
  };
  const { data, value, candles, liveCandle, tradeStream } =
    useSimulatedChartData({
      multiSeries: false,
      candleAggregation: true,
      tradeStream: true,
      candleWidth: CANDLE_WIDTH_SECS,
      historySpanSeconds: BUCKET_COUNT * CANDLE_WIDTH_SECS,
      historyRange: "5m",
      volatilityMode: "volatile",
      tradesPerSecond: 2,
      maxPoints: 10_000,
      maxTradeStreamLength: 18,
      paused,
    });

  // The simulator supplies dense historical ticks so each real candle has a
  // body and wick. Remove the declared interval at the data boundary; the
  // renderer receives no OHLC or line points there and must rely on explicit
  // semantic metadata (`candleGaps` or `lineGaps`).
  const visibleData = useDerivedValue(() =>
    data.get().filter((point) => point.time < gap.from || point.time >= gap.to),
  );
  const visibleCandles = useDerivedValue<CandlePoint[]>(() =>
    candles
      .get()
      .filter((candle) => candle.time < gap.from || candle.time >= gap.to),
  );

  let chartGaps: ChartGap[] | ChartGapsConfig | undefined;
  if (treatment === "semantic") {
    chartGaps = [gap];
  } else if (treatment === "forward") {
    chartGaps = {
      gaps: [gap],
      styles: {
        [scenario]: {
          bridge: {},
          band: false,
          label: false,
        },
      },
    };
  } else if (treatment === "styled") {
    const style: ChartGapStyle = {
      bridge: styled.bridge
        ? {
            color: styled.independentColors ? "#16a34a" : undefined,
            opacity: styled.bridgeOpacity,
            strokeWidth: styled.bridgeWidth,
            strokeCap: styled.bridgeCap,
          }
        : false,
      band: styled.band
        ? {
            fillColor: styled.independentColors ? "#7c3aed" : undefined,
            fillOpacity: styled.bandFillOpacity,
            borderColor: styled.independentColors ? "#f59e0b" : undefined,
            borderOpacity: styled.borderOpacity,
            borderWidth: styled.borderWidth,
            intervals: DASH_INTERVALS[styled.dashPattern],
          }
        : false,
      label:
        styled.band && styled.label
          ? {
              color: styled.independentColors ? "#7c3aed" : undefined,
              position: styled.labelPosition,
            }
          : false,
    };
    chartGaps = { gaps: [gap], styles: { [scenario]: style } };
  }

  return (
    <LiveChart
      data={visibleData}
      value={value}
      mode={mode}
      candles={mode === "candle" ? visibleCandles : undefined}
      liveCandle={mode === "candle" ? liveCandle : undefined}
      candleWidth={CANDLE_WIDTH_SECS}
      candleGaps={mode === "candle" ? chartGaps : undefined}
      lineGaps={mode === "line" ? chartGaps : undefined}
      timeWindow={BUCKET_COUNT * CANDLE_WIDTH_SECS}
      accentColor={ACCENT}
      theme={APP_THEME}
      volume={mode === "candle" ? volume : false}
      tradeStream={tradeStream}
      scrub={{ tooltip: true, snapToCandles: mode === "candle" && snap }}
      accessibilityLabel={`${mode} chart, ${labelFor(scenario)}, ${treatment} treatment`}
    />
  );
}

export default function EmptyCandlesScreen() {
  const [mode, setMode] = useState<ChartMode>("line");
  const [scenario, setScenario] = useState<Scenario>("unavailable");
  const [treatment, setTreatment] = useState<Treatment>("styled");
  const [volume, setVolume] = useState(true);
  const [snap, setSnap] = useState(true);
  const [paused, setPaused] = useState(false);
  const [bridge, setBridge] = useState(true);
  const [bridgeOpacity, setBridgeOpacity] = useState(0.7);
  const [bridgeWidth, setBridgeWidth] = useState(2);
  const [bridgeCap, setBridgeCap] = useState<BridgeCap>("round");
  const [band, setBand] = useState(true);
  const [bandFillOpacity, setBandFillOpacity] = useState(0.16);
  const [borderOpacity, setBorderOpacity] = useState(0.7);
  const [borderWidth, setBorderWidth] = useState(3);
  const [dashPattern, setDashPattern] = useState<DashPattern>("balanced");
  const [label, setLabel] = useState(true);
  const [labelPosition, setLabelPosition] = useState<LabelPosition>("right");
  const [independentColors, setIndependentColors] = useState(true);

  const styled: StyledGapControls = {
    bridge,
    bridgeOpacity,
    bridgeWidth,
    bridgeCap,
    band,
    bandFillOpacity,
    borderOpacity,
    borderWidth,
    dashPattern,
    label,
    labelPosition,
    independentColors,
  };

  return (
    <DemoScreen
      title="Chart gaps"
      docs="guides/empty-candles"
      description="A moving line or candlestick chart around explicit no-trade, unavailable, and unknown intervals. Compare raw sparse data, forward-fill, semantic defaults, and fully styled treatments while live trades continue."
      chart={
        <GapChart
          mode={mode}
          scenario={scenario}
          treatment={treatment}
          volume={volume}
          snap={snap}
          paused={paused}
          styled={styled}
        />
      }
    >
      <ChipRow
        label="Chart type"
        options={CHART_MODES}
        value={mode}
        onChange={setMode}
      />
      <ChipRow
        label="Gap meaning"
        options={SCENARIOS}
        value={scenario}
        onChange={setScenario}
      />
      <ChipRow
        label="Treatment"
        options={TREATMENTS}
        value={treatment}
        onChange={setTreatment}
      />
      {treatment === "styled" && (
        <>
          <ControlRow label="Styled sections">
            <ToggleChip label="Bridge" value={bridge} onChange={setBridge} />
            <ToggleChip label="Band" value={band} onChange={setBand} />
            {band && (
              <ToggleChip label="Label" value={label} onChange={setLabel} />
            )}
          </ControlRow>
          <ChipRow
            label="Paint colors"
            options={COLOR_MODE_OPTIONS}
            value={independentColors}
            onChange={setIndependentColors}
          />
          {bridge && (
            <>
              <ChipRow
                label="Bridge opacity"
                options={OPACITY_OPTIONS}
                value={bridgeOpacity}
                onChange={setBridgeOpacity}
              />
              <ChipRow
                label="Bridge width"
                options={BRIDGE_WIDTH_OPTIONS}
                value={bridgeWidth}
                onChange={setBridgeWidth}
              />
              <ChipRow
                label="Bridge cap"
                options={BRIDGE_CAP_OPTIONS}
                value={bridgeCap}
                onChange={setBridgeCap}
              />
            </>
          )}
          {band && (
            <>
              <ChipRow
                label="Band fill opacity"
                options={BAND_FILL_OPTIONS}
                value={bandFillOpacity}
                onChange={setBandFillOpacity}
              />
              <ChipRow
                label="Band border opacity"
                options={OPACITY_OPTIONS}
                value={borderOpacity}
                onChange={setBorderOpacity}
              />
              <ChipRow
                label="Band border width"
                options={BORDER_WIDTH_OPTIONS}
                value={borderWidth}
                onChange={setBorderWidth}
              />
              <ChipRow
                label="Band edge dashes"
                options={DASH_OPTIONS}
                value={dashPattern}
                onChange={setDashPattern}
              />
              {label && (
                <ChipRow
                  label="Label position"
                  options={LABEL_POSITION_OPTIONS}
                  value={labelPosition}
                  onChange={setLabelPosition}
                />
              )}
            </>
          )}
        </>
      )}
      <ControlRow label="Live simulation">
        <ToggleChip
          label="Live trades"
          value={!paused}
          onChange={(live) => setPaused(!live)}
        />
      </ControlRow>
      {mode === "candle" && (
        <ControlRow label="Verification">
          <ToggleChip label="Volume bars" value={volume} onChange={setVolume} />
          <ToggleChip label="Snap scrub" value={snap} onChange={setSnap} />
        </ControlRow>
      )}
    </DemoScreen>
  );
}
