import { Canvas, Group, Path, Skia } from "@shopify/react-native-skia";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { isUIRuntime } from "react-native-worklets";
import { usePathBuilders } from "../packages/react-native-livechart/src/hooks/usePathBuilder";
import {
  baselineCandlePaths,
  candleFixture,
  type CandleArgs,
} from "./candle-work-benchmark";
import {
  buildCandleBatch,
  makeCandleBatchScratch,
} from "./candle-batch-prototype";

/** Both panels receive identical moving inputs; four draw paths per panel. */
export function CandleWorkPreview({
  rounded,
  dense,
  enabled,
}: {
  rounded: boolean;
  dense: boolean;
  enabled: boolean;
}) {
  const [width, setWidth] = useState(370);
  const empty = useMemo(() => Skia.Path.Make(), []);
  const clock = useSharedValue(0);
  const source = useSharedValue(candleFixture(40, 0));
  const oldBuilders = usePathBuilders(4);
  const newBuilders = usePathBuilders(4);
  const scratch = useDerivedValue(() =>
    makeCandleBatchScratch(newBuilders.get()),
  );
  useFrameCallback((info) => {
    if (enabled) clock.set(info.timestamp / 1000);
  });
  const pair = useDerivedValue(() => {
    // Reanimated evaluates an initializer on the React runtime too. Mutable
    // scratch belongs to UI; do not mutate its serialized JS snapshot there.
    if (!isUIRuntime())
      return {
        before: [empty, empty, empty, empty],
        after: [empty, empty, empty, empty],
      };
    const time = clock.get();
    const args: CandleArgs = [...source.get()];
    const price =
      100 +
      35 * Math.sin(time * 2) +
      450 * Math.pow(Math.max(0, Math.sin(time * 0.8)), 18);
    args[1] = {
      time: 6000,
      open: 100,
      close: price,
      low: Math.min(90, price),
      high: Math.max(120, price),
    };
    args[3] = width;
    args[4] = 150;
    args[5] = 6000 - (dense ? 200 : 40) + Math.sin(time * 0.7) * 0.4;
    args[6] = (dense ? 200 : 40) + 2;
    args[7] = 50;
    args[8] = Math.max(150, price + 30);
    args[10] = { ...args[10]!, bodyRadius: rounded ? 3 : 0 };
    return {
      before: baselineCandlePaths(oldBuilders.get(), args),
      after: buildCandleBatch(scratch.get(), ...args),
    };
  });
  const b0 = useDerivedValue(() => pair.get().before[0]);
  const b1 = useDerivedValue(() => pair.get().before[1]);
  const b2 = useDerivedValue(() => pair.get().before[2]);
  const b3 = useDerivedValue(() => pair.get().before[3]);
  const a0 = useDerivedValue(() => pair.get().after[0]);
  const a1 = useDerivedValue(() => pair.get().after[1]);
  const a2 = useDerivedValue(() => pair.get().after[2]);
  const a3 = useDerivedValue(() => pair.get().after[3]);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Text style={{ fontSize: 12, color: "#41534c", paddingLeft: 10 }}>
        Main · four batched paths
      </Text>
      <Canvas style={{ width, height: 150 }}>
        <Path path={b0} color="#16a36c" />
        <Path path={b1} color="#e54a55" />
        <Path path={b2} color="#16a36c" style="stroke" strokeWidth={1} />
        <Path path={b3} color="#e54a55" style="stroke" strokeWidth={1} />
      </Canvas>
      <Text style={{ fontSize: 12, color: "#41534c", paddingLeft: 10 }}>
        One pass · same four batched paths
      </Text>
      <Canvas style={{ width, height: 150 }}>
        <Group>
          <Path path={a0} color="#16a36c" />
          <Path path={a1} color="#e54a55" />
          <Path path={a2} color="#16a36c" style="stroke" strokeWidth={1} />
          <Path path={a3} color="#e54a55" style="stroke" strokeWidth={1} />
        </Group>
      </Canvas>
    </View>
  );
}
