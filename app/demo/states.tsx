import { useState } from "react";
import type { LiveChartPoint } from "react-native-livechart";
import { LiveChart } from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { Chip, ChipRow, ControlRow } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "States & formatting" };

/** Worklet-safe — same as toISOString().slice(11, 19) in UTC (Date/toISOString not reliable inside UI worklets). */
function formatTimeIsoUtcFragment(t: number): string {
  "worklet";
  const d = new Date(t * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatValueUsd(v: number): string {
  "worklet";
  return `$${v.toFixed(2)}`;
}

type FormatMode = "default" | "custom";

const FORMAT_OPTIONS: { value: FormatMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "custom", label: "$ + ISO time" },
];

export default function StatesScreen() {
  const [empty, setEmpty] = useState(false);
  const [onePoint, setOnePoint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formatMode, setFormatMode] = useState<FormatMode>("default");

  const customFormat = formatMode === "custom";

  const emptyData = useSharedValue<LiveChartPoint[]>([]);
  const emptyValue = useSharedValue(100);
  const [singlePointInit] = useState<LiveChartPoint[]>(() => [
    { time: Date.now() / 1000, value: 100 },
  ]);
  const singlePointData = useSharedValue<LiveChartPoint[]>(singlePointInit);

  const sim = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    paused: empty || onePoint,
  });

  const chartData = empty ? emptyData : onePoint ? singlePointData : sim.data;
  const chartValue = empty || onePoint ? emptyValue : sim.value;
  const showEmptyShell = empty || onePoint;

  return (
    <DemoScreen
      docs="guides/states-and-formatting"
      description="The chart stays in loading/empty shell until there are at least two line points and loading is false. One point only still counts as empty. formatValue/formatTime must be worklet-safe (same pattern as src/format.ts)."
      chart={
        <LiveChart
          data={chartData}
          value={chartValue}
          accentColor={ACCENT}
          theme={APP_THEME}
          loading={loading}
          emptyText={showEmptyShell ? "Nothing to see here" : "No data"}
          formatValue={customFormat ? formatValueUsd : undefined}
          formatTime={customFormat ? formatTimeIsoUtcFragment : undefined}
          scrub={false}
        />
      }
    >
      <ControlRow label="States">
        <Chip
          label="No points"
          active={empty}
          onPress={() => {
            setEmpty((e) => !e);
            if (!empty) setOnePoint(false);
          }}
        />
        <Chip
          label="1 point only"
          active={onePoint}
          onPress={() => {
            setOnePoint((o) => !o);
            if (!onePoint) setEmpty(false);
          }}
        />
        <Chip
          label={loading ? "Loading…" : "Loading 2s"}
          active={loading}
          disabled={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 2000);
          }}
        />
      </ControlRow>

      <ChipRow
        label="Formatters"
        options={FORMAT_OPTIONS}
        value={formatMode}
        onChange={setFormatMode}
      />
    </DemoScreen>
  );
}
