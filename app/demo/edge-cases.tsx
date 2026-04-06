import { Pressable, Text, View } from "react-native";

import { useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import { useSimulatedData } from "../../sim/useSimulatedData";
import { LiveChart } from "../../src";
import { DemoScreen } from "../../src/demo/DemoScreen";
import { ACCENT } from "../../src/demo/shared";
import { demoStyles } from "../../src/demo/styles";
import type { LiveChartPoint } from "../../src/types";

export const options = { title: "Empty, loading, formatters" };

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

export default function EdgeCasesScreen() {
  const [empty, setEmpty] = useState(false);
  const [onePoint, setOnePoint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customFormat, setCustomFormat] = useState(false);

  const emptyData = useSharedValue<LiveChartPoint[]>([]);
  const emptyValue = useSharedValue(100);
  const singlePointData = useSharedValue<LiveChartPoint[]>([
    { time: Date.now() / 1000, value: 100 },
  ]);

  const sim = useSimulatedData({
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
      description="The chart stays in loading/empty shell until there are at least two line points and loading is false. One point only still counts as empty. formatValue/formatTime must be worklet-safe (same pattern as src/format.ts)."
      chart={
        <LiveChart
          data={chartData}
          value={chartValue}
          accentColor={ACCENT}
          theme="dark"
          loading={loading}
          emptyText={showEmptyShell ? "Nothing to see here" : "No data"}
          formatValue={customFormat ? formatValueUsd : undefined}
          formatTime={customFormat ? formatTimeIsoUtcFragment : undefined}
          scrub={false}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>States</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, empty && demoStyles.chipActive]}
          onPress={() => {
            setEmpty((e) => !e);
            if (!empty) setOnePoint(false);
          }}
        >
          <Text
            style={[demoStyles.chipText, empty && demoStyles.chipTextActive]}
          >
            No points
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, onePoint && demoStyles.chipActive]}
          onPress={() => {
            setOnePoint((o) => !o);
            if (!onePoint) setEmpty(false);
          }}
        >
          <Text
            style={[demoStyles.chipText, onePoint && demoStyles.chipTextActive]}
          >
            1 point only
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
            {loading ? "Loading…" : "Loading 2s"}
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Formatters</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, !customFormat && demoStyles.chipActive]}
          onPress={() => setCustomFormat(false)}
        >
          <Text
            style={[
              demoStyles.chipText,
              !customFormat && demoStyles.chipTextActive,
            ]}
          >
            Default
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, customFormat && demoStyles.chipActive]}
          onPress={() => setCustomFormat(true)}
        >
          <Text
            style={[
              demoStyles.chipText,
              customFormat && demoStyles.chipTextActive,
            ]}
          >
            $ + ISO time
          </Text>
        </Pressable>
      </View>
    </DemoScreen>
  );
}
