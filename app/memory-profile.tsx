/**
 * Fixed-phase iOS memory profiling screen.
 *
 * Keep the synthetic feed mounted through every phase so static/live trace
 * differences measure chart rendering rather than the JS data producer.
 * Select the matrix run at bundle time with:
 *
 *   EXPO_PUBLIC_MEMORY_PROFILE_RUN=live-monotone-round
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { LiveChart } from "react-native-livechart";
import { resolveLiveRendererProfile } from "../profiling/liveRendererProfile";
import { useSimulatedChartData } from "../sim/useSimulatedChartData";

const PROFILE = resolveLiveRendererProfile(
  process.env.EXPO_PUBLIC_MEMORY_PROFILE_RUN,
  process.env.EXPO_PUBLIC_MEMORY_PROFILE_MODE,
);

type LiveChartProfileGlobal = typeof globalThis & {
  __reactNativeLiveChartProfileCadence?: string;
  __reactNativeLiveChartProfilePublicationCount?: SharedValue<number>;
};

const PHASES = [
  { name: "baseline", chartMounted: false, seconds: 15 },
  { name: PROFILE.id, chartMounted: true, seconds: 30 },
  { name: "unmounted", chartMounted: false, seconds: 15 },
] as const;

export default function MemoryProfileScreen() {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [completedPublicationCount, setCompletedPublicationCount] = useState<
    number | null
  >(null);
  const publicationCount = useSharedValue(0);

  const { data, value } = useSimulatedChartData({
    paused: false,
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    tradesPerSecond: PROFILE.tradesPerSecond,
    maxPoints: PROFILE.maxPoints,
    historySpanSeconds: PROFILE.historySpanSeconds,
  });

  useEffect(() => {
    // Keep profiling controls in the example app and remove them when the route
    // unmounts, so ordinary library charts retain the production display path.
    const profileGlobal = globalThis as LiveChartProfileGlobal;
    profileGlobal.__reactNativeLiveChartProfileCadence = PROFILE.cadence;
    profileGlobal.__reactNativeLiveChartProfilePublicationCount =
      publicationCount;
    return () => {
      delete profileGlobal.__reactNativeLiveChartProfileCadence;
      delete profileGlobal.__reactNativeLiveChartProfilePublicationCount;
    };
  }, [publicationCount]);

  useEffect(() => {
    let nextPhase = 1;
    let timer = setTimeout(function advancePhase() {
      if (nextPhase === 1) publicationCount.set(0);
      setPhaseIndex(nextPhase);
      nextPhase += 1;
      if (nextPhase < PHASES.length) {
        timer = setTimeout(advancePhase, PHASES[nextPhase - 1].seconds * 1000);
      }
    }, PHASES[0].seconds * 1000);
    return () => clearTimeout(timer);
  }, [publicationCount]);

  useEffect(() => {
    if (phaseIndex !== 2) return;
    const count = publicationCount.get();
    setCompletedPublicationCount(count);
    console.info(
      `[livechart-profile] ${PROFILE.id}: ${count} engine publications`,
    );
  }, [phaseIndex, publicationCount]);

  const phase = PHASES[phaseIndex];

  return (
    <View style={styles.root}>
      <Text style={styles.label}>
        MEMORY PROFILE {phaseIndex}: {phase.name}
      </Text>
      <Text style={styles.detail}>
        {PROFILE.mode} · {PROFILE.cadence} · {PROFILE.curve} · {PROFILE.join}/
        {PROFILE.cap}
      </Text>
      <Text style={styles.detail}>
        {PROFILE.tradesPerSecond} updates/s · {PROFILE.timeWindowSeconds}s window
        · {PROFILE.chartHeight}px high
      </Text>
      <Text style={styles.detail}>
        publications: {completedPublicationCount ?? "counting during mount"}
      </Text>
      {phase.chartMounted ? (
        <View style={[styles.chartBox, { height: PROFILE.chartHeight }]}>
          <LiveChart
            data={data}
            value={value}
            static={PROFILE.mode === "static"}
            timeWindow={PROFILE.timeWindowSeconds}
            line={{
              curve: PROFILE.curve,
              join: PROFILE.join,
              cap: PROFILE.cap,
              width: PROFILE.lineWidth,
            }}
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
    width: "100%",
  },
});
