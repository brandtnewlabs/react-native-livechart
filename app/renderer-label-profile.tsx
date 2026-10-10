/**
 * Internal allocation experiment, opened by deep link with scene=chart|micro
 * and labels=on|off. Chart insets and the data producer stay fixed across runs.
 * The micro scene changes only the Skia Text nodes, to separate text costs from
 * the axis lines and badge geometry also removed by the chart's public toggles.
 */
import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { LiveChart } from "react-native-livechart";
import { Canvas, Circle, matchFont, Text as SkiaText } from "react-native-skia";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { useSimulatedChartData } from "../sim/useSimulatedChartData";

function ChartScene({ labels }: { labels: boolean }) {
  const randomState = useRef(409);
  const random01 = useCallback(() => {
    randomState.current =
      (Math.imul(randomState.current, 1664525) + 1013904223) >>> 0;
    return randomState.current / 4294967296;
  }, []);
  const { data, value } = useSimulatedChartData({
    tradesPerSecond: 5,
    maxPoints: 2000,
    historySpanSeconds: 40,
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    random01,
  });
  return (
    <LiveChart
      data={data}
      value={value}
      timeWindow={30}
      insets={{ left: 12, right: 80, top: 12, bottom: 28 }}
      xAxis={labels}
      yAxis={labels}
      badge={labels}
      showValue={false}
      scrub={false}
      pulse={false}
      dot={false}
      valueLine={false}
      gradient
    />
  );
}

function TextScene({ labels }: { labels: boolean }) {
  const elapsed = useSharedValue(0);
  const font = useMemo(
    () =>
      matchFont({
        fontSize: 12,
        fontFamily: Platform.OS === "android" ? "sans-serif" : "System",
      }),
    [],
  );
  useFrameCallback((frame) => {
    elapsed.set(frame.timeSinceFirstFrame / 1000);
  });
  const cx = useDerivedValue(() => 150 + 100 * Math.sin(elapsed.get()));
  const text = useDerivedValue(() => (100 + elapsed.get() * 0.05).toFixed(2));
  return (
    <Canvas style={styles.canvas}>
      <Circle cx={cx} cy={150} r={5} color="#22c55e" />
      {labels ? (
        <>
          <SkiaText x={12} y={40} text={text} font={font} color="white" />
          <SkiaText x={12} y={80} text="100.00" font={font} color="white" />
          <SkiaText x={12} y={120} text="12:34:56" font={font} color="white" />
        </>
      ) : null}
    </Canvas>
  );
}

export default function RendererLabelProfileScreen() {
  const params = useLocalSearchParams<{ scene?: string; labels?: string }>();
  const labels = params.labels !== "off";
  const micro = params.scene === "micro";
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>
        LABEL PROFILE: {micro ? "micro" : "chart"} / {labels ? "on" : "off"}
      </Text>
      <View style={styles.chart}>
        {micro ? <TextScene labels={labels} /> : <ChartScene labels={labels} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 80, backgroundColor: "#0b0b12" },
  heading: { color: "white", padding: 12, fontSize: 16 },
  chart: { width: "100%", height: 300 },
  canvas: { flex: 1 },
});
