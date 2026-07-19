/**
 * Deterministic worst-case screen for physical-device threshold shader traces.
 *
 * Build with `EXPO_PUBLIC_THRESHOLD_SHADER_PROFILE_MODE=fill` (or `stroke`) to
 * redirect here. The wide band keeps fragment coverage stable while the normal
 * LiveChart engine, path builders, uniforms, and Skia paint remain in the trace.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  runOnJS,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { LiveChart, type LiveChartPoint } from "react-native-livechart";

const MODE =
  process.env.EXPO_PUBLIC_THRESHOLD_SHADER_PROFILE_MODE === "stroke"
    ? "stroke"
    : "fill";
const HISTORY_SECONDS = 120;
const SAMPLE_INTERVAL = 0.1;
const FRAME_PROFILE_WARMUP_MS = 3_000;
const FRAME_PROFILE_DURATION_MS = 12_000;
const FRAME_PROFILE_LABEL =
  process.env.EXPO_PUBLIC_THRESHOLD_SHADER_PROFILE_LABEL ?? "candidate";
const REQUESTED_LAYER_COUNT = Number(
  process.env.EXPO_PUBLIC_THRESHOLD_SHADER_PROFILE_LAYERS ?? "1",
);
const PROFILE_LAYER_COUNT =
  Number.isInteger(REQUESTED_LAYER_COUNT) &&
  REQUESTED_LAYER_COUNT >= 1 &&
  REQUESTED_LAYER_COUNT <= 12
    ? REQUESTED_LAYER_COUNT
    : 1;
const PROFILE_LAYERS = Array.from(
  { length: PROFILE_LAYER_COUNT },
  (_, index) => index,
);

type FrameProfileStats = {
  phaseStart: number;
  warmupMinMs: number;
  nominalMs: number;
  count: number;
  totalMs: number;
  maximumMs: number;
  overOneAndQuarter: number;
  overOneAndHalf: number;
  overTwo: number;
  measuring: boolean;
  reported: boolean;
};

function nearestNominalFrameMs(observedMinimumMs: number): number {
  "worklet";
  const candidates = [1000 / 120, 1000 / 90, 1000 / 60];
  let nearest = candidates[0];
  let nearestDistance = Math.abs(observedMinimumMs - nearest);
  for (let index = 1; index < candidates.length; index++) {
    const distance = Math.abs(observedMinimumMs - candidates[index]);
    if (distance < nearestDistance) {
      nearest = candidates[index];
      nearestDistance = distance;
    }
  }
  return nearest;
}

function formatFrameProfile(stats: FrameProfileStats): string {
  "worklet";
  const meanMs = stats.totalMs / stats.count;
  const expectedIntervals = Math.max(
    stats.count,
    Math.round(stats.totalMs / stats.nominalMs),
  );
  const missedIntervals = expectedIntervals - stats.count;
  const percent = (count: number, total: number) =>
    total === 0 ? "0.00" : ((count / total) * 100).toFixed(2);

  return [
    `${Math.round(1000 / stats.nominalMs)} Hz · ${stats.count} intervals · mean ${meanMs.toFixed(2)} ms · max ${stats.maximumMs.toFixed(2)} ms`,
    `>1.25× ${percent(stats.overOneAndQuarter, stats.count)}% · >1.5× ${percent(stats.overOneAndHalf, stats.count)}% · >2× ${percent(stats.overTwo, stats.count)}% · missed ${missedIntervals} (${percent(missedIntervals, expectedIntervals)}%)`,
  ].join("\n");
}

function buildProfileSeries(now: number): {
  price: LiveChartPoint[];
  threshold: LiveChartPoint[];
} {
  const price: LiveChartPoint[] = [];
  const threshold: LiveChartPoint[] = [];
  const count = HISTORY_SECONDS / SAMPLE_INTERVAL;
  for (let index = 0; index <= count; index++) {
    const time = now - HISTORY_SECONDS + index * SAMPLE_INTERVAL;
    price.push({
      time,
      value: 112 + Math.sin(index * 0.027) + 0.35 * Math.sin(index * 0.11),
    });
    threshold.push({
      time,
      value: 88 + 2.8 * Math.sin(index * 0.019) + Math.sin(index * 0.071),
    });
  }
  return { price, threshold };
}

export default function ThresholdShaderProfileScreen() {
  const [initial] = useState(() => buildProfileSeries(Date.now() / 1000));
  const [frameProfile, setFrameProfile] = useState<string | null>(null);
  const data = useSharedValue(initial.price);
  const value = useSharedValue(initial.price[initial.price.length - 1].value);
  const thresholdSeries = useSharedValue(initial.threshold);
  const frameStats = useSharedValue<FrameProfileStats | null>(null);

  useFrameCallback(({ timestamp, timeSincePreviousFrame }) => {
    if (timeSincePreviousFrame === null) return;

    if (frameStats.value === null) {
      frameStats.value = {
        phaseStart: timestamp,
        warmupMinMs: 1_000,
        nominalMs: 1000 / 60,
        count: 0,
        totalMs: 0,
        maximumMs: 0,
        overOneAndQuarter: 0,
        overOneAndHalf: 0,
        overTwo: 0,
        measuring: false,
        reported: false,
      };
      return;
    }

    const stats = frameStats.value;
    if (stats.reported) return;

    if (!stats.measuring) {
      // Ignore sub-frame scheduling noise when inferring 60/90/120 Hz.
      if (timeSincePreviousFrame >= 4) {
        stats.warmupMinMs = Math.min(stats.warmupMinMs, timeSincePreviousFrame);
      }
      if (timestamp - stats.phaseStart >= FRAME_PROFILE_WARMUP_MS) {
        stats.nominalMs = nearestNominalFrameMs(stats.warmupMinMs);
        stats.phaseStart = timestamp;
        stats.measuring = true;
      }
      return;
    }

    stats.count += 1;
    stats.totalMs += timeSincePreviousFrame;
    stats.maximumMs = Math.max(stats.maximumMs, timeSincePreviousFrame);
    if (timeSincePreviousFrame > stats.nominalMs * 1.25) {
      stats.overOneAndQuarter += 1;
    }
    if (timeSincePreviousFrame > stats.nominalMs * 1.5) {
      stats.overOneAndHalf += 1;
    }
    if (timeSincePreviousFrame > stats.nominalMs * 2) {
      stats.overTwo += 1;
    }

    if (timestamp - stats.phaseStart >= FRAME_PROFILE_DURATION_MS) {
      stats.reported = true;
      runOnJS(setFrameProfile)(formatFrameProfile(stats));
    }
  });

  return (
    <View style={styles.root}>
      <Text style={styles.label}>THRESHOLD SHADER PROFILE · {MODE}</Text>
      <Text style={styles.detail}>
        64 samples · 30s window · {PROFILE_LAYER_COUNT} shader layer
        {PROFILE_LAYER_COUNT === 1 ? "" : "s"}
      </Text>
      <View style={styles.chart}>
        {PROFILE_LAYERS.map((layer) => (
          <View key={layer} style={StyleSheet.absoluteFill}>
            <LiveChart
              data={data}
              value={value}
              timeWindow={30}
              line={{ width: MODE === "stroke" ? 12 : 3 }}
              gradient={false}
              badge={false}
              pulse={false}
              dot={false}
              valueLine={false}
              xAxis={false}
              yAxis={false}
              scrub={false}
              threshold={{
                series: thresholdSeries,
                fill: MODE === "fill" ? { opacity: 1 } : false,
                includeInRange: true,
                aboveColor: "#22c55e",
                belowColor: "#ef4444",
              }}
            />
          </View>
        ))}
      </View>
      <View style={styles.profile}>
        <Text style={styles.profileLabel}>
          FRAME PROFILE · {FRAME_PROFILE_LABEL}
        </Text>
        <Text style={styles.profileValue}>
          {frameProfile ?? "3s warmup + 12s UI-frame capture…"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: 8,
    paddingTop: 64,
    paddingHorizontal: 8,
    backgroundColor: "#09090b",
  },
  label: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  detail: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  chart: {
    flex: 1,
    width: "100%",
  },
  profile: {
    position: "absolute",
    right: 16,
    bottom: 24,
    left: 16,
    gap: 2,
    padding: 8,
    borderRadius: 6,
    backgroundColor: "rgba(9, 9, 11, 0.86)",
  },
  profileLabel: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  profileValue: {
    color: "#d4d4d8",
    fontSize: 10,
    fontVariant: ["tabular-nums"],
  },
});
