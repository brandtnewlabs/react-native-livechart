import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  LiveChart,
  type LiveChartFrameStats,
  type LiveChartPoint,
  type ReferenceLine,
} from "react-native-livechart";
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const WINDOW_SECONDS = 60;
const INITIAL_VALUE = 100;

type Row =
  | { id: "chart"; kind: "chart" }
  | { id: "sticky"; kind: "sticky" }
  | { id: string; kind: "row"; index: number };

const ROWS: Row[] = [
  { id: "chart", kind: "chart" },
  { id: "sticky", kind: "sticky" },
  ...Array.from({ length: 80 }, (_, index) => ({
    id: `row-${index}`,
    kind: "row" as const,
    index,
  })),
];

function FrameRateReadout({
  stats,
}: {
  stats: SharedValue<LiveChartFrameStats>;
}) {
  const [readout, setReadout] = useState("sampling…");
  const lastSample = useSharedValue({
    timestamp: 0,
    published: 0,
    skipped: 0,
  });

  useFrameCallback(({ timestamp }) => {
    "worklet";
    const previous = lastSample.get();
    if (previous.timestamp === 0) {
      lastSample.set({ timestamp, published: 0, skipped: 0 });
      return;
    }
    const elapsed = timestamp - previous.timestamp;
    if (elapsed < 1000) return;

    const current = stats.get();
    const seconds = elapsed / 1000;
    const publishedPerSecond =
      (current.published - previous.published) / seconds;
    const skippedPerSecond = (current.skipped - previous.skipped) / seconds;
    scheduleOnRN(
      setReadout,
      `${publishedPerSecond.toFixed(1)} published/s · ${skippedPerSecond.toFixed(1)} skipped/s`,
    );
    lastSample.set({
      timestamp,
      published: current.published,
      skipped: current.skipped,
    });
  });

  return <Text style={styles.stats}>{readout}</Text>;
}

function ReproChart({
  isChartFrameLoopActive,
}: {
  isChartFrameLoopActive: SharedValue<boolean>;
}) {
  const [initialNow] = useState(() => Date.now() / 1000);
  const data = useSharedValue<LiveChartPoint[]>(
    Array.from({ length: 60 }, (_, index) => ({
      time: initialNow - 59 + index,
      value: INITIAL_VALUE + Math.sin(index / 6),
    })),
  );
  const value = useSharedValue(INITIAL_VALUE);
  const frameStats = useSharedValue<LiveChartFrameStats>({
    frames: 0,
    published: 0,
    skipped: 0,
  });
  const [referenceValue, setReferenceValue] = useState(INITIAL_VALUE);

  useEffect(() => {
    const interval = setInterval(() => {
      const time = Date.now() / 1000;
      const nextValue =
        INITIAL_VALUE + Math.sin(time / 2) + Math.sin(time / 7) * 0.3;
      value.set(nextValue);
      data.modify((points) => {
        "worklet";
        points.push({ time, value: nextValue });
        while (points.length > 600) points.shift();
        return points;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [data, value]);

  const referenceLines = useMemo<ReferenceLine[]>(
    () => [
      {
        value: referenceValue,
        label: "Drag me",
        color: "#f6c85f",
        draggable: true,
        snap: 0.1,
        bounds: [95, 105],
        onChange: setReferenceValue,
      },
    ],
    [referenceValue],
  );

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.title}>LiveChart scroll reproduction</Text>
        <FrameRateReadout stats={frameStats} />
      </View>
      <View style={styles.chart}>
        <LiveChart
          data={data}
          value={value}
          timeWindow={WINDOW_SECONDS}
          pulse
          timeScroll
          zoom
          referenceLines={referenceLines}
          isFrameLoopActive={isChartFrameLoopActive}
          debugFrameStats={frameStats}
          theme="dark"
        />
      </View>
    </View>
  );
}

export default function App() {
  const [gateDuringScroll, setGateDuringScroll] = useState(false);
  const isChartFrameLoopActive = useSharedValue(true);

  useEffect(() => {
    if (!gateDuringScroll) isChartFrameLoopActive.set(true);
  }, [gateDuringScroll, isChartFrameLoopActive]);

  const setScrolling = (isScrolling: boolean) => {
    if (gateDuringScroll) isChartFrameLoopActive.set(!isScrolling);
  };

  const toggleGate = useCallback(() => {
    setGateDuringScroll((current) => !current);
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Row>) => {
      if (item.kind === "chart") {
        return <ReproChart isChartFrameLoopActive={isChartFrameLoopActive} />;
      }
      if (item.kind === "sticky") {
        return (
          <View style={styles.sticky}>
            <Text style={styles.stickyText}>Sticky market header</Text>
            <Pressable style={styles.button} onPress={toggleGate}>
              <Text style={styles.buttonText}>
                Scroll gate: {gateDuringScroll ? "on" : "off"}
              </Text>
            </Pressable>
          </View>
        );
      }
      return (
        <View style={styles.row}>
          <Text style={styles.rowText}>Market activity row {item.index + 1}</Text>
        </View>
      );
    },
    [gateDuringScroll, isChartFrameLoopActive, toggleGate],
  );

  return (
    <GestureHandlerRootView style={styles.screen}>
      <FlashList
        data={ROWS}
        getItemType={(row) => row.kind}
        keyExtractor={(row) => row.id}
        stickyHeaderIndices={[1]}
        onScrollBeginDrag={() => setScrolling(true)}
        onMomentumScrollBegin={() => setScrolling(true)}
        onMomentumScrollEnd={() => setScrolling(false)}
        onScrollEndDrag={(event) => {
          if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.01) {
            setScrolling(false);
          }
        }}
        renderItem={renderItem}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#080a0f" },
  chartCard: { height: 430, paddingTop: 60, backgroundColor: "#10141d" },
  chartHeader: { paddingHorizontal: 16, gap: 6 },
  title: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  stats: { color: "#8ca0ba", fontVariant: ["tabular-nums"] },
  chart: { flex: 1, marginTop: 12 },
  sticky: {
    height: 64,
    paddingHorizontal: 16,
    backgroundColor: "#171d29",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stickyText: { color: "#ffffff", fontWeight: "700" },
  button: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#2b3548" },
  buttonText: { color: "#d8e2f0", fontSize: 12 },
  row: {
    height: 64,
    marginHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#263044",
    justifyContent: "center",
  },
  rowText: { color: "#d8e2f0" },
});
