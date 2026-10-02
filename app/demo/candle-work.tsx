import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Skia } from "@shopify/react-native-skia";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { CandleWorkPreview } from "../../demo-lib/CandleWorkPreview";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import {
  baselineCandlePaths,
  productionCandlePaths,
  candleFixture,
} from "../../demo-lib/candle-work-benchmark";
import {
  buildCandleBatch,
  makeCandleBatchScratch,
} from "../../demo-lib/candle-batch-prototype";
import { buildCandleGeometry } from "../../packages/react-native-livechart/src/draw/candle";

export default function CandleWorkScreen() {
  const [showRaw, setShowRaw] = useState(false);
  const [rounded, setRounded] = useState(false);
  const [dense, setDense] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("Ready");
  const run = () => {
    setRunning(true);
    setResult("Measuring real Skia builders on the UI runtime…");
    scheduleOnUI(() => {
      "worklet";
      const results = [];
      const builders = [
        Skia.PathBuilder.Make(),
        Skia.PathBuilder.Make(),
        Skia.PathBuilder.Make(),
        Skia.PathBuilder.Make(),
      ];
      const candidate = makeCandleBatchScratch([
        Skia.PathBuilder.Make(),
        Skia.PathBuilder.Make(),
        Skia.PathBuilder.Make(),
        Skia.PathBuilder.Make(),
      ]);
      let checked = 0;
      let mismatches = 0;
      for (const count of [40, 200, 1000]) {
        for (const radius of [0, 3]) {
          const args = candleFixture(count, radius);
          for (let i = 0; i < 20; i++) {
            baselineCandlePaths(builders, args);
            buildCandleBatch(candidate, ...args);
            productionCandlePaths(builders, args);
          }
          // Compare native path commands outside the timed loops, including
          // changing Y ranges, viewport edges and the live candle direction.
          for (let i = 0; i < 20; i++) {
            const comparison = [...args] as typeof args;
            comparison[5] += i * 0.037;
            comparison[7] = 30 + i;
            comparison[8] = 140 + i * 3;
            comparison[1] =
              i % 4 === 0
                ? null
                : {
                    time: 6000,
                    open: 100,
                    close: 80 + i * 3,
                    low: 70,
                    high: 145,
                  };
            const before = baselineCandlePaths(builders, comparison);
            const after = buildCandleBatch(candidate, ...comparison);
            const reuse = productionCandlePaths(builders, comparison);
            for (let j = 0; j < 4; j++) {
              checked += 2;
              if (before[j].toSVGString() !== after[j].toSVGString())
                mismatches++;
              if (before[j].toSVGString() !== reuse[j].toSVGString())
                mismatches++;
            }
          }
          const baseline: number[] = [],
            prototype: number[] = [],
            rectOnly: number[] = [];
          for (let round = 0; round < 7; round++) {
            for (let side = 0; side < 3; side++) {
              const variant = (round + side) % 3;
              const start = performance.now();
              for (let i = 0; i < 40; i++) {
                if (variant === 0) baselineCandlePaths(builders, args);
                else if (variant === 1) buildCandleBatch(candidate, ...args);
                else productionCandlePaths(builders, args);
              }
              (variant === 0
                ? baseline
                : variant === 1
                  ? prototype
                  : rectOnly
              ).push((performance.now() - start) / 40);
            }
          }
          results.push({
            count,
            radius,
            visible: buildCandleGeometry(...args).bodies.length,
            baseline,
            prototype,
            rectOnly,
          });
        }
      }
      scheduleOnRN(setResult, JSON.stringify({ checked, mismatches, results }));
      scheduleOnRN(setRunning, false);
    });
  };
  const measurement = result.startsWith("{")
    ? (JSON.parse(result) as {
        checked: number;
        mismatches: number;
        results: {
          count: number;
          radius: number;
          baseline: number[];
          prototype: number[];
          rectOnly: number[];
        }[];
      })
    : null;
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[3].toFixed(3);
  return (
    <DemoScreen
      chart={
        <CandleWorkPreview rounded={rounded} dense={dense} enabled={!running} />
      }
      chartWrapperStyle={{ height: 340 }}
      docs="guides/candle-work"
      title="Candle work benchmark"
      description="UI worklet · real Skia builders · milliseconds per rebuild"
    >
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <Pressable
          accessibilityRole="button"
          style={{ padding: 12, backgroundColor: "#eeebff" }}
          onPress={() => setRounded((v) => !v)}
        >
          <Text>{rounded ? "Sharp bodies" : "Rounded bodies"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={{ padding: 12, backgroundColor: "#eeebff" }}
          onPress={() => setDense((v) => !v)}
        >
          <Text>{dense ? "40 candles" : "200 candles"}</Text>
        </Pressable>
      </View>
      <Text style={{ marginBottom: 10 }}>
        Identical moving inputs and price spikes. Benchmark pauses the preview
        and measures rebuild work, not display FPS.
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={running}
        onPress={run}
        style={{ padding: 16, backgroundColor: "#eeebff" }}
      >
        <Text>Run paired benchmark</Text>
      </Pressable>
      {measurement ? (
        <>
          <Text style={{ marginVertical: 10 }}>
            {measurement.checked} native path comparisons ·{" "}
            {measurement.mismatches} mismatches
          </Text>
          <Text style={{ fontWeight: "600", fontSize: 12 }}>
            Candles · Main / One pass / Production (ms)
          </Text>
          {measurement.results.map((r) => (
            <Text
              key={`${r.count}-${r.radius}`}
              style={{ fontSize: 12, marginTop: 5 }}
            >
              {r.count} {r.radius ? "rounded" : "sharp"} · {median(r.baseline)}{" "}
              / {median(r.prototype)} / {median(r.rectOnly)}
            </Text>
          ))}
          <Pressable
            accessibilityRole="button"
            style={{ paddingVertical: 12 }}
            onPress={() => setShowRaw((v) => !v)}
          >
            <Text>{showRaw ? "Hide raw samples" : "Show raw samples"}</Text>
          </Pressable>
          {showRaw ? (
            <Text selectable style={{ fontSize: 10 }}>
              {result}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={{ marginVertical: 10 }}>{result}</Text>
      )}
    </DemoScreen>
  );
}
