import { LineBatchProbe } from "../../demo-lib/LineBatchProbe";
import { VolumeRangeProbe } from "../../demo-lib/VolumeRangeProbe";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { runWorkBenchmark } from "../../demo-lib/volume-line-benchmark";
export default function VolumeLineWork() {
  const [result, setResult] = useState("Ready");
  const [raw, setRaw] = useState(false);
  const measurement = result.startsWith("{")
    ? (JSON.parse(result) as ReturnType<typeof runWorkBenchmark>)
    : null;
  const median = (a: number[]) =>
    [...a].sort((a, b) => a - b)[Math.floor(a.length / 2)].toFixed(3);
  const run = () => {
    setResult("Measuring…");
    scheduleOnUI(() => {
      "worklet";
      const r = runWorkBenchmark();
      scheduleOnRN(setResult, JSON.stringify(r));
    });
  };
  return (
    <DemoScreen
      title="Volume and line work"
      description="Native UI-runtime rebuild measurements"
      docs="guides/volume-line-work"
      chart={<View />}
      chartWrapperStyle={{ height: 1 }}
    >
      <Pressable
        accessibilityRole="button"
        disabled={result === "Measuring…"}
        onPress={run}
        style={{ padding: 16, backgroundColor: "#eeebff" }}
      >
        <Text>Run measurements</Text>
      </Pressable>
      <Link
        href="/demo/volume-line-qa"
        style={{ marginVertical: 12, color: "#3822db" }}
      >
        Open live QA charts ↗
      </Link>
      <VolumeRangeProbe />
      <LineBatchProbe />
      {measurement ? (
        <View>
          <Text>
            {measurement.checked} native path checks · {measurement.mismatches}{" "}
            mismatches
          </Text>
          <Text style={{ fontWeight: "600", marginVertical: 8 }}>
            Count · workload · before / after (ms)
          </Text>
          {measurement.results.map((r) => (
            <Text
              key={`${r.count}-${r.kind}`}
              style={{ fontSize: 12, marginVertical: 3 }}
            >
              {r.count} · {r.kind} · {median(r.before)} / {median(r.after)}
            </Text>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => setRaw((v) => !v)}
            style={{ paddingVertical: 12 }}
          >
            <Text>{raw ? "Hide samples" : "Show raw samples"}</Text>
          </Pressable>
        </View>
      ) : null}
      <Text selectable style={{ fontSize: 11, marginTop: 12 }}>
        {measurement && !raw
          ? "Nine rotated rounds; timings exclude rendering and mapper scheduling."
          : result}
      </Text>
    </DemoScreen>
  );
}
