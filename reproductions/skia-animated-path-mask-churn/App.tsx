import { Canvas, Group, Path, Skia } from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";

const BASELINE_SECONDS = 15;
const STATIC_SECONDS = 20;
const ANIMATED_SECONDS = 30;
const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 440;
const POINT_COUNT = 900;

type Phase = "baseline" | "static" | "animated" | "unmounted";

function DensePathScene({ animated }: { animated: boolean }) {
  const animatedSV = useSharedValue(animated);
  const translateX = useSharedValue(0);

  useEffect(() => {
    animatedSV.set(animated);
    if (!animated) translateX.set(0);
  }, [animated, animatedSV, translateX]);

  // Construct one immutable SkPath on the JS thread. The animated phase only
  // changes its transform, so per-frame SkPath/array construction is excluded.
  const path = useMemo(() => {
    const result = Skia.Path.Make();
    for (let index = 0; index < POINT_COUNT; index++) {
      const t = index / (POINT_COUNT - 1);
      const x = 8 + t * (CANVAS_WIDTH - 16);
      const y =
        CANVAS_HEIGHT / 2 +
        Math.sin(t * Math.PI * 18) * 120 +
        Math.sin(t * Math.PI * 74) * 26;
      if (index === 0) result.moveTo(x, y);
      else result.lineTo(x, y);
    }
    return result;
  }, []);

  useFrameCallback((frameInfo) => {
    "worklet";
    if (!animatedSV.get()) return;
    // A subpixel translation invalidates the same wide antialiased stroke each
    // frame without changing the path object itself.
    translateX.set(Math.sin(frameInfo.timestamp / 500) * 2);
  });

  const transform = useDerivedValue(() => [
    { translateX: translateX.get() },
  ]);

  return (
    <Canvas style={styles.canvas}>
      <Group transform={transform}>
        <Path
          path={path}
          color="#66e3ff"
          style="stroke"
          strokeWidth={3}
          strokeCap="round"
          strokeJoin="round"
          antiAlias
        />
      </Group>
    </Canvas>
  );
}

function phaseAt(seconds: number): Phase {
  if (seconds < BASELINE_SECONDS) return "baseline";
  if (seconds < BASELINE_SECONDS + STATIC_SECONDS) return "static";
  if (seconds < BASELINE_SECONDS + STATIC_SECONDS + ANIMATED_SECONDS) {
    return "animated";
  }
  return "unmounted";
}

export default function App() {
  const [automaticPhase, setAutomaticPhase] = useState<Phase>("baseline");
  const [manualPhase, setManualPhase] = useState<Phase | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(seconds);
      setAutomaticPhase(phaseAt(seconds));
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const phase = manualPhase ?? automaticPhase;
  const mounted = phase === "static" || phase === "animated";

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Skia animated path mask churn</Text>
        <Text style={styles.metric}>Phase: {phase}</Text>
        <Text style={styles.metric}>Elapsed: {elapsed}s</Text>
        <Text style={styles.detail}>
          One 900-segment immutable path. Only the animated phase changes a
          subpixel transform at display cadence.
        </Text>
        <View style={styles.buttons}>
          <Button title="Static" onPress={() => setManualPhase("static")} />
          <Button title="Animate" onPress={() => setManualPhase("animated")} />
          <Button title="Unmount" onPress={() => setManualPhase("unmounted")} />
        </View>
      </View>
      {mounted ? <DensePathScene animated={phase === "animated"} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 16,
    backgroundColor: "#080d19",
  },
  card: {
    width: CANVAS_WIDTH,
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#151d30",
  },
  title: {
    color: "white",
    fontSize: 21,
    fontWeight: "700",
  },
  metric: {
    color: "#9ee7ff",
    fontSize: 16,
    fontVariant: ["tabular-nums"],
  },
  detail: {
    color: "#c4ccdf",
    fontSize: 14,
    lineHeight: 20,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: "#111827",
  },
});
