import { useState } from "react";
import { Text } from "react-native";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useVolumeRange } from "../packages/react-native-livechart/src/hooks/useVolumeRange";
import type { CandlePoint } from "../packages/react-native-livechart/src/types";

/** Runs against the actual derived-value graph, including same-object modify. */
export function VolumeRangeProbe() {
  const candles = useSharedValue<CandlePoint[]>(
    Array.from({ length: 100 }, (_, i) => ({
      time: i * 10,
      open: 10,
      high: 20,
      low: 5,
      close: 15,
      volume: i + 1,
    })),
  );
  const time = useSharedValue(995),
    window = useSharedValue(100),
    width = useSharedValue(10);
  const range = useVolumeRange(candles, time, window, width, true);
  const frame = useSharedValue(0),
    checks = useSharedValue(0),
    errors = useSharedValue(0);
  const [result, setResult] = useState("Checking native volume cache…");
  useFrameCallback(() => {
    if (frame.get() >= 240) return;
    const i = frame.get();
    frame.set(i + 1);
    // Read last frame's settled graph before changing inputs for the next frame.
    const source = candles.get();
    let expected = 0;
    for (let j = 0; j < source.length; j++)
      if (
        source[j].time + width.get() >= time.get() - window.get() &&
        source[j].time <= time.get()
      )
        expected = Math.max(expected, source[j].volume ?? 0);
    checks.set(checks.get() + 1);
    if (range.max.get() !== expected) errors.set(errors.get() + 1);
    if (i < 30) time.set(995 + i * 0.01); // gliding without a bucket boundary
    if (i === 30)
      candles.modify((items) => {
        "worklet";
        items[95].volume = 5000;
        return items;
      });
    if (i === 60)
      candles.modify((items) => {
        "worklet";
        items[95].volume = 1;
        return items;
      });
    if (i === 90) time.set(700); // pan out of the former maximum
    if (i === 120) width.set(100); // animated bucket width changes the left bound
    if (i === 150) candles.set([]);
    if (i === 180)
      candles.set([
        { time: 695, open: 1, high: 2, low: 0, close: 1, volume: 333 },
      ]);
    if (i === 210)
      candles.set([
        { time: 695, open: 1, high: 2, low: 0, close: 1, volume: 2 },
      ]);
    if (i === 239)
      scheduleOnRN(
        setResult,
        JSON.stringify({
          checks: checks.get(),
          mismatches: errors.get(),
          scenarios: [
            "fractional scroll",
            "same-object volume spike",
            "same-object maximum decrease",
            "pan",
            "width",
            "empty",
            "restore",
            "same-length replacement",
          ],
        }),
      );
  });
  return (
    <Text selectable style={{ fontSize: 11, marginVertical: 10 }}>
      {result}
    </Text>
  );
}
