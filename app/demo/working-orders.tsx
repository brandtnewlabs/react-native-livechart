import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import {
  LiveChart,
  type ReferenceLine,
  type ReferenceLineRenderProps,
} from "react-native-livechart";

import { AnimatedTrendTextInput } from "../../demo-lib/AnimatedTrendTextInput";
import { ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Working orders" };

const START = 100;
const BUY_COLOR = "#34d399";
const SELL_COLOR = "#f87171";

type Side = "BUY" | "SELL";

/**
 * Custom draggable order tag (`renderReferenceLine`) — a glassy RN pill whose price
 * updates live on the UI thread as you drag, bound to `ctx.value` via
 * {@link AnimatedTrendTextInput} (no JS re-render per frame).
 */
function OrderTag({ ctx }: { ctx: ReferenceLineRenderProps }) {
  const color = ctx.line.color ?? "#fff";
  // Drive the tag chrome off `ctx.dragging` (UI thread) — brightens while held.
  const animatedStyle = useAnimatedStyle(() => ({
    borderWidth: ctx.dragging.get() ? 2 : 1,
    opacity: ctx.dragging.get() ? 1 : 0.92,
  }));
  return (
    <Animated.View style={[styles.tag, { borderColor: color }, animatedStyle]}>
      <Text style={[styles.tagSide, { color }]}>{ctx.line.label}</Text>
      <AnimatedTrendTextInput
        sharedValue={ctx.value}
        maximumFractionDigits={2}
        baseColor="#e5e7eb"
        style={styles.tagPrice}
      />
    </Animated.View>
  );
}

/** Custom replacement for a plain (badge-less) line's gutter label. */
function PlainTag({ ctx }: { ctx: ReferenceLineRenderProps }) {
  return (
    <View style={styles.plainTag}>
      <Text style={styles.plainTagText}>⛔ {ctx.line.label}</Text>
    </View>
  );
}

export default function WorkingOrdersScreen() {
  const [custom, setCustom] = useState(true);
  const [grouping, setGrouping] = useState(false);

  // Committed order prices (set by onCommit → controlled lines).
  const [buy, setBuy] = useState(round(START * 0.97));
  const [sell, setSell] = useState(round(START * 1.03));

  // Live drag feedback (from onChange, throttled) + an event log (discrete events).
  const [live, setLive] = useState<{ side: Side; value: number } | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const lastChangeAt = useRef(0);

  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    startValue: START,
    historySpanSeconds: 40,
    historyRange: "1m",
  });

  const log = (msg: string) =>
    setEvents((prev) => [msg, ...prev].slice(0, 5));

  /** Build the per-line drag callbacks for one side. */
  const handlers = (side: Side, commit: (v: number) => void) => ({
    onChange: (v: number) => {
      // Throttle the live readout so the JS panel re-renders ~10×/s, not per frame.
      const now = Date.now();
      if (now - lastChangeAt.current < 100) return;
      lastChangeAt.current = now;
      setLive({ side, value: v });
    },
    onCommit: (v: number) => {
      commit(v);
      setLive(null);
      log(`✓ commit ${side} @ ${v.toFixed(2)}`);
    },
    onDragIn: (v: number) => log(`▶ ${side} back in range @ ${v.toFixed(2)}`),
    onDragOut: (v: number) => log(`◀ ${side} hit bound @ ${v.toFixed(2)}`),
  });

  const referenceLines: ReferenceLine[] = [
    {
      value: buy,
      label: "BUY",
      color: BUY_COLOR,
      draggable: true,
      snap: 0.05,
      bounds: [START * 0.9, START], // drag to either end → onDragOut / onDragIn
      badge: { position: "left" },
      ...handlers("BUY", setBuy),
    },
    {
      value: sell,
      label: "SELL",
      color: SELL_COLOR,
      draggable: true,
      snap: 0.05,
      bounds: [START, START * 1.1],
      badge: { position: "right" },
      ...handlers("SELL", setSell),
    },
    // Center badge placement (non-draggable).
    { value: START, label: "VWAP", color: "#fbbf24", badge: { position: "center" } },
    // Badge-less line: plain gutter label when custom is off, PlainTag when on.
    { value: START * 1.04, label: "Stop", color: "#94a3b8" },
    // A tight stack of alerts → collapses into one count handle when grouping is on.
    { value: START * 1.055, label: "alert", color: "#a855f7", badge: true },
    { value: START * 1.07, label: "alert", color: "#a855f7", badge: true },
    { value: START * 1.085, label: "alert", color: "#a855f7", badge: true },
  ];

  const renderReferenceLine = (ctx: ReferenceLineRenderProps) => {
    if (ctx.line.draggable) return <OrderTag ctx={ctx} />;
    if (ctx.line.label === "Stop") return <PlainTag ctx={ctx} />;
    return null; // VWAP + alerts keep their built-in tags
  };

  return (
    <DemoScreen
      title="Working orders"
      docs="guides/markers-and-references"
      description="Drag BUY / SELL to set a price (snap 0.05, clamped to bounds). Watch the live value, committed value, and the drag-callback log. Toggle custom RN tags and near-value grouping."
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          referenceLines={referenceLines}
          referenceLineGrouping={grouping ? { radius: 26 } : false}
          renderReferenceLine={custom ? renderReferenceLine : undefined}
          scrub={false}
        />
      }
    >
      <ControlRow label="Reference lines">
        <ToggleChip label="Custom tags" value={custom} onChange={setCustom} />
        <ToggleChip label="Group alerts" value={grouping} onChange={setGrouping} />
      </ControlRow>

      <View style={styles.panel}>
        <View style={styles.row}>
          <OrderStat side="BUY" color={BUY_COLOR} committed={buy} live={live} />
          <OrderStat side="SELL" color={SELL_COLOR} committed={sell} live={live} />
        </View>
        <Text style={styles.logTitle}>Drag callbacks</Text>
        {events.length === 0 ? (
          <Text style={styles.logEmpty}>
            Drag an order to a bound, then release — events appear here.
          </Text>
        ) : (
          events.map((e, i) => (
            <Text key={`${e}-${i}`} style={styles.logLine}>
              {e}
            </Text>
          ))
        )}
      </View>
    </DemoScreen>
  );
}

function OrderStat({
  side,
  color,
  committed,
  live,
}: {
  side: Side;
  color: string;
  committed: number;
  live: { side: Side; value: number } | null;
}) {
  const dragging = live?.side === side;
  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.statSide, { color }]}>{side}</Text>
        {dragging ? <Text style={styles.dragging}>● dragging</Text> : null}
      </View>
      <Text style={styles.statValue}>
        {(dragging ? live!.value : committed).toFixed(2)}
      </Text>
      <Text style={styles.statSub}>
        {dragging ? "onChange (live)" : "onCommit (committed)"}
      </Text>
    </View>
  );
}

const round = (v: number) => Math.round(v / 0.05) * 0.05;

const styles = StyleSheet.create({
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  tagSide: { fontSize: 11, fontWeight: "700" },
  tagPrice: { fontSize: 11, color: "#e5e7eb" },
  plainTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  plainTagText: { fontSize: 11, color: "#334155", fontWeight: "600" },

  panel: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.chipBackground,
    gap: 8,
  },
  row: { flexDirection: "row", gap: 12 },
  stat: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statSide: { fontSize: 12, fontWeight: "700" },
  dragging: { fontSize: 10, color: "#b45309", marginLeft: "auto" },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  statSub: { fontSize: 10, color: colors.textMuted },

  logTitle: { fontSize: 12, fontWeight: "600", color: colors.text },
  logEmpty: { fontSize: 12, color: colors.textMuted },
  logLine: {
    fontSize: 12,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
});
