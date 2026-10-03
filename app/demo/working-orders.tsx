import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import {
  LiveChart,
  type ReferenceLine,
  type ReferenceLineRenderProps,
} from "react-native-livechart";

import { AnimatedTrendTextInput } from "../../demo-lib/AnimatedTrendTextInput";
import { Chip, ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

const START = 100;
const BUY_COLOR = "#34d399";
const SELL_COLOR = "#f87171";
// Explicit horizontal insets keep the tag anchors stable when time scrolling
// switches the Y-axis between its floating and gutter layouts.
const CHART_INSETS = { left: 12, right: 80 };
const TAG_INSET = 2;
const GRAB_SLOP = 8;

type Side = "BUY" | "SELL";
type AlertPosition = "visible" | "above" | "below";

const ALERT_LEVELS: Record<AlertPosition, number[]> = {
  visible: [1.055, 1.07, 1.085],
  above: [2, 2.2, 2.4],
  below: [0.4, 0.3, 0.2],
};

type LogEvent = {
  id: number;
  message: string;
};

/**
 * Custom draggable order tag (`renderReferenceLine`) — a glassy RN pill whose price
 * tracks `ctx.value` as you drag via {@link AnimatedTrendTextInput}.
 */
function OrderTag({
  ctx,
  onWidth,
}: {
  ctx: ReferenceLineRenderProps;
  onWidth: (width: number) => void;
}) {
  const color = ctx.line.color ?? "#fff";
  // Drive the tag chrome off `ctx.dragging` (UI thread) — brightens while held.
  const animatedStyle = useAnimatedStyle(() => ({
    borderWidth: ctx.dragging.get() ? 2 : 1,
    opacity: ctx.dragging.get() ? 1 : 0.92,
  }));
  return (
    <Animated.View
      onLayout={(event) => onWidth(event.nativeEvent.layout.width)}
      style={[styles.tag, { borderColor: color }, animatedStyle]}
    >
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
  const [tagOnly, setTagOnly] = useState(true);
  const [timeScroll, setTimeScroll] = useState(false);
  const [candlestick, setCandlestick] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | undefined>();
  const paused = pausedAt !== undefined;
  const [chartWidth, setChartWidth] = useState(0);
  const [buyTagWidth, setBuyTagWidth] = useState(100);
  const [sellTagWidth, setSellTagWidth] = useState(100);
  const [offAxisOrders, setOffAxisOrders] = useState(false);
  const [alertPosition, setAlertPosition] = useState<AlertPosition>("visible");
  const [plainAlert, setPlainAlert] = useState(false);

  // Committed order prices (set by onCommit → controlled lines).
  const [buy, setBuy] = useState(() => round(START * 0.97));
  const [sell, setSell] = useState(() => round(START * 1.03));

  // Live drag feedback (from onChange, throttled) + an event log (discrete events).
  const [live, setLive] = useState<{ side: Side; value: number } | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const lastChangeAt = useRef(0);
  const scrubbing = useRef(false);

  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: true,
    candleWidth: 1,
    paused,
    tradeStream: false,
    startValue: START,
    historySpanSeconds: 180,
    historyRange: "5m",
  });

  const log = (message: string) => {
    setEvents((prev) =>
      [{ id: (prev[0]?.id ?? -1) + 1, message }, ...prev].slice(0, 5),
    );
  };

  const placeOrders = (edge: "above" | "below") => {
    setBuy(START * (edge === "above" ? 2 : 0.4));
    setSell(START * (edge === "above" ? 2.2 : 0.3));
    setOffAxisOrders(true);
    setLive(null);
    log(`Orders ${edge} chart — drag the pinned tags back in`);
  };

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
      id: "buy-order",
      value: buy,
      label: "BUY",
      color: BUY_COLOR,
      draggable: true,
      excludeFromRange: offAxisOrders,
      snap: 0.05,
      bounds: [START * 0.9, START], // drag to either end → onDragOut / onDragIn
      badge: { position: "left" },
      grabRange: tagOnly
        ? [0, CHART_INSETS.left + TAG_INSET + buyTagWidth + GRAB_SLOP]
        : undefined,
      ...handlers("BUY", setBuy),
    },
    {
      id: "sell-order",
      value: sell,
      label: "SELL",
      color: SELL_COLOR,
      draggable: true,
      excludeFromRange: offAxisOrders,
      snap: 0.05,
      bounds: [START, START * 1.1],
      badge: { position: "right" },
      grabRange: tagOnly
        ? [
            Math.max(
              0,
              chartWidth - CHART_INSETS.right - TAG_INSET - sellTagWidth - GRAB_SLOP,
            ),
            Math.max(0, chartWidth - CHART_INSETS.right - TAG_INSET + GRAB_SLOP),
          ]
        : undefined,
      ...handlers("SELL", setSell),
    },
    // Center badge with style/shape knobs (border, text color, radius, weight).
    {
      value: START,
      label: "VWAP",
      color: "#fbbf24",
      badge: {
        position: "center",
        borderColor: "#fbbf24",
        textColor: "#fbbf24",
        radius: 10,
        fontWeight: "700",
      },
    },
    // Badge-less line: plain gutter label when custom is off, PlainTag when on.
    { value: START * 1.04, label: "Stop", color: "#94a3b8" },
    // Off-axis alerts are excluded from the fit so their tags pin to an edge.
    ...ALERT_LEVELS[alertPosition].map((level, index) => ({
      id: `alert-${index}`,
      value: START * level,
      label: "alert",
      color: "#a855f7",
      badge: true,
      excludeFromRange: alertPosition !== "visible",
    })),
    ...(plainAlert ? [{
      id: "plain-alert",
      value: START * ALERT_LEVELS[alertPosition][0],
      label: "Plain alert",
      color: "#a855f7",
      excludeFromRange: alertPosition !== "visible",
    }] : []),
  ];

  const renderReferenceLine = (ctx: ReferenceLineRenderProps) => {
    if (ctx.line.draggable) {
      return (
        <OrderTag
          ctx={ctx}
          onWidth={ctx.line.label === "BUY" ? setBuyTagWidth : setSellTagWidth}
        />
      );
    }
    if (ctx.line.label === "Stop") return <PlainTag ctx={ctx} />;
    return null; // VWAP + alerts keep their built-in tags
  };

  return (
    <DemoScreen
      title="Working orders"
      docs="guides/reference-lines-and-bands"
      description="Drag the BUY / SELL tags to set a price. In Tag only mode, the rest of each line stays free for scrubbing or time scrolling. Keep dragging after leaving a tag to check ownership."
      chart={
        <View
          style={styles.chart}
          onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
        >
          <LiveChart
            data={data}
            value={value}
            mode={candlestick ? "candle" : "line"}
            candles={candlestick ? candles : undefined}
            liveCandle={candlestick ? liveCandle : undefined}
            candleWidth={1}
            timeWindow={30}
            timeScroll={
              timeScroll ? { gesture: "holdToScrub", fling: false } : false
            }
            paused={paused}
            // Keep the same live edge when toggling gestures or chart mode
            // while the feed is paused, rather than advancing past its data.
            nowOverride={pausedAt}
            insets={CHART_INSETS}
            accentColor={ACCENT}
            theme={APP_THEME}
            referenceLines={referenceLines}
            referenceLineGrouping={
              grouping
                ? {
                    radius: 26,
                    // Count pill takes the same style/shape config as a line badge.
                    badge: {
                      icon: "⚠",
                      borderColor: "#a855f7",
                      textColor: "#a855f7",
                      fontWeight: "700",
                    },
                    format: (n) => {
                      "worklet";
                      return `${n} alerts`;
                    },
                  }
                : false
            }
            renderReferenceLine={custom ? renderReferenceLine : undefined}
            onScrub={(point) => {
              if (point && !scrubbing.current) log("Scrub started");
              if (!point && scrubbing.current) log("Scrub ended");
              scrubbing.current = point != null;
            }}
          />
        </View>
      }
    >
      <ControlRow label="Grab orders">
        <Chip
          label="Tag only"
          active={tagOnly}
          onPress={() => {
            setCustom(true);
            setTagOnly(true);
          }}
        />
        <Chip label="Whole line" active={!tagOnly} onPress={() => setTagOnly(false)} />
      </ControlRow>
      <Text style={styles.hint}>
        {timeScroll
          ? "Swipe horizontally through an order line, away from its tag, to browse history. Turn Time scroll off to test scrubbing."
          : "Scrub across an order line away from its tag. The order price should stay unchanged. Turn Time scroll on to test panning."}
      </Text>
      <ControlRow label="Chart">
        <ToggleChip label="Time scroll" value={timeScroll} onChange={setTimeScroll} />
        <ToggleChip label="Candles" value={candlestick} onChange={setCandlestick} />
        <ToggleChip
          label="Pause feed"
          value={paused}
          onChange={(enabled) => setPausedAt(enabled ? Date.now() / 1000 : undefined)}
        />
      </ControlRow>
      <ControlRow label="Order position">
        <Chip label="Orders above" active={false} onPress={() => placeOrders("above")} />
        <Chip label="Orders below" active={false} onPress={() => placeOrders("below")} />
        <Chip
          label="Reset orders"
          active={false}
          onPress={() => {
            setBuy(round(START * 0.97));
            setSell(round(START * 1.03));
            setLive(null);
            setEvents([]);
            setOffAxisOrders(false);
          }}
        />
      </ControlRow>
      <ControlRow label="Reference lines">
        <ToggleChip
          label="Custom tags"
          value={custom}
          onChange={(enabled) => {
            setCustom(enabled);
            if (!enabled) setTagOnly(false);
          }}
        />
        <ToggleChip
          label="Group alerts"
          value={grouping}
          onChange={setGrouping}
        />
        <ToggleChip label="Plain alert" value={plainAlert} onChange={setPlainAlert} />
      </ControlRow>
      <ChipRow<AlertPosition>
        label="Alert position"
        options={[
          { label: "In chart", value: "visible" },
          { label: "Above chart", value: "above" },
          { label: "Below chart", value: "below" },
        ]}
        value={alertPosition}
        onChange={setAlertPosition}
      />
      {alertPosition !== "visible" ? (
        <Text style={styles.hint}>
          With Group alerts on, the three pinned badges collapse into one count.
          Plain alert has no off-chart badge, so the count should stay at 3.
        </Text>
      ) : null}

      <OrderFeedback buy={buy} sell={sell} live={live} events={events} />
    </DemoScreen>
  );
}

function OrderFeedback({ buy, sell, live, events }: {
  buy: number;
  sell: number;
  live: { side: Side; value: number } | null;
  events: LogEvent[];
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <OrderStat side="BUY" color={BUY_COLOR} committed={buy} live={live} />
        <OrderStat
          side="SELL"
          color={SELL_COLOR}
          committed={sell}
          live={live}
        />
      </View>
      <Text style={styles.logTitle}>Interactions</Text>
      {events.length === 0 ? (
        <Text style={styles.logEmpty}>
          Drag a tag and release, or scrub away from it. Events appear here.
        </Text>
      ) : (
        events.map((event) => (
          <Text key={event.id} style={styles.logLine}>
            {event.message}
          </Text>
        ))
      )}
    </View>
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
  chart: { flex: 1 },
  hint: { fontSize: 12, lineHeight: 18, color: colors.textMuted, marginBottom: 12 },
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
