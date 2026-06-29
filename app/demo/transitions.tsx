import { useState } from "react";
import { Text } from "react-native";
import { LiveChart, LiveChartTransition } from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { demoStyles } from "../../demo-lib/styles";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Transitions" };

const WINDOW = 300;
const CANDLE_WIDTH = 15;

type Example = "mode" | "crossfade" | "snap";

const EXAMPLE_OPTIONS: { value: Example; label: string }[] = [
  { value: "mode", label: "Line ↔ Candle (mode)" },
  { value: "crossfade", label: "Cross-fade (transition)" },
  { value: "snap", label: "Snap on timeframe (snapKey)" },
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

  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: true,
    tradeStream: false,
    candleWidth: CANDLE_WIDTH,
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
        example === "mode" ? (
          // Built-in line↔candle morph — ONE engine, so the y-axis eases
          // smoothly between the line and candle ranges (no re-reveal).
          <LiveChart
            data={data}
            value={value}
            mode={mode}
            candles={candles}
            liveCandle={liveCandle}
            candleWidth={CANDLE_WIDTH}
            accentColor={ACCENT}
            theme={APP_THEME}
            timeWindow={WINDOW}
            transitions={instant ? false : undefined}
            accessibilityLabel={`Price ${mode} chart`}
            scrub={false}
          />
        ) : example === "snap" ? (
          // Snap-on-timeframe: a high smoothing keeps live ticks gliding, while
          // `snapKey={timeframe}` makes a window change land in one frame. Toggle
          // Snap off (snapKey omitted) to feel the framing slide instead.
          <LiveChart
            data={data}
            value={value}
            accentColor={ACCENT}
            theme={APP_THEME}
            timeWindow={TIMEFRAME_WINDOW[timeframe]}
            smoothing={0.4}
            snapKey={snap ? timeframe : undefined}
            transitions={{ reveal: 0 }}
            accessibilityLabel={`Price chart, ${timeframe} window`}
            scrub={false}
          />
        ) : (
          // Cross-fade between two instances. keepMounted lets both settle their
          // y-range up front, so switching is a pure opacity fade. Same data +
          // scale, so the two layers line up — only the accent color differs.
          <LiveChartTransition
            active={accent}
            duration={350}
            keepMounted={keepMounted}
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
        )
      }
    >
      <ChipRow
        label="Example"
        options={EXAMPLE_OPTIONS}
        value={example}
        onChange={setExample}
      />

      {example === "mode" ? (
        <>
          <ChipRow
            label="Mode"
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
          />
          <ControlRow label="transitions">
            {/* transitions={false} → instant reveal + instant line↔candle switch. */}
            <ToggleChip
              label="Instant (no animation)"
              value={instant}
              onChange={setInstant}
            />
          </ControlRow>
          <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
            One LiveChart with a toggled mode — the engine morphs line↔candle and
            the y-axis eases between the two ranges (no re-reveal). Flip Instant
            ({`transitions={false}`}) to switch with no animation.
          </Text>
        </>
      ) : example === "snap" ? (
        <>
          <ChipRow
            label="Timeframe"
            options={TIMEFRAME_OPTIONS}
            value={timeframe}
            onChange={setTimeframe}
          />
          <ControlRow label="snapKey">
            <ToggleChip
              label="Snap on change"
              value={snap}
              onChange={setSnap}
            />
          </ControlRow>
          <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
            Switch the timeframe. With Snap on ({`snapKey={timeframe}`}) the window
            and y-range jump to the new framing in one frame; live ticks still
            glide ({`smoothing={0.4}`}). Toggle Snap off to feel the same change
            slide in instead — that slide is the easing, not a transition.
          </Text>
        </>
      ) : (
        <>
          <ChipRow
            label="Active layer"
            options={ACCENT_OPTIONS}
            value={accent}
            onChange={setAccent}
          />
          <ControlRow label="LiveChartTransition">
            <ToggleChip
              label="keepMounted"
              value={keepMounted}
              onChange={setKeepMounted}
            />
          </ControlRow>
          <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
            LiveChartTransition cross-fades two chart instances (here: accent
            color, blue↔violet). keepMounted on = both engines stay mounted and
            switching is a pure cross-fade; off = the incoming chart mounts fresh
            and re-reveals (range re-animates) on each switch.
          </Text>
        </>
      )}
    </DemoScreen>
  );
}
