import { useState, type Dispatch, type SetStateAction } from "react";
import { Text } from "react-native";
import { LiveChart, LiveChartTransition } from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { demoStyles } from "../../demo-lib/styles";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

const WINDOW = 300;
const CANDLE_WIDTH = 15;

type Example = "mode" | "crossfade" | "snap" | "candleWidth";

const EXAMPLE_OPTIONS: { value: Example; label: string }[] = [
  { value: "mode", label: "Line ↔ Candle (mode)" },
  { value: "crossfade", label: "Cross-fade (transition)" },
  { value: "snap", label: "Snap on timeframe (snapKey)" },
  { value: "candleWidth", label: "Candle resize (candleLerpSpeed)" },
];

// Two candle bucket sizes (seconds) for the candleLerpSpeed example. Switching
// re-buckets the OHLC (fewer / fatter ⇄ more / thinner bars) — the moment the
// candle bodies ease (or snap) to their new width.
type Bucket = 15 | 30;

const BUCKET_OPTIONS: { value: Bucket; label: string }[] = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
];

// Three timeframes (visible window in seconds) for the snapKey example — all fit
// inside the simulated history span so each window is fully backed by data.
type Timeframe = "1m" | "2m" | "5m";

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "2m", label: "2m" },
  { value: "5m", label: "5m" },
];

const TIMEFRAME_WINDOW: Record<Timeframe, number> = {
  "1m": 60,
  "2m": 120,
  "5m": 300,
};

type Mode = "line" | "candle";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "line", label: "line" },
  { value: "candle", label: "candle" },
];

type Accent = "blue" | "violet";

const ACCENT_OPTIONS: { value: Accent; label: string }[] = [
  { value: "blue", label: "blue" },
  { value: "violet", label: "violet" },
];

type TransitionChartProps = {
  example: Example;
  mode: Mode;
  accent: Accent;
  keepMounted: boolean;
  instant: boolean;
  timeframe: Timeframe;
  snap: boolean;
  bucket: Bucket;
  candleSnap: boolean;
  data: ReturnType<typeof useSimulatedChartData>["data"];
  value: ReturnType<typeof useSimulatedChartData>["value"];
  candles: ReturnType<typeof useSimulatedChartData>["candles"];
  liveCandle: ReturnType<typeof useSimulatedChartData>["liveCandle"];
};

function TransitionChart(props: TransitionChartProps) {
  const { example, data, value, candles, liveCandle } = props;
  switch (example) {
    case "mode":
      return (
        <LiveChart
          data={data}
          value={value}
          mode={props.mode}
          candles={candles}
          liveCandle={liveCandle}
          candleWidth={CANDLE_WIDTH}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={WINDOW}
          transitions={props.instant ? false : undefined}
          accessibilityLabel={`Price ${props.mode} chart`}
          scrub={false}
        />
      );
    case "snap":
      return (
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={TIMEFRAME_WINDOW[props.timeframe]}
          smoothing={0.4}
          snapKey={props.snap ? props.timeframe : undefined}
          transitions={{ reveal: 0 }}
          accessibilityLabel={`Price chart, ${props.timeframe} window`}
          scrub={false}
        />
      );
    case "candleWidth":
      return (
        <LiveChart
          data={data}
          value={value}
          mode="candle"
          candles={candles}
          liveCandle={liveCandle}
          candleWidth={props.bucket}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={WINDOW}
          transitions={{ candleLerpSpeed: props.candleSnap ? 1 : undefined }}
          accessibilityLabel={`Candle chart, ${props.bucket}s buckets`}
          scrub={false}
        />
      );
    case "crossfade":
      return (
        <LiveChartTransition
          active={props.accent}
          duration={350}
          keepMounted={props.keepMounted}
        >
          <LiveChart
            key="blue"
            data={data}
            value={value}
            accentColor="#3b82f6"
            theme={APP_THEME}
            timeWindow={WINDOW}
            scrub={false}
          />
          <LiveChart
            key="violet"
            data={data}
            value={value}
            accentColor="#a855f7"
            theme={APP_THEME}
            timeWindow={WINDOW}
            scrub={false}
          />
        </LiveChartTransition>
      );
  }
}

type TransitionControlsProps = {
  example: Example;
  mode: Mode;
  setMode: Dispatch<SetStateAction<Mode>>;
  instant: boolean;
  setInstant: Dispatch<SetStateAction<boolean>>;
  timeframe: Timeframe;
  setTimeframe: Dispatch<SetStateAction<Timeframe>>;
  snap: boolean;
  setSnap: Dispatch<SetStateAction<boolean>>;
  bucket: Bucket;
  setBucket: Dispatch<SetStateAction<Bucket>>;
  candleSnap: boolean;
  setCandleSnap: Dispatch<SetStateAction<boolean>>;
  accent: Accent;
  setAccent: Dispatch<SetStateAction<Accent>>;
  keepMounted: boolean;
  setKeepMounted: Dispatch<SetStateAction<boolean>>;
};

function TransitionControls(props: TransitionControlsProps) {
  switch (props.example) {
    case "mode":
      return (
        <>
          <ChipRow
            label="Mode"
            options={MODE_OPTIONS}
            value={props.mode}
            onChange={props.setMode}
          />
          <ControlRow label="transitions">
            <ToggleChip
              label="Instant (no animation)"
              value={props.instant}
              onChange={props.setInstant}
            />
          </ControlRow>
          <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
            One LiveChart with a toggled mode — the engine morphs line↔candle
            and the y-axis eases between the two ranges (no re-reveal). Flip
            Instant ({`transitions={false}`}) to switch with no animation.
          </Text>
        </>
      );
    case "snap":
      return (
        <>
          <ChipRow
            label="Timeframe"
            options={TIMEFRAME_OPTIONS}
            value={props.timeframe}
            onChange={props.setTimeframe}
          />
          <ControlRow label="snapKey">
            <ToggleChip
              label="Snap on change"
              value={props.snap}
              onChange={props.setSnap}
            />
          </ControlRow>
          <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
            Switch the timeframe. With Snap on ({`snapKey={timeframe}`}) the
            window and y-range jump to the new framing in one frame; live ticks
            still glide ({`smoothing={0.4}`}). Toggle Snap off to feel the same
            change slide in instead — that slide is the easing, not a
            transition.
          </Text>
        </>
      );
    case "candleWidth":
      return (
        <>
          <ChipRow
            label="Bucket"
            options={BUCKET_OPTIONS}
            value={props.bucket}
            onChange={props.setBucket}
          />
          <ControlRow label="transitions.candleLerpSpeed">
            <ToggleChip
              label="Instant (candleLerpSpeed: 1)"
              value={props.candleSnap}
              onChange={props.setCandleSnap}
            />
          </ControlRow>
          <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
            Switch the Bucket to re-aggregate the candles. With Instant on (
            {`transitions={{ candleLerpSpeed: 1 }}`}) the bodies resize in one
            frame; toggle it off for the default 0.08 ease — the slow “fat →
            thin” slide from #176. Independent of {`snapKey`} / {`smoothing`}.
          </Text>
        </>
      );
    case "crossfade":
      return (
        <>
          <ChipRow
            label="Active layer"
            options={ACCENT_OPTIONS}
            value={props.accent}
            onChange={props.setAccent}
          />
          <ControlRow label="LiveChartTransition">
            <ToggleChip
              label="keepMounted"
              value={props.keepMounted}
              onChange={props.setKeepMounted}
            />
          </ControlRow>
          <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
            LiveChartTransition cross-fades two chart instances (here: accent
            color, blue↔violet). keepMounted on = both engines stay mounted and
            switching is a pure cross-fade; off = the incoming chart mounts
            fresh and re-reveals (range re-animates) on each switch.
          </Text>
        </>
      );
  }
}

export default function TransitionsScreen() {
  const [example, setExample] = useState<Example>("mode");
  const [mode, setMode] = useState<Mode>("line");
  const [accent, setAccent] = useState<Accent>("blue");
  const [keepMounted, setKeepMounted] = useState(true);
  // `transitions={false}` → instant reveal + instant line↔candle crossfade.
  const [instant, setInstant] = useState(false);
  // snapKey example: a timeframe selector + a toggle for whether switching it
  // snaps the framing (snapKey set) or eases into it (snapKey omitted).
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [snap, setSnap] = useState(true);
  // candleLerpSpeed example: a bucket selector + a toggle for whether a width
  // change snaps in one frame (candleLerpSpeed: 1) or eases (the 0.08 default).
  const [bucket, setBucket] = useState<Bucket>(15);
  const [candleSnap, setCandleSnap] = useState(true);

  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: true,
    tradeStream: false,
    // The candleWidth example drives the live re-bucketing from `bucket`; every
    // other example uses the fixed CANDLE_WIDTH seed.
    candleWidth: example === "candleWidth" ? bucket : CANDLE_WIDTH,
    // Dense seed (fine "1m" sampling over the window) so the candle side of the
    // morph shows real bodies + wicks rather than flat one-point dojis.
    historySpanSeconds: WINDOW,
    historyRange: "1m",
    volatilityMode: "volatile",
    // Keep the re-aggregated tick buffer longer than the 300s window so committed
    // candles stay frozen (a shorter buffer evicts still-visible ticks and the
    // oldest candle mutates each trade).
    maxPoints: 6000,
  });

  return (
    <DemoScreen
      title="Transitions"
      docs="guides/transitions"
      description="Line↔candle uses one chart's mode prop (shared y-axis morph); LiveChartTransition cross-fades two instances (here: accent color)"
      chart={
        <TransitionChart
          example={example}
          mode={mode}
          accent={accent}
          keepMounted={keepMounted}
          instant={instant}
          timeframe={timeframe}
          snap={snap}
          bucket={bucket}
          candleSnap={candleSnap}
          data={data}
          value={value}
          candles={candles}
          liveCandle={liveCandle}
        />
      }
    >
      <ChipRow
        label="Example"
        options={EXAMPLE_OPTIONS}
        value={example}
        onChange={setExample}
      />

      <TransitionControls
        example={example}
        mode={mode}
        setMode={setMode}
        instant={instant}
        setInstant={setInstant}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        snap={snap}
        setSnap={setSnap}
        bucket={bucket}
        setBucket={setBucket}
        candleSnap={candleSnap}
        setCandleSnap={setCandleSnap}
        accent={accent}
        setAccent={setAccent}
        keepMounted={keepMounted}
        setKeepMounted={setKeepMounted}
      />
    </DemoScreen>
  );
}
