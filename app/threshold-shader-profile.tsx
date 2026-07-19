/**
 * Deterministic worst-case screen for physical-device threshold shader traces.
 *
 * Build with `EXPO_PUBLIC_THRESHOLD_SHADER_PROFILE_MODE=fill` (or `stroke`) to
 * redirect here. The wide band keeps fragment coverage stable while the normal
 * LiveChart engine, path builders, uniforms, and Skia paint remain in the trace.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { LiveChart, type LiveChartPoint } from "react-native-livechart";

const MODE =
  process.env.EXPO_PUBLIC_THRESHOLD_SHADER_PROFILE_MODE === "stroke"
    ? "stroke"
    : "fill";
const HISTORY_SECONDS = 120;
const SAMPLE_INTERVAL = 0.1;

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
  const data = useSharedValue(initial.price);
  const value = useSharedValue(initial.price[initial.price.length - 1].value);
  const thresholdSeries = useSharedValue(initial.threshold);

  return (
    <View style={styles.root}>
      <Text style={styles.label}>THRESHOLD SHADER PROFILE · {MODE}</Text>
      <Text style={styles.detail}>
        64 samples · 30s window · deterministic wide band
      </Text>
      <View style={styles.chart}>
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
});
