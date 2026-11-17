import { useRef, useState } from "react";
import { Text } from "react-native";
import {
  LiveChart,
  LiveChartSeries,
  type LiveChartHandle,
  type LiveChartPoint,
  type SeriesConfig,
  type ScrubPoint,
  type VisibleRange,
} from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { Chip, ChipRow, ControlRow } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { demoStyles } from "../../demo-lib/styles";

const SPAN = 600;
const COUNT = 151;

function seedHistory(endTime: number): LiveChartPoint[] {
  return Array.from({ length: COUNT }, (_, i) => ({
    time: endTime - SPAN + (i / (COUNT - 1)) * SPAN,
    value: 100 + Math.sin(i / 8) * 4 + i / 30,
  }));
}

const BUFFER_OPTIONS = [
  { value: 0, label: "0 (fill)" },
  { value: 0.1, label: "0.1" },
  { value: 0.3, label: "0.3" },
  { value: 0.5, label: "0.5" },
];
const SECONDS_OPTIONS = [0, 30, 60, 120].map((value) => ({ value, label: `${value}s padding` }));
const WINDOW_OPTIONS = [600, 300, 100].map((value) => ({ value, label: `${value}s window` }));
const MODE_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "multi", label: "Two series" },
  { value: "history", label: "All history" },
] as const;

export default function HistoricalDataScreen() {
  const chartRef = useRef<LiveChartHandle>(null);
  const [settings, setSettings] = useState({
    buffer: 0, seconds: 0, window: SPAN, offset: 0,
    mode: "single" as "single" | "multi" | "history",
  });
  const [range, setRange] = useState<VisibleRange | null>(null);
  const [lastScrub, setLastScrub] = useState<number | null>(null);
  const [seed] = useState(() => {
    const maxT = Math.floor(Date.now() / 1000);
    const points = seedHistory(maxT);
    return { points, maxT, start: maxT - SPAN };
  });
  const data = useSharedValue(seed.points);
  const value = useSharedValue(seed.points[seed.points.length - 1].value);
  const series = useSharedValue<SeriesConfig[]>([
    { id: "a", label: "A", color: ACCENT, data: seed.points, value: seed.points.at(-1)!.value },
    { id: "b", label: "B", color: "#f59e0b", data: seed.points.map((p) => ({ ...p, value: p.value - 4 })), value: seed.points.at(-1)!.value - 4 },
  ]);
  const now = seed.maxT + settings.offset;
  const common = {
    accentColor: ACCENT,
    theme: APP_THEME,
    timeWindow: settings.window,
    nowOverride: now,
    windowBuffer: settings.buffer,
    windowBufferSeconds: settings.seconds,
    zoom: { minTimeWindow: 20, maxTimeWindow: 1200 },
    onVisibleRangeChange: setRange,
    onScrub: (point: ScrubPoint | null) => {
      "worklet";
      if (point) scheduleOnRN(setLastScrub, point.time);
    },
  };

  return (
    <DemoScreen
      title="Historical data fill"
      docs="guides/historical-data"
      description="Compare fractional and fixed seconds padding. Pinch to zoom; reset to follow the clock again."
      chart={settings.mode === "single" ? (
        <LiveChart ref={chartRef} data={data} value={value} {...common} />
      ) : (
        <LiveChartSeries ref={chartRef} series={series}
          historyStartTime={settings.mode === "history" ? seed.start : undefined}
          {...common} />
      )}
    >
      <Text testID="history-range" style={demoStyles.scrubReadout}>
        {range
          ? `Window ${(range.endSec - range.startSec).toFixed(1)}s · Start ${(range.startSec - seed.start).toFixed(1)}s · End ${(range.endSec - seed.start).toFixed(1)}s · ${range.following ? "Following" : "Parked"}`
          : "Measuring window…"}
      </Text>
      <Text style={demoStyles.chipText}>Clock {SPAN + settings.offset}s · recorded tip 600s</Text>
      <Text testID="history-scrub" style={demoStyles.chipText}>
        Last scrub: {lastScrub === null ? "none" : `${(lastScrub - seed.start).toFixed(1)}s`}
      </Text>
      <ControlRow>
        <Chip label="Reset zoom" active={false} onPress={() => chartRef.current?.resetZoom()} />
        <Chip label="Advance 60s" active={false} onPress={() => setSettings({ ...settings, offset: settings.offset + 60 })} />
        <Chip label="Reset clock" active={false} onPress={() => setSettings({ ...settings, offset: 0 })} />
      </ControlRow>
      <ChipRow label="Chart" options={MODE_OPTIONS} value={settings.mode}
        onChange={(mode) => { chartRef.current?.resetZoom(); setSettings({ ...settings, mode }); }} />
      <ChipRow label="Fractional window buffer" options={BUFFER_OPTIONS} value={settings.buffer}
        onChange={(buffer) => setSettings({ ...settings, buffer })} />
      <ChipRow label="Fixed seconds buffer" options={SECONDS_OPTIONS} value={settings.seconds}
        onChange={(seconds) => setSettings({ ...settings, seconds })} />
      <ChipRow label="Time window" options={WINDOW_OPTIONS} value={settings.window}
        onChange={(window) => { chartRef.current?.resetZoom(); setSettings({ ...settings, window }); }} />
      <Text style={demoStyles.chipText}>
        Fixed seconds stay constant in time, not pixels. If padding fills the
        zoomed window, the recorded data moves offscreen. All history keeps the
        start at zero while following; Advance 60s demonstrates the growing span.
      </Text>
    </DemoScreen>
  );
}
