import { Pressable, Text, View } from "react-native";

import { useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import { useSimulatedData } from "../../sim/useSimulatedData";
import { LiveChart } from "../../src";
import type { LiveChartPoint } from "../../src/types";
import { DemoScreen } from "./_lib/DemoScreen";
import { ACCENT } from "./_lib/shared";
import { demoStyles } from "./_lib/styles";

export const options = { title: "Loading, empty, formatters" };

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
  const [loading, setLoading] = useState(false);
  const [customFormat, setCustomFormat] = useState(false);

  const emptyData = useSharedValue<LiveChartPoint[]>([]);
  const emptyValue = useSharedValue(100);

  const sim = useSimulatedData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    paused: empty,
  });

  return (
    <DemoScreen
      description="loading, empty data, custom formatValue/formatTime (must be worklet-safe — same pattern as src/format.ts)"
      chart={
        <LiveChart
          data={empty ? emptyData : sim.data}
          value={empty ? emptyValue : sim.value}
          accentColor={ACCENT}
          theme="dark"
          loading={loading}
          emptyText={empty ? "Nothing to see here" : "No data"}
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
          onPress={() => setEmpty((e) => !e)}
        >
          <Text
            style={[demoStyles.chipText, empty && demoStyles.chipTextActive]}
          >
            Empty data
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
