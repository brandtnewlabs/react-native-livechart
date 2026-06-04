import { useEffect, useState } from "react";
import { LiveChart, type LiveChartPoint } from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { Chip, ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT, TIME_WINDOWS } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";

export const options = { title: "Playback" };

/** Wide sine sweep (≈ -50…200) so the Y-axis clamps below are visibly testable. */
const wave = (t: number) => 75 + 125 * Math.sin(t / 3);

const WINDOW_OPTIONS = TIME_WINDOWS.map((w) => ({ value: w.secs, label: w.label }));

export default function PlaybackScreen() {
  const [windowSecs, setWindowSecs] = useState(30);
  const [paused, setPaused] = useState(false);
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
      title="Playback"
      docs="guides/playback"
      description="timeWindow, paused, exaggerate, nonNegative, maxValue (data sweeps ≈ -50…200)"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={windowSecs}
          paused={paused}
          exaggerate={exaggerate}
          nonNegative={nonNegative}
          maxValue={maxValue}
          scrub={false}
        />
      }
    >
      <ChipRow
        label="Time window"
        options={WINDOW_OPTIONS}
        value={windowSecs}
        onChange={setWindowSecs}
      />
      <ControlRow label="Playback">
        <Chip
          label={paused ? "Resume" : "Pause"}
          active={paused}
          onPress={() => setPaused((p) => !p)}
        />
        <ToggleChip
          label="Exaggerate"
          value={exaggerate}
          onChange={setExaggerate}
        />
      </ControlRow>
      <ControlRow label="Y-axis range">
        <ToggleChip
          label="nonNegative"
          value={nonNegative}
          onChange={setNonNegative}
        />
        <Chip
          label="max off"
          active={maxValue === undefined}
          onPress={() => setMaxValue(undefined)}
        />
        <Chip
          label="max 150"
          active={maxValue === 150}
          onPress={() => setMaxValue(150)}
        />
      </ControlRow>
    </DemoScreen>
  );
}
