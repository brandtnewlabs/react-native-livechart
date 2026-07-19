import { StyleSheet, Text, View } from "react-native";
import { LiveChart, type CanvasMode } from "react-native-livechart";
import { useSimulatedChartData } from "../sim/useSimulatedChartData";

const requestedMode = process.env.EXPO_PUBLIC_ANDROID_SURFACE_PROFILE_MODE;
const canvasMode: CanvasMode =
  requestedMode === "opaque" ? "opaque" : "transparent";

/** Fixed-workload release-build harness for TextureView vs SurfaceView captures. */
export default function AndroidSurfaceProfileScreen() {
  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    tradesPerSecond: 30,
    maxPoints: 10_000,
    historySpanSeconds: 120,
    historyRange: "1m",
  });

  return (
    <View style={styles.root}>
      <Text style={styles.label}>ANDROID SURFACE PROFILE · {canvasMode}</Text>
      <View style={styles.chart}>
        <LiveChart
          data={data}
          value={value}
          canvasMode={canvasMode}
          timeWindow={120}
          scrub={false}
          accessibilityLabel={`${canvasMode} profiling chart`}
        />
        <View pointerEvents="none" style={styles.overlay}>
          <Text style={styles.overlayText}>RN OVERLAY</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 80, backgroundColor: "#09090b" },
  label: { color: "#ffffff", padding: 12, fontSize: 16, fontWeight: "700" },
  chart: { flex: 1, overflow: "hidden", borderRadius: 24, margin: 12 },
  overlay: {
    position: "absolute",
    left: 16,
    top: 16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#ec4899",
  },
  overlayText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
});
