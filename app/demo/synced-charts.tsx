import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  LiveChart,
  type CandlePoint,
  type ChartOverlayContext,
  type ChartViewportControl,
  type LiveChartFrameStats,
  type LiveChartHandle,
  type ViewportConfig,
} from "react-native-livechart";
import {
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";

import { Chip, ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import {
  APP_FONT_FAMILY,
  APP_FONT_FAMILY_SEMIBOLD,
} from "../../demo-lib/fonts";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import { aggregateCandles } from "../../sim/generators";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

const WINDOW = 7200;
const PANES = [
  { value: 0, label: "1m leads" },
  { value: 1, label: "15m leads" },
];

// Copy what is actually drawn, including the leader's window easing. Only the
// selected leader writes another pane; separate pairs prevent feedback loops.
function ViewportMirror({
  ctx,
  id,
  leader,
  follower,
}: {
  ctx: ChartOverlayContext;
  id: number;
  leader: SharedValue<number>;
  follower: ChartViewportControl;
}) {
  const { scale } = ctx;
  const { end, window } = follower;
  useAnimatedReaction(
    () => (leader.get() === id ? scale.get() : null),
    (drawn) => {
      if (!drawn || drawn.plot.width <= 0) return;
      cancelAnimation(end);
      cancelAnimation(window);
      end.set(drawn.now);
      window.set(drawn.window);
    },
  );
  return null;
}

export default function SyncedChartsScreen() {
  const [leaderId, setLeaderId] = useState(0);
  const leader = useSharedValue(0);
  const [autoSleep, setAutoSleep] = useState(true);
  const [immediateWidth, setImmediateWidth] = useState(true);
  const [fixedNow, setFixedNow] = useState<number>();
  const [timeWindow, setTimeWindow] = useState(WINDOW);
  const topRef = useRef<LiveChartHandle>(null);
  const bottomRef = useRef<LiveChartHandle>(null);
  const topEnd = useSharedValue<number | null>(null);
  const topWindow = useSharedValue<number | null>(null);
  const bottomEnd = useSharedValue<number | null>(null);
  const bottomWindow = useSharedValue<number | null>(null);
  const topStats = useSharedValue<LiveChartFrameStats>({
    frames: 0,
    published: 0,
    skipped: 0,
  });
  const bottomStats = useSharedValue<LiveChartFrameStats>({
    frames: 0,
    published: 0,
    skipped: 0,
  });
  const topViewport = useMemo<ViewportConfig>(
    () => ({
      end: topEnd,
      window: topWindow,
      windowSmoothing: leaderId === 0 || !immediateWidth,
    }),
    [topEnd, topWindow, leaderId, immediateWidth],
  );
  const bottomViewport = useMemo<ViewportConfig>(
    () => ({
      end: bottomEnd,
      window: bottomWindow,
      windowSmoothing: leaderId === 1 || !immediateWidth,
    }),
    [bottomEnd, bottomWindow, leaderId, immediateWidth],
  );

  const { data, value } = useSimulatedChartData({
    paused: fixedNow !== undefined,
    historySpanSeconds: WINDOW * 3,
    historyRange: "1h",
    maxPoints: 1200,
    startValue: 100,
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    tradesPerSecond: 2,
  });
  // Both timeframes aggregate the same instrument and clock.
  const minuteBars = useDerivedValue(() => aggregateCandles(data.get(), 60));
  const quarterHourBars = useDerivedValue(() =>
    aggregateCandles(data.get(), 900),
  );
  const minuteCandles = useDerivedValue(() => minuteBars.get().candles);
  const minuteLive = useDerivedValue<CandlePoint | null>(
    () => minuteBars.get().liveCandle,
  );
  const quarterCandles = useDerivedValue(() => quarterHourBars.get().candles);
  const quarterLive = useDerivedValue<CandlePoint | null>(
    () => quarterHourBars.get().liveCandle,
  );
  const renderTopOverlay = useCallback(
    (ctx: ChartOverlayContext) => (
      <ViewportMirror
        ctx={ctx}
        id={0}
        leader={leader}
        follower={bottomViewport}
      />
    ),
    [leader, bottomViewport],
  );
  const renderBottomOverlay = useCallback(
    (ctx: ChartOverlayContext) => (
      <ViewportMirror ctx={ctx} id={1} leader={leader} follower={topViewport} />
    ),
    [leader, topViewport],
  );

  const chooseLeader = (id: number) => {
    scheduleOnUI(() => {
      "worklet";
      // A released leader may still have a decay writing its old pair.
      cancelAnimation(topEnd);
      cancelAnimation(bottomEnd);
      leader.set(id);
    });
    setLeaderId(id);
  };
  const common = {
    data,
    value,
    theme: APP_THEME,
    accentColor: ACCENT,
    timeWindow,
    autoSleep,
    nowOverride: fixedNow,
    pulse: false as const,
    scrub: false as const,
    badge: { followViewEdge: true },
    transitions: false as const,
  };

  return (
    <DemoScreen
      title="Synced charts"
      docs="guides/synced-charts"
      description="One instrument, 1m and 15m candles. Drag or pinch the selected leader; both panes show the same time range. Switch leaders to continue from the follower's view."
      chartWrapperStyle={{ height: 350 }}
      chart={
        <View style={styles.panes}>
          <Text style={styles.label}>
            1m · {leaderId === 0 ? "Leader" : "Follower"}
          </Text>
          <View style={styles.pane}>
            <LiveChart
              {...common}
              ref={topRef}
              mode="candle"
              candles={minuteCandles}
              liveCandle={minuteLive}
              candleWidth={60}
              viewport={topViewport}
              debugFrameStats={topStats}
              timeScroll={leaderId === 0}
              zoom={leaderId === 0}
              renderOverlay={renderTopOverlay}
              accessibilityLabel="Synced 1 minute candles"
            />
          </View>
          <Text style={styles.label}>
            15m · {leaderId === 1 ? "Leader" : "Follower"}
          </Text>
          <View style={styles.pane}>
            <LiveChart
              {...common}
              ref={bottomRef}
              mode="candle"
              candles={quarterCandles}
              liveCandle={quarterLive}
              candleWidth={900}
              viewport={bottomViewport}
              debugFrameStats={bottomStats}
              timeScroll={leaderId === 1}
              zoom={leaderId === 1}
              renderOverlay={renderBottomOverlay}
              accessibilityLabel="Synced 15 minute candles"
            />
          </View>
        </View>
      }
    >
      <ChipRow
        label="Choose the leader"
        options={PANES}
        value={leaderId}
        onChange={chooseLeader}
      />
      <ControlRow label="Viewport">
        <Chip
          label="Reset both"
          active={false}
          onPress={() =>
            (leaderId === 0 ? topRef : bottomRef).current?.resetZoom()
          }
        />
        <Chip
          label="Change base window"
          active={false}
          onPress={() =>
            setTimeWindow((previous) =>
              previous === WINDOW ? WINDOW / 2 : WINDOW,
            )
          }
        />
        <ToggleChip
          label="Immediate follower width"
          value={immediateWidth}
          onChange={setImmediateWidth}
        />
      </ControlRow>
      <ControlRow label="Scheduling">
        <ToggleChip
          label="Freeze feed and clock"
          value={fixedNow !== undefined}
          onChange={(freeze) =>
            setFixedNow(freeze ? Date.now() / 1000 : undefined)
          }
        />
        <ToggleChip
          label="Automatic sleep"
          value={autoSleep}
          onChange={setAutoSleep}
        />
      </ControlRow>
      <FrameReadout top={topStats} bottom={bottomStats} />
      <Text style={styles.note}>
        Freeze the feed, wait for zero engine ticks, then pan or pinch to wake
        both panes. Change the base window while zoomed: the external override
        persists. Reset clears the leader&apos;s pair and the follower follows
        its drawn return.
      </Text>
    </DemoScreen>
  );
}

function FrameReadout({
  top,
  bottom,
}: {
  top: SharedValue<LiveChartFrameStats>;
  bottom: SharedValue<LiveChartFrameStats>;
}) {
  const [rates, setRates] = useState([0, 0]);
  useEffect(() => {
    let previous = [top.get().frames, bottom.get().frames];
    let previousTime = Date.now();
    const timer = setInterval(() => {
      const next = [top.get().frames, bottom.get().frames];
      const now = Date.now();
      setRates(
        next.map((frames, i) =>
          Math.round(
            ((frames - previous[i]) * 1000) / Math.max(1, now - previousTime),
          ),
        ),
      );
      previous = next;
      previousTime = now;
    }, 500);
    return () => clearInterval(timer);
  }, [top, bottom]);
  return (
    <Text style={styles.note}>
      Engine ticks/sec · 1m: {rates[0]} · 15m: {rates[1]}
    </Text>
  );
}

const styles = StyleSheet.create({
  panes: { flex: 1 },
  pane: { flex: 1 },
  label: {
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    color: colors.text,
    fontSize: 12,
    paddingHorizontal: 8,
  },
  note: {
    fontFamily: APP_FONT_FAMILY,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
});
