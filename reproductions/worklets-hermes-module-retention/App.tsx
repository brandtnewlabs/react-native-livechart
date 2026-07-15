import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import {
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

const WORKLET_COUNT = 128;
const BASELINE_SECONDS = 15;
const MOUNTED_SECONDS = 30;

type Phase = "baseline" | "mounted" | "unmounted";

function WorkletBatch({ tick }: { tick: SharedValue<number> }) {
  // Separate call sites intentionally produce distinct worklet hashes.
  useDerivedValue(() => tick.value + 0);
  useDerivedValue(() => tick.value + 1);
  useDerivedValue(() => tick.value + 2);
  useDerivedValue(() => tick.value + 3);
  useDerivedValue(() => tick.value + 4);
  useDerivedValue(() => tick.value + 5);
  useDerivedValue(() => tick.value + 6);
  useDerivedValue(() => tick.value + 7);
  useDerivedValue(() => tick.value + 8);
  useDerivedValue(() => tick.value + 9);
  useDerivedValue(() => tick.value + 10);
  useDerivedValue(() => tick.value + 11);
  useDerivedValue(() => tick.value + 12);
  useDerivedValue(() => tick.value + 13);
  useDerivedValue(() => tick.value + 14);
  useDerivedValue(() => tick.value + 15);
  useDerivedValue(() => tick.value + 16);
  useDerivedValue(() => tick.value + 17);
  useDerivedValue(() => tick.value + 18);
  useDerivedValue(() => tick.value + 19);
  useDerivedValue(() => tick.value + 20);
  useDerivedValue(() => tick.value + 21);
  useDerivedValue(() => tick.value + 22);
  useDerivedValue(() => tick.value + 23);
  useDerivedValue(() => tick.value + 24);
  useDerivedValue(() => tick.value + 25);
  useDerivedValue(() => tick.value + 26);
  useDerivedValue(() => tick.value + 27);
  useDerivedValue(() => tick.value + 28);
  useDerivedValue(() => tick.value + 29);
  useDerivedValue(() => tick.value + 30);
  useDerivedValue(() => tick.value + 31);
  useDerivedValue(() => tick.value + 32);
  useDerivedValue(() => tick.value + 33);
  useDerivedValue(() => tick.value + 34);
  useDerivedValue(() => tick.value + 35);
  useDerivedValue(() => tick.value + 36);
  useDerivedValue(() => tick.value + 37);
  useDerivedValue(() => tick.value + 38);
  useDerivedValue(() => tick.value + 39);
  useDerivedValue(() => tick.value + 40);
  useDerivedValue(() => tick.value + 41);
  useDerivedValue(() => tick.value + 42);
  useDerivedValue(() => tick.value + 43);
  useDerivedValue(() => tick.value + 44);
  useDerivedValue(() => tick.value + 45);
  useDerivedValue(() => tick.value + 46);
  useDerivedValue(() => tick.value + 47);
  useDerivedValue(() => tick.value + 48);
  useDerivedValue(() => tick.value + 49);
  useDerivedValue(() => tick.value + 50);
  useDerivedValue(() => tick.value + 51);
  useDerivedValue(() => tick.value + 52);
  useDerivedValue(() => tick.value + 53);
  useDerivedValue(() => tick.value + 54);
  useDerivedValue(() => tick.value + 55);
  useDerivedValue(() => tick.value + 56);
  useDerivedValue(() => tick.value + 57);
  useDerivedValue(() => tick.value + 58);
  useDerivedValue(() => tick.value + 59);
  useDerivedValue(() => tick.value + 60);
  useDerivedValue(() => tick.value + 61);
  useDerivedValue(() => tick.value + 62);
  useDerivedValue(() => tick.value + 63);
  useDerivedValue(() => tick.value + 64);
  useDerivedValue(() => tick.value + 65);
  useDerivedValue(() => tick.value + 66);
  useDerivedValue(() => tick.value + 67);
  useDerivedValue(() => tick.value + 68);
  useDerivedValue(() => tick.value + 69);
  useDerivedValue(() => tick.value + 70);
  useDerivedValue(() => tick.value + 71);
  useDerivedValue(() => tick.value + 72);
  useDerivedValue(() => tick.value + 73);
  useDerivedValue(() => tick.value + 74);
  useDerivedValue(() => tick.value + 75);
  useDerivedValue(() => tick.value + 76);
  useDerivedValue(() => tick.value + 77);
  useDerivedValue(() => tick.value + 78);
  useDerivedValue(() => tick.value + 79);
  useDerivedValue(() => tick.value + 80);
  useDerivedValue(() => tick.value + 81);
  useDerivedValue(() => tick.value + 82);
  useDerivedValue(() => tick.value + 83);
  useDerivedValue(() => tick.value + 84);
  useDerivedValue(() => tick.value + 85);
  useDerivedValue(() => tick.value + 86);
  useDerivedValue(() => tick.value + 87);
  useDerivedValue(() => tick.value + 88);
  useDerivedValue(() => tick.value + 89);
  useDerivedValue(() => tick.value + 90);
  useDerivedValue(() => tick.value + 91);
  useDerivedValue(() => tick.value + 92);
  useDerivedValue(() => tick.value + 93);
  useDerivedValue(() => tick.value + 94);
  useDerivedValue(() => tick.value + 95);
  useDerivedValue(() => tick.value + 96);
  useDerivedValue(() => tick.value + 97);
  useDerivedValue(() => tick.value + 98);
  useDerivedValue(() => tick.value + 99);
  useDerivedValue(() => tick.value + 100);
  useDerivedValue(() => tick.value + 101);
  useDerivedValue(() => tick.value + 102);
  useDerivedValue(() => tick.value + 103);
  useDerivedValue(() => tick.value + 104);
  useDerivedValue(() => tick.value + 105);
  useDerivedValue(() => tick.value + 106);
  useDerivedValue(() => tick.value + 107);
  useDerivedValue(() => tick.value + 108);
  useDerivedValue(() => tick.value + 109);
  useDerivedValue(() => tick.value + 110);
  useDerivedValue(() => tick.value + 111);
  useDerivedValue(() => tick.value + 112);
  useDerivedValue(() => tick.value + 113);
  useDerivedValue(() => tick.value + 114);
  useDerivedValue(() => tick.value + 115);
  useDerivedValue(() => tick.value + 116);
  useDerivedValue(() => tick.value + 117);
  useDerivedValue(() => tick.value + 118);
  useDerivedValue(() => tick.value + 119);
  useDerivedValue(() => tick.value + 120);
  useDerivedValue(() => tick.value + 121);
  useDerivedValue(() => tick.value + 122);
  useDerivedValue(() => tick.value + 123);
  useDerivedValue(() => tick.value + 124);
  useDerivedValue(() => tick.value + 125);
  useDerivedValue(() => tick.value + 126);
  useDerivedValue(() => tick.value + 127);
  return null;
}

export default function App() {
  const tick = useSharedValue(0);
  const [phase, setPhase] = useState<Phase>("baseline");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(seconds);
      tick.value = seconds;

      if (seconds >= BASELINE_SECONDS + MOUNTED_SECONDS) {
        setPhase("unmounted");
      } else if (seconds >= BASELINE_SECONDS) {
        setPhase("mounted");
      }
    }, 250);

    return () => clearInterval(interval);
  }, [tick]);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Worklets Hermes retention</Text>
        <Text style={styles.metric}>Phase: {phase}</Text>
        <Text style={styles.metric}>Elapsed: {elapsed}s</Text>
        <Text style={styles.detail}>
          {WORKLET_COUNT} useDerivedValue hooks mount at {BASELINE_SECONDS}s and
          unmount at {BASELINE_SECONDS + MOUNTED_SECONDS}s.
        </Text>
        <View style={styles.buttons}>
          <Button title="Mount" onPress={() => setPhase("mounted")} />
          <Button title="Unmount" onPress={() => setPhase("unmounted")} />
        </View>
      </View>
      {phase === "mounted" ? <WorkletBatch tick={tick} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0b1020",
  },
  card: {
    gap: 12,
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#171e34",
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "700",
  },
  metric: {
    color: "#9ee7ff",
    fontSize: 18,
    fontVariant: ["tabular-nums"],
  },
  detail: {
    color: "#c4ccdf",
    fontSize: 15,
    lineHeight: 22,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
  },
});
