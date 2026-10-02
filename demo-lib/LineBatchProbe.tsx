import { useState } from "react";
import { Text } from "react-native";
import { Skia } from "@shopify/react-native-skia";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useChartPaths } from "../packages/react-native-livechart/src/hooks/useChartPaths";
import type {
  ChartEngineEdge,
  ChartEngineScroll,
  SingleEngineState,
} from "../packages/react-native-livechart/src/core/useLiveChartEngine";

/** Actual hook check: threshold-only changes must retain line/fill outputs. */
export function LineBatchProbe() {
  const data = useSharedValue([
    { time: 980, value: 1 },
    { time: 990, value: 4 },
    { time: 1000, value: 2 },
  ]);
  const displayValue = useSharedValue(2),
    edgeValue = useSharedValue(2),
    viewEnd = useSharedValue<number | null>(1000);
  const displayMin = useSharedValue(0),
    displayMax = useSharedValue(5),
    displayWindow = useSharedValue(20);
  const canvasWidth = useSharedValue(300),
    canvasHeight = useSharedValue(200),
    timestamp = useSharedValue(1000),
    threshold = useSharedValue(60);
  const engine = {
    data,
    displayValue,
    edgeValue,
    viewEnd,
    displayMin,
    displayMax,
    displayWindow,
    canvasWidth,
    canvasHeight,
    timestamp,
  } as SingleEngineState & ChartEngineScroll & ChartEngineEdge;
  const paths = useChartPaths(
    engine,
    { left: 0, right: 0, top: 0, bottom: 10 },
    undefined,
    threshold,
  );
  const lastLine = useSharedValue(Skia.Path.Make()),
    lastFill = useSharedValue(Skia.Path.Make());
  const frame = useSharedValue(0),
    stable = useSharedValue(0),
    mismatches = useSharedValue(0);
  const [result, setResult] = useState("Checking threshold-only updates…");
  useFrameCallback(() => {
    const i = frame.get();
    if (i >= 120) return;
    frame.set(i + 1);
    if (i > 2 && i !== 31 && i !== 61 && i !== 91) {
      stable.set(stable.get() + 1);
      if (
        lastLine.get() !== paths.linePath.get() ||
        lastFill.get() !== paths.fillPath.get()
      )
        mismatches.set(mismatches.get() + 1);
    }
    lastLine.set(paths.linePath.get());
    lastFill.set(paths.fillPath.get());
    threshold.set(40 + i);
    if (i === 30)
      data.set([
        { time: 980, value: 3 },
        { time: 990, value: 1 },
        { time: 1000, value: 4 },
      ]);
    if (i === 60) data.set([]);
    if (i === 90)
      data.set([
        { time: 980, value: 2 },
        { time: 990, value: 4 },
        { time: 1000, value: 1 },
      ]);
    if (i === 119)
      scheduleOnRN(
        setResult,
        JSON.stringify({
          lineRetentionChecks: stable.get(),
          mismatches: mismatches.get(),
        }),
      );
  });
  return (
    <Text selectable style={{ fontSize: 11, marginVertical: 8 }}>
      {result}
    </Text>
  );
}
