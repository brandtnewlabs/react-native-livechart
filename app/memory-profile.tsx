/**
 * Fixed-phase iOS memory profiling screen.
 *
 * Keep the synthetic feed mounted through every phase so static/live trace
 * differences measure chart rendering rather than the JS data producer.
 * Select the variant at bundle time with:
 *
 *   EXPO_PUBLIC_MEMORY_PROFILE_MODE=static|live
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LiveChart } from "react-native-livechart";
import { useSimulatedChartData } from "../sim/useSimulatedChartData";

const PROFILE_MODE =
  process.env.EXPO_PUBLIC_MEMORY_PROFILE_MODE === "static" ? "static" : "live";

const PHASES = [
  { name: "baseline", chartMounted: false, seconds: 15 },
  { name: `${PROFILE_MODE}-chart`, chartMounted: true, seconds: 30 },
  { name: "unmounted", chartMounted: false, seconds: 15 },
] as const;

export default function MemoryProfileScreen() {
  const [phaseIndex, setPhaseIndex] = useState(0);

  const { data, value } = useSimulatedChartData({
    paused: false,
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    tradesPerSecond: 10,
    maxPoints: 2000,
    historySpanSeconds: 40,
  });

  useEffect(() => {
    let nextPhase = 1;
    let timer = setTimeout(function advancePhase() {
      setPhaseIndex(nextPhase);
      nextPhase += 1;
      if (nextPhase < PHASES.length) {
        timer = setTimeout(advancePhase, PHASES[nextPhase - 1].seconds * 1000);
      }
    }, PHASES[0].seconds * 1000);
    return () => clearTimeout(timer);
  }, []);

  const phase = PHASES[phaseIndex];

  return (
    <View style={styles.root}>
      <Text style={styles.label}>
        MEMORY PROFILE {phaseIndex}: {phase.name}
      </Text>
      <Text style={styles.detail}>
        Feed: 10 updates/s · chart: {PROFILE_MODE}
      </Text>
      {phase.chartMounted ? (
        <View style={styles.chartBox}>
          <LiveChart
            data={data}
            value={value}
            static={PROFILE_MODE === "static"}
            gradient={false}
            badge={false}
            pulse={false}
            dot={false}
            valueLine={false}
            xAxis={false}
            yAxis={false}
            scrub={false}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: 8,
    paddingTop: 80,
    paddingHorizontal: 12,
    backgroundColor: "#0b0b12",
  },
  label: {
    marginBottom: 4,
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  detail: {
    color: "#aab2c8",
    fontSize: 14,
  },
  chartBox: {
    height: 150,
  },
});
