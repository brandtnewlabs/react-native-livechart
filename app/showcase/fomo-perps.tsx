import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";
import { Ionicons } from "@expo/vector-icons";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  LiveChart,
  type CandlePoint,
  type LiveChartHandle,
  type LiveChartPoint,
  type Marker,
  type ReferenceLine,
  type ScrubActionPoint,
  type ScrubPoint,
  type TooltipRenderProps,
} from "react-native-livechart";
import Animated, {
  Easing,
  interpolateColor,
  type SharedValue,
  SlideInDown,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { runOnJS } from "react-native-worklets";

import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

/**
 * Fomo · Perps — ETH perpetuals detail recreation.
 *
 * A fuller showcase than the meme-coin `fomo` screen: it drives a single
 * `LiveChart` through (almost) every interactive feature at once —
 *  • line ⇄ candle toggle,
 *  • a "candle intervals" bottom sheet (minutes / hours / days) that re-buckets
 *    the OHLC and re-frames the window,
 *  • brand candle colors + dark-grey volume bars,
 *  • one-finger time-scroll + two-finger pinch-zoom,
 *  • an order ticket: tap the chart to drop a price reticle and place a *limit*,
 *    or hit Long / Short to ticket a *market* order. Confirmed limits become
 *    working-order reference lines you can tap to cancel.
 *
 * The live price readout (top-left) and 24h change are real (driven off the feed
 * SharedValues); the holders list is static, matching the reference screenshot.
 *
 * To add another app, copy this file to `app/showcase/<id>.tsx` and register it
 * in `demo-lib/examples.ts`.
 */

// ── Fomo palette (scoped — does not touch the app-wide light theme).
const C = {
  bg: "#0A0A0E",
  card: "#15151B",
  green: "#23D55C",
  greenDim: "#1B9D45",
  red: "#FF5247",
  redDim: "#C73A33",
  blue: "#3B6BFF",
  white: "#FFFFFF",
  text: "#F4F4F6",
  muted: "rgba(255,255,255,0.45)",
  faint: "rgba(255,255,255,0.28)",
  hairline: "rgba(255,255,255,0.08)",
  chip: "rgba(255,255,255,0.06)",
  chipStrong: "rgba(255,255,255,0.12)",
  tooltipBg: "#1E1E26",
  // Dark-grey volume bars (per spec — not green/red). Subtle up/down split.
  volUp: "#3B3B46",
  volDown: "#2C2C35",
} as const;

const FONT_BOLD = "PlusJakartaSans_700Bold";
const FONT_SEMIBOLD = "PlusJakartaSans_600SemiBold";
const FONT_MEDIUM = "PlusJakartaSans_500Medium";
const FONT_REGULAR = "PlusJakartaSans_400Regular";

// Live seed + the fixed 24h-open reference. 1746.00 − 1730.40 = +15.60 (+0.90%),
// matching the reference screenshot; the change drifts live from there.
const ETH_START = 1746.0;
const ETH_OPEN_24H = 1730.4;
const LEVERAGE = "25×";
const CHART_HEIGHT = 286;
// The feed runs at ONE fixed config — fine `BASE_CANDLE_SECS` candles over a fixed
// span — so switching interval only RE-BUCKETS the same ticks (continuous price),
// never reseeds to a fresh random walk. Display candles are merged up from the base
// width to the chosen interval. The fixed span must cover the widest visible window.
const BASE_CANDLE_SECS = 6;
// Capped so the chart processes few enough candles per frame to hold a solid 60fps.
// The per-frame candle work scales with this span ÷ BASE_CANDLE_SECS; the original
// 9000 (~1500 base candles) periodically stalled the UI thread to ~56.
const FIXED_HISTORY_SECS = 1200;
// Roughly how many candles a timeframe shows at the 1× ("1D") range.
const VISIBLE_CANDLES = 24;

/** JS-thread USD formatter for the React readout (Intl is fine off the UI thread). */
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Worklet USD formatter for the chart (axis labels, value badge, scrub tooltip,
 * order-ticket reticle). Runs on the UI thread, so it can't use `Intl` — it
 * inserts the thousands separators by hand. e.g. 1746.2 → "$1,746.20".
 */
function formatUsd(v: number) {
  "worklet";
  const fixed = Math.abs(v).toFixed(2);
  const dot = fixed.indexOf(".");
  const intPart = fixed.slice(0, dot);
  const dec = fixed.slice(dot + 1);
  let grouped = "";
  for (let i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 === 0) grouped += ",";
    grouped += intPart[i];
  }
  return `${v < 0 ? "-" : ""}$${grouped}.${dec}`;
}

/**
 * Merge fixed-width base candles up into `coarseWidth` buckets on the UI thread.
 * Each base candle drops into one `floor(time / coarseWidth)` bucket (base candles
 * are time-sorted, so buckets are monotonic) and folds OHLCV in. The trailing
 * `live` base candle is folded last, so the final merged candle is the in-progress
 * coarse candle. This is what lets the interval change without reseeding the feed.
 */
function mergeCandles(
  committed: CandlePoint[],
  live: CandlePoint | null,
  coarseWidth: number,
): CandlePoint[] {
  "worklet";
  const out: CandlePoint[] = [];
  const total = committed.length + (live !== null ? 1 : 0);
  let cur: CandlePoint | null = null;
  for (let i = 0; i < total; i++) {
    const c = i < committed.length ? committed[i] : (live as CandlePoint);
    const bucket = Math.floor(c.time / coarseWidth) * coarseWidth;
    if (cur === null || cur.time !== bucket) {
      if (cur !== null) out.push(cur);
      cur = {
        time: bucket,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
      };
    } else {
      if (c.high > cur.high) cur.high = c.high;
      if (c.low < cur.low) cur.low = c.low;
      cur.close = c.close;
      cur.volume = (cur.volume ?? 0) + (c.volume ?? 0);
    }
  }
  if (cur !== null) out.push(cur);
  return out;
}

/**
 * Candle intervals shown in the bottom sheet (matches the reference grid). Time is
 * **compressed** for a live demo: each label maps to a display `candleWidthSecs`
 * (≥ the fixed base width), which the base candles are merged up to. The visible
 * window is derived as `candleWidthSecs × VISIBLE_CANDLES`, then scaled by the
 * range pill — so switching interval re-buckets the same feed, it never reseeds.
 */
const INTERVALS = [
  { id: "1m", group: "Minutes", candleWidthSecs: 6 },
  { id: "5m", group: "Minutes", candleWidthSecs: 11 },
  { id: "15m", group: "Minutes", candleWidthSecs: 16 },
  { id: "30m", group: "Minutes", candleWidthSecs: 24 },
  { id: "1h", group: "Hours", candleWidthSecs: 34 },
  { id: "4h", group: "Hours", candleWidthSecs: 46 },
  { id: "8h", group: "Hours", candleWidthSecs: 60 },
  { id: "12h", group: "Hours", candleWidthSecs: 78 },
  { id: "1D", group: "Days", candleWidthSecs: 96 },
  { id: "3D", group: "Days", candleWidthSecs: 120 },
  { id: "1W", group: "Days", candleWidthSecs: 150 },
  { id: "1M", group: "Days", candleWidthSecs: 186 },
] as const satisfies readonly {
  id: string;
  group: "Minutes" | "Hours" | "Days";
  candleWidthSecs: number;
}[];

type IntervalId = (typeof INTERVALS)[number]["id"];
const INTERVAL_GROUPS = ["Minutes", "Hours", "Days"] as const;
type IntervalGroup = (typeof INTERVAL_GROUPS)[number];
type Interval = (typeof INTERVALS)[number];

// Build the sheet's groups once. The old filter().map() chain rebuilt all three
// groups on every render even though the interval catalog is static.
const INTERVALS_BY_GROUP = INTERVALS.reduce<Record<IntervalGroup, Interval[]>>(
  (groups, interval) => {
    groups[interval.group].push(interval);
    return groups;
  },
  { Minutes: [], Hours: [], Days: [] },
);

// Range pills under the chart: each zooms the visible window to a multiple of the
// interval's base window (more candles in view) — a quick zoom-out layered on top
// of the candle-interval granularity. History covers the widest factor, so
// switching range is a smooth window change (no re-bucketing / reseed).
const RANGES = ["1D", "1W", "3M", "6M", "1Y", "All"] as const;
const RANGE_FACTORS: Record<(typeof RANGES)[number], number> = {
  "1D": 1,
  "1W": 1.3,
  "3M": 1.7,
  "6M": 2.1,
  "1Y": 2.6,
  All: 3,
};

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
// Sheet wrapper that slides up on open while the Modal backdrop fades in place
// (a plain `animationType="slide"` slides the whole modal — backdrop and all).
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── ETH mark: octahedron drawn into a small Skia canvas, on a white disc. ─────
const ETH_MARK_SIZE = 22;

function makeTriangle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  dx: number,
  dy: number,
) {
  const builder = Skia.PathBuilder.Make();
  builder.moveTo(ax, ay);
  builder.lineTo(bx, by);
  builder.lineTo(dx, dy);
  builder.close();
  return builder.build();
}

function makeEthPaths(size: number) {
  const cx = size / 2;
  const top = size * 0.05;
  const waistY = size * 0.42;
  const beltY = size * 0.58;
  const bottom = size * 0.95;
  const halfW = size * 0.3;
  return {
    ul: makeTriangle(cx, top, cx - halfW, waistY, cx, beltY),
    ur: makeTriangle(cx, top, cx + halfW, waistY, cx, beltY),
    ll: makeTriangle(cx, beltY, cx - halfW, waistY, cx, bottom),
    lr: makeTriangle(cx, beltY, cx + halfW, waistY, cx, bottom),
  };
}

// The mark is always rendered at one size, so build immutable Skia paths once at
// module initialization instead of carrying a manual React memoization contract.
const ETH_MARK_PATHS = makeEthPaths(ETH_MARK_SIZE);

function EthMark() {
  return (
    <Canvas style={{ width: ETH_MARK_SIZE, height: ETH_MARK_SIZE }}>
      <Path path={ETH_MARK_PATHS.ul} color="#8A8FA6" />
      <Path path={ETH_MARK_PATHS.ur} color="#62677D" />
      <Path path={ETH_MARK_PATHS.ll} color="#777C93" />
      <Path path={ETH_MARK_PATHS.lr} color="#4E5468" />
    </Canvas>
  );
}

/**
 * Custom scrub tooltip — a fixed-width RN pill with the time centred. The chart
 * floats it centred over the crosshair (`scrub.tooltipPlacement="top"`); the time
 * is bound to the `timeStr` SharedValue so it updates on the UI thread while
 * scrubbing (no JS re-render per pointer move).
 */
function PerpsTooltip({ timeStr }: TooltipRenderProps) {
  const animatedProps = useAnimatedProps(() => {
    const t = timeStr.get();
    return { text: t, defaultValue: t };
  });
  return (
    <View style={styles.tip}>
      <AnimatedTextInput
        editable={false}
        underlineColorAndroid="transparent"
        style={styles.tipText}
        animatedProps={animatedProps}
      />
    </View>
  );
}

/**
 * Live price + 24h change readout. Mirrors `value` (or the scrubbed value) into
 * React state via a UI-thread reaction — once per change, not per frame — flashes
 * the price green/red on each tick, and computes the change against the fixed
 * 24h open. Seeded with a plain number (never reads a SharedValue during render).
 */
function PriceReadout({ value }: { value: SharedValue<number> }) {
  const flash = useSharedValue(0);
  const [raw, setRaw] = useState(ETH_START);

  useAnimatedReaction(
    () => value.get(),
    (cur, prev) => {
      if (cur === prev || !Number.isFinite(cur)) return;
      if (prev != null && Number.isFinite(prev)) {
        const dir = cur > prev ? 1 : -1;
        flash.set(
          withSequence(
            withTiming(dir, { duration: 100 }),
            withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) }),
          ),
        );
      }
      runOnJS(setRaw)(cur);
    },
  );

  const priceStyle = useAnimatedStyle(() => ({
    color: interpolateColor(flash.get(), [-1, 0, 1], [C.red, C.white, C.green]),
  }));

  const delta = raw - ETH_OPEN_24H;
  const pct = (delta / ETH_OPEN_24H) * 100;
  const up = delta >= 0;
  const changeColor = up ? C.green : C.red;

  return (
    <View>
      <Animated.Text style={[styles.price, priceStyle]}>
        {USD.format(raw)}
      </Animated.Text>
      <View style={styles.changeRow}>
        <Text style={[styles.change, { color: changeColor }]}>
          {up ? "▲" : "▼"} {USD.format(Math.abs(delta))} (
          {Math.abs(pct).toFixed(2)}
          %)
        </Text>
        <Text style={styles.changeSuffix}> 24h</Text>
      </View>
    </View>
  );
}

/** Tiny candlestick glyph (an up + down candle) for the chart-type toggle / interval button. */
function CandleGlyph({ tint }: { tint: string }) {
  return (
    <View style={styles.glyph}>
      <View style={styles.glyphCandle}>
        <View style={[styles.glyphWick, { backgroundColor: C.green }]} />
        <View
          style={[
            styles.glyphBody,
            { backgroundColor: C.green, height: 9, marginTop: -3 },
          ]}
        />
      </View>
      <View style={styles.glyphCandle}>
        <View style={[styles.glyphWick, { backgroundColor: tint }]} />
        <View
          style={[
            styles.glyphBody,
            { backgroundColor: tint, height: 7, marginTop: 4 },
          ]}
        />
      </View>
    </View>
  );
}

/** One static holder row (avatar + name/entry on the left, value/PnL on the right). */
function HolderRow({
  initial,
  avatar,
  name,
  lev,
  side,
  entry,
  value,
  pnl,
}: {
  initial: string;
  avatar: string;
  name: string;
  lev: string;
  side: "Long" | "Short";
  entry: string;
  value: string;
  pnl: number;
}) {
  const sideColor = side === "Long" ? C.green : C.red;
  const pnlColor = pnl >= 0 ? C.green : C.red;
  return (
    <View style={styles.holderRow}>
      <View style={[styles.avatar, { backgroundColor: avatar }]}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.holderText}>
        <View style={styles.holderNameRow}>
          <Text style={styles.holderName} numberOfLines={1}>
            {name}
          </Text>
          <View style={[styles.levTag, { backgroundColor: `${sideColor}22` }]}>
            <Text style={[styles.levTagText, { color: sideColor }]}>
              {lev} {side}
            </Text>
          </View>
        </View>
        <Text style={styles.holderSub}>Avg. entry: {entry}</Text>
      </View>
      <View style={styles.holderRight}>
        <Text style={styles.holderValue}>{value}</Text>
        <Text style={[styles.holderPnl, { color: pnlColor }]}>
          {pnl >= 0 ? "+" : "−"}
          {USD.format(Math.abs(pnl))}
        </Text>
      </View>
    </View>
  );
}

type TicketSide = "long" | "short";
type TicketType = "market" | "limit";
type Ticket = { side: TicketSide; type: TicketType; price: number };
type WorkingOrder = { side: TicketSide; price: number };

const SIZE_CHIPS = ["0.1", "0.5", "1.0", "Max"] as const;

export default function FomoPerpsShowcase() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const chartRef = useRef<LiveChartHandle>(null);

  const [chartMode, setChartMode] = useState<"line" | "candle">("candle");
  const [intervalId, setIntervalId] = useState<IntervalId>("15m");
  const [range, setRange] = useState<(typeof RANGES)[number]>("1D");
  const [intervalSheet, setIntervalSheet] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [sizeChip, setSizeChip] = useState<(typeof SIZE_CHIPS)[number]>("0.5");
  const [orders, setOrders] = useState<WorkingOrder[]>([]);
  const [cancelIdx, setCancelIdx] = useState<number | null>(null);
  const interval = INTERVALS.find((i) => i.id === intervalId) ?? INTERVALS[2];
  const candleMode = chartMode === "candle";
  // Candle interval sets granularity (candle width); the range pill scales how wide
  // a window is shown on top of it (zoom). Both only change the VIEW / how the feed
  // is bucketed — never the feed itself — so switching either keeps the price
  // continuous. Clamp the window so it always fits inside the fixed seeded history.
  const baseWindow = interval.candleWidthSecs * VISIBLE_CANDLES;
  const visibleWindow = Math.min(
    Math.round(baseWindow * RANGE_FACTORS[range]),
    FIXED_HISTORY_SECS - 600,
  );

  // A range tap also resets any focal-anchored pinch override. This matters when
  // re-tapping the active pill, where React correctly skips the same-state update.
  const selectRange = (r: (typeof RANGES)[number]) => {
    setRange(r);
    chartRef.current?.resetZoom();
  };

  // ONE fixed feed: fine base candles over a fixed span. Nothing here depends on the
  // selected interval, so switching interval never reseeds — we re-bucket the base
  // candles into the chosen width below, keeping the price continuous.
  // `candleAggregation` also gives the line `data` for the line ⇄ candle toggle.
  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: true,
    tradeStream: false,
    startValue: ETH_START,
    tokenSymbol: "ETH",
    volatilityMode: "volatile",
    tradesPerSecond: 3,
    candleWidth: BASE_CANDLE_SECS,
    historySpanSeconds: FIXED_HISTORY_SECS,
    historyRange: "1m",
    maxPoints: 10000,
  });

  // Mirror the chosen display width into a SharedValue so the merge recomputes the
  // instant you switch interval (not a tick later). Merge the base candles up to it
  // on the UI thread: `displayCandles` are the committed coarse candles, `displayLive`
  // is the in-progress one (the last merged bucket).
  const widthSV = useSharedValue(interval.candleWidthSecs);
  useEffect(() => {
    widthSV.set(interval.candleWidthSecs);
  }, [interval.candleWidthSecs, widthSV]);
  const mergedCandles = useDerivedValue(() =>
    mergeCandles(candles.get(), liveCandle.get(), widthSV.get()),
  );
  const displayCandles = useDerivedValue(() => {
    const m = mergedCandles.get();
    return m.length > 1 ? m.slice(0, m.length - 1) : [];
  });
  const displayLive = useDerivedValue(() => {
    const m = mergedCandles.get();
    return m.length > 0 ? m[m.length - 1] : null;
  });

  // The top-left readout follows the live value, except while scrubbing it shows
  // the crosshair's value (and snaps back to live when the gesture ends).
  const isScrubbing = useSharedValue(false);
  const displayValue = useSharedValue(ETH_START);
  useAnimatedReaction(
    () => value.get(),
    (v) => {
      if (!isScrubbing.get()) displayValue.set(v);
    },
  );

  // ── Trade-tape markers (the "trenches" transaction stacks) ──────────────────
  // Co-located buy/sell bursts that pile into vertical COLUMNS on the candles via
  // `markerCluster={{ direction: "vertical" }}`. Every burst stacks UP off the
  // candle (green + buys, red − sells) — `side: "above"` for both, color tells
  // them apart. Anchored by `time` only (no `value`), so each column roots on the
  // line at its candle. Seeded across the loaded history so columns show
  // immediately, then ONE small burst drops per new candle (~4.5s), capped to keep
  // the count low — both so a co-located bucket stays under `maxBeforeGroup` (no
  // count-badge summaries) and so the per-frame cluster pass stays light.
  const markers = useSharedValue<Marker[]>([]);
  useEffect(() => {
    const CAP = 40; // total glyphs kept; fewer = lighter per-frame clustering
    let counter = 0;
    let seeded = false;
    let lastEdge = -1; // skip repeat bursts on the same candle (no mega-piles)
    const makeBurst = (time: number): Marker[] => {
      const buy = Math.random() < 0.5;
      const n = 2 + Math.floor(Math.random() * 3); // 2–4 coins per column
      return Array.from({ length: n }, () => {
        counter += 1;
        return {
          id: `tx${counter}`,
          time,
          kind: "trade" as const,
          color: buy ? C.green : C.red,
          icon: buy ? "+" : "−",
          pill: true,
          // All trades stack UP off the candle (color = buy/sell), matching the
          // trenches reference where every coin column rises from the price.
          side: "above" as const,
        };
      });
    };
    const tick = () => {
      const cur = data.get();
      if (cur.length < 10) return; // wait for the feed to warm up
      if (!seeded) {
        seeded = true;
        const out: Marker[] = [];
        const step = Math.max(1, Math.floor(cur.length / 5));
        for (let i = 6; i < cur.length - 2; i += step) {
          out.push(...makeBurst(cur[i].time));
        }
        lastEdge = cur[cur.length - 1].time;
        markers.set(out.slice(-CAP));
        return;
      }
      const edge = cur[cur.length - 1].time;
      if (edge === lastEdge) return; // one burst per candle, never pile a time
      lastEdge = edge;
      markers.set([...markers.get(), ...makeBurst(edge)].slice(-CAP));
    };
    tick(); // seed now if the feed is ready, else the interval picks it up
    const id = setInterval(tick, 4500);
    return () => clearInterval(id);
  }, [data, markers]);

  // Trend tint vs the 24h open: green above, red below. Recolors the line, dot,
  // and badge together; flips only on a crossing (rare), so it's cheap.
  const [trendDown, setTrendDown] = useState(false);
  useAnimatedReaction(
    () => value.get() < ETH_OPEN_24H,
    (down, prev) => {
      if (down !== prev) runOnJS(setTrendDown)(down);
    },
  );
  const trendColor = trendDown ? C.red : C.green;

  // Tap the chart → drop a reticle, drag to a price level, press the + badge:
  // tickets a LIMIT order. Long limit below market, short limit above (perps
  // convention). onScrubAction runs on the JS thread, so read the live value off
  // the SharedValue closure to pick the side.
  const onScrubAction = (point: ScrubActionPoint) => {
    const last = value.get();
    setTicket({
      side: point.price < last ? "long" : "short",
      type: "limit",
      price: point.price,
    });
  };

  const openMarketTicket = (side: TicketSide) => {
    setTicket({ side, type: "market", price: value.get() });
  };

  const confirmTicket = () => {
    if (ticket && ticket.type === "limit") {
      setOrders((prev) => [
        ...prev,
        { side: ticket.side, price: ticket.price },
      ]);
    }
    setTicket(null);
  };

  const cancelOrder = () => {
    if (cancelIdx !== null) {
      setOrders((prev) => prev.filter((_, i) => i !== cancelIdx));
    }
    setCancelIdx(null);
  };
  const cancelTarget = cancelIdx !== null ? orders[cancelIdx] : undefined;

  // Confirmed limits become working-order reference lines (tap a badge to cancel).
  const referenceLines: ReferenceLine[] = orders.map((o) => {
    const color = o.side === "long" ? C.green : C.red;
    return {
      value: o.price,
      label: o.side === "long" ? "Long limit" : "Short limit",
      showValue: true,
      excludeFromRange: true,
      color,
      labelColor: color,
      strokeWidth: 1,
      intervals: [4, 4],
      badge: {
        icon: o.side === "long" ? "▲" : "▼",
        background: color,
        borderColor: color,
        textColor: C.white,
        radius: 6,
      },
    };
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <PerpsHeader onBack={() => router.back()} displayValue={displayValue} />

      <PerpsChart
        chartRef={chartRef}
        data={data}
        value={value}
        chartMode={chartMode}
        candleMode={candleMode}
        displayCandles={displayCandles}
        displayLive={displayLive}
        interval={interval}
        visibleWindow={visibleWindow}
        markers={markers}
        trendColor={trendColor}
        onScrubAction={onScrubAction}
        referenceLines={referenceLines}
        onReferenceLinePress={setCancelIdx}
        isScrubbing={isScrubbing}
        displayValue={displayValue}
      />

      <PerpsControls
        intervalId={intervalId}
        range={range}
        candleMode={candleMode}
        onOpenIntervals={() => setIntervalSheet(true)}
        onSelectRange={selectRange}
        onToggleMode={() =>
          setChartMode((mode) => (mode === "line" ? "candle" : "line"))
        }
      />

      <HoldersPanel />

      <TradeActions
        bottomInset={insets.bottom}
        onOpenMarketTicket={openMarketTicket}
      />

      <IntervalSheet
        visible={intervalSheet}
        intervalId={intervalId}
        onSelect={setIntervalId}
        onClose={() => setIntervalSheet(false)}
      />
      <OrderTicketSheet
        ticket={ticket}
        sizeChip={sizeChip}
        onSize={setSizeChip}
        onConfirm={confirmTicket}
        onClose={() => setTicket(null)}
      />
      <CancelOrderDialog
        order={cancelTarget}
        onCancelOrder={cancelOrder}
        onClose={() => setCancelIdx(null)}
      />
    </View>
  );
}

function PerpsHeader({
  onBack,
  displayValue,
}: {
  onBack: () => void;
  displayValue: SharedValue<number>;
}) {
  return (
    <>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to Examples"
        >
          <Ionicons name="chevron-back" size={26} color={C.white} />
        </Pressable>
        <View style={styles.ethDisc}>
          <EthMark />
        </View>
        <View style={styles.headerTitle}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.ticker}>ETH</Text>
            <View style={styles.levBadge}>
              <Text style={styles.levBadgeText}>{LEVERAGE}</Text>
            </View>
          </View>
          <Text style={styles.ethName}>Ethereum</Text>
        </View>
        <View style={styles.headerIcons}>
          <Ionicons name="star-outline" size={22} color={C.muted} />
          <Ionicons name="share-outline" size={22} color={C.muted} />
        </View>
      </View>

      <View style={styles.priceBlock}>
        <PriceReadout value={displayValue} />
        <View style={styles.oiBlock}>
          <View style={styles.oiRow}>
            <Ionicons name="swap-horizontal" size={16} color={C.muted} />
            <Text style={styles.oiValue}>$1.3B</Text>
          </View>
          <Text style={styles.oiLabel}>Open interest</Text>
        </View>
      </View>
    </>
  );
}

function PerpsChart({
  chartRef,
  data,
  value,
  chartMode,
  candleMode,
  displayCandles,
  displayLive,
  interval,
  visibleWindow,
  markers,
  trendColor,
  onScrubAction,
  referenceLines,
  onReferenceLinePress,
  isScrubbing,
  displayValue,
}: {
  chartRef: RefObject<LiveChartHandle | null>;
  data: SharedValue<LiveChartPoint[]>;
  value: SharedValue<number>;
  chartMode: "line" | "candle";
  candleMode: boolean;
  displayCandles: SharedValue<CandlePoint[]>;
  displayLive: SharedValue<CandlePoint | null>;
  interval: Interval;
  visibleWindow: number;
  markers: SharedValue<Marker[]>;
  trendColor: string;
  onScrubAction: (point: ScrubActionPoint) => void;
  referenceLines: ReferenceLine[];
  onReferenceLinePress: (index: number) => void;
  isScrubbing: SharedValue<boolean>;
  displayValue: SharedValue<number>;
}) {
  return (
    <View style={styles.chartWrap}>
      <LiveChart
        ref={chartRef}
        data={data}
        value={value}
        style={styles.chartCanvas}
        theme="dark"
        // JetBrains Mono keeps the live badge and axis prices from jittering.
        font={{ typeface: JetBrainsMono_400Regular }}
        mode={chartMode}
        candles={candleMode ? displayCandles : undefined}
        liveCandle={candleMode ? displayLive : undefined}
        candleWidth={interval.candleWidthSecs}
        timeWindow={visibleWindow}
        markers={markers}
        markerCluster={{
          direction: "vertical",
          overlap: 0.6,
          maxBeforeGroup: 12,
        }}
        accentColor={candleMode ? C.green : trendColor}
        line={{ color: trendColor, width: 2 }}
        gradient={{ topOpacity: 0.18, bottomOpacity: 0 }}
        pulse={{ maxRadius: 10 }}
        metrics={{ badge: { dotGap: 4 } }}
        palette={{
          candleUp: C.green,
          candleDown: C.red,
          wickUp: C.green,
          wickDown: C.red,
        }}
        volume={
          candleMode
            ? {
                upColor: C.volUp,
                downColor: C.volDown,
                maxHeight: 26,
                radius: 1,
                opacity: 1,
              }
            : false
        }
        formatValue={formatUsd}
        valueLine={{ intervals: [2, 4], strokeWidth: 1.5, color: trendColor }}
        badge={{ followViewEdge: true, tail: false, radius: 1 }}
        renderTooltip={PerpsTooltip}
        scrub={{ tooltipPlacement: "top", dimOpacity: 1 }}
        timeScroll={{ gesture: "holdToScrub", scrubHoldMs: 450 }}
        zoom
        scrubAction={{
          icon: "+",
          snap: 0.5,
          text: true,
          dismissOnAction: true,
        }}
        onScrubAction={onScrubAction}
        referenceLines={referenceLines}
        onReferenceLinePress={(_line, index) => onReferenceLinePress(index)}
        onScrub={(point: ScrubPoint | null) => {
          "worklet";
          if (point === null) {
            isScrubbing.set(false);
            displayValue.set(value.get());
            return;
          }
          isScrubbing.set(true);
          displayValue.set(point.value);
        }}
      />
    </View>
  );
}

function PerpsControls({
  intervalId,
  range,
  candleMode,
  onOpenIntervals,
  onSelectRange,
  onToggleMode,
}: {
  intervalId: IntervalId;
  range: (typeof RANGES)[number];
  candleMode: boolean;
  onOpenIntervals: () => void;
  onSelectRange: (range: (typeof RANGES)[number]) => void;
  onToggleMode: () => void;
}) {
  return (
    <View style={styles.controls}>
      <Pressable
        onPress={onOpenIntervals}
        hitSlop={8}
        style={styles.intervalBtn}
        accessibilityRole="button"
        accessibilityLabel="Candle intervals"
      >
        <CandleGlyph tint={C.red} />
        <Text style={styles.intervalText}>{intervalId}</Text>
        <Ionicons name="chevron-expand" size={14} color={C.muted} />
      </Pressable>

      <View style={styles.rangeRow}>
        {RANGES.map((rangeOption) => {
          const active = rangeOption === range;
          return (
            <Pressable
              key={rangeOption}
              onPress={() => onSelectRange(rangeOption)}
              hitSlop={6}
              style={[styles.rangeChip, active && styles.rangeChipActive]}
            >
              <Text
                style={[styles.rangeText, active && styles.rangeTextActive]}
              >
                {rangeOption}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.controlsDivider} />
      <Pressable
        onPress={onToggleMode}
        hitSlop={10}
        style={styles.typeBtn}
        accessibilityRole="button"
        accessibilityLabel={
          candleMode ? "Switch to line chart" : "Switch to candlestick chart"
        }
      >
        {candleMode ? (
          <Ionicons name="pulse" size={20} color={C.green} />
        ) : (
          <CandleGlyph tint={C.red} />
        )}
      </Pressable>
    </View>
  );
}

function HoldersPanel() {
  return (
    <ScrollView
      style={styles.lower}
      contentContainerStyle={styles.lowerContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.tabs}>
        <View style={[styles.tab, styles.tabActive]}>
          <Text style={styles.tabActiveText}>Holders</Text>
        </View>
        <View style={styles.tab}>
          <Text style={styles.tabText}>About</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Friends only</Text>
        <View style={styles.toggleTrack}>
          <View style={styles.toggleKnob} />
        </View>
        <View style={{ flex: 1 }} />
        <Text style={styles.filterMuted}>Leveraged size</Text>
        <Ionicons name="information-circle-outline" size={15} color={C.faint} />
      </View>

      <HolderRow
        initial="0"
        avatar="#2B2230"
        name="0xnobi"
        lev="3×"
        side="Long"
        entry="$1,796.00"
        value="$5,832.16"
        pnl={-175.65}
      />
      <HolderRow
        initial="f"
        avatar="#23303A"
        name="faeklbby"
        lev="25×"
        side="Long"
        entry="$1,674.08"
        value="$4,080.23"
        pnl={160.96}
      />
      <HolderRow
        initial="C"
        avatar="#3A2433"
        name="ColdObedientPerch"
        lev="13×"
        side="Short"
        entry="$1,710.60"
        value="$666.80"
        pnl={-13.33}
      />
    </ScrollView>
  );
}

function TradeActions({
  bottomInset,
  onOpenMarketTicket,
}: {
  bottomInset: number;
  onOpenMarketTicket: (side: TicketSide) => void;
}) {
  return (
    <View style={[styles.cta, { paddingBottom: bottomInset + 12 }]}>
      <Pressable
        style={[styles.ctaBtn, { backgroundColor: C.red }]}
        onPress={() => onOpenMarketTicket("short")}
        accessibilityRole="button"
        accessibilityLabel="Short ETH"
      >
        <Text style={styles.ctaText}>Short</Text>
      </Pressable>
      <Pressable
        style={[styles.ctaBtn, { backgroundColor: C.green }]}
        onPress={() => onOpenMarketTicket("long")}
        accessibilityRole="button"
        accessibilityLabel="Long ETH"
      >
        <Text style={styles.ctaText}>Long</Text>
      </Pressable>
    </View>
  );
}

function IntervalSheet({
  visible,
  intervalId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  intervalId: IntervalId;
  onSelect: (interval: IntervalId) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <AnimatedPressable
          style={styles.sheet}
          entering={SlideInDown.duration(260)}
          accessible={false}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Candle intervals</Text>
          <Text style={styles.sheetSub}>
            Choose the time period represented by each candle on the chart.
          </Text>
          {INTERVAL_GROUPS.map((group) => (
            <View key={group} style={styles.intervalGroup}>
              <Text style={styles.intervalGroupLabel}>{group}</Text>
              <View style={styles.intervalGrid}>
                {INTERVALS_BY_GROUP[group].map((interval) => {
                  const active = interval.id === intervalId;
                  return (
                    <Pressable
                      key={interval.id}
                      style={[
                        styles.intervalCell,
                        active && styles.intervalCellActive,
                      ]}
                      onPress={() => {
                        onSelect(interval.id);
                        onClose();
                      }}
                    >
                      <Text
                        style={[
                          styles.intervalCellText,
                          active && styles.intervalCellTextActive,
                        ]}
                      >
                        {interval.id}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          <Pressable style={styles.sheetClose} onPress={onClose}>
            <Text style={styles.sheetCloseText}>Close</Text>
          </Pressable>
        </AnimatedPressable>
      </Pressable>
    </Modal>
  );
}

function OrderTicketSheet({
  ticket,
  sizeChip,
  onSize,
  onConfirm,
  onClose,
}: {
  ticket: Ticket | null;
  sizeChip: (typeof SIZE_CHIPS)[number];
  onSize: (size: (typeof SIZE_CHIPS)[number]) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={ticket !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <AnimatedPressable
          style={styles.sheet}
          entering={SlideInDown.duration(260)}
          accessible={false}
        >
          <View style={styles.sheetHandle} />
          {ticket ? (
            <OrderTicketBody
              ticket={ticket}
              sizeChip={sizeChip}
              onSize={onSize}
              onConfirm={onConfirm}
              onCancel={onClose}
            />
          ) : null}
        </AnimatedPressable>
      </Pressable>
    </Modal>
  );
}

function CancelOrderDialog({
  order,
  onCancelOrder,
  onClose,
}: {
  order: WorkingOrder | undefined;
  onCancelOrder: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={order !== undefined}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.centerBackdrop}
        onPress={onClose}
        accessible={false}
      >
        <Pressable style={styles.dialog} accessible={false}>
          <Text style={styles.dialogTitle}>
            Cancel {order?.side === "long" ? "long" : "short"} limit?
          </Text>
          <Text style={styles.dialogSub}>
            @ {order ? USD.format(order.price) : ""}
          </Text>
          <View style={styles.dialogRow}>
            <Pressable
              style={[styles.dialogBtn, styles.dialogKeep]}
              onPress={onClose}
            >
              <Text style={styles.dialogKeepText}>Keep</Text>
            </Pressable>
            <Pressable
              style={[styles.dialogBtn, { backgroundColor: C.red }]}
              onPress={onCancelOrder}
            >
              <Text style={styles.dialogConfirmText}>Cancel order</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Order-ticket sheet body (market or limit), colored by side. */
function OrderTicketBody({
  ticket,
  sizeChip,
  onSize,
  onConfirm,
  onCancel,
}: {
  ticket: Ticket;
  sizeChip: (typeof SIZE_CHIPS)[number];
  onSize: (s: (typeof SIZE_CHIPS)[number]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const sideColor = ticket.side === "long" ? C.green : C.red;
  const sideLabel = ticket.side === "long" ? "Long" : "Short";
  const typeLabel = ticket.type === "market" ? "Market" : "Limit";
  return (
    <>
      <View style={styles.ticketHead}>
        <View
          style={[styles.ticketSide, { backgroundColor: `${sideColor}22` }]}
        >
          <Text style={[styles.ticketSideText, { color: sideColor }]}>
            {sideLabel}
          </Text>
        </View>
        <Text style={styles.ticketType}>{typeLabel} · ETH-PERP</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.levBadge}>
          <Text style={styles.levBadgeText}>{LEVERAGE}</Text>
        </View>
      </View>

      <View style={styles.ticketPriceRow}>
        <Text style={styles.ticketPriceLabel}>
          {ticket.type === "market" ? "Market price" : "Limit price"}
        </Text>
        <Text style={styles.ticketPrice}>{USD.format(ticket.price)}</Text>
      </View>

      <Text style={styles.ticketSizeLabel}>Size (ETH)</Text>
      <View style={styles.sizeRow}>
        {SIZE_CHIPS.map((s) => {
          const active = s === sizeChip;
          return (
            <Pressable
              key={s}
              style={[styles.sizeChip, active && { borderColor: sideColor }]}
              onPress={() => onSize(s)}
            >
              <Text style={[styles.sizeChipText, active && { color: C.text }]}>
                {s}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.ticketActions}>
        <Pressable
          style={[styles.dialogBtn, styles.dialogKeep]}
          onPress={onCancel}
        >
          <Text style={styles.dialogKeepText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[
            styles.dialogBtn,
            styles.ticketConfirm,
            { backgroundColor: sideColor },
          ]}
          onPress={onConfirm}
        >
          <Text style={styles.dialogConfirmText}>
            {ticket.type === "market"
              ? `${sideLabel} now`
              : `Place ${sideLabel.toLowerCase()} limit`}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    height: 52,
  },
  backButton: { width: 28, alignItems: "center", justifyContent: "center" },
  ethDisc: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ticker: { color: C.text, fontSize: 19, fontFamily: FONT_BOLD },
  levBadge: {
    backgroundColor: `${C.blue}26`,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  levBadgeText: { color: "#7E9BFF", fontSize: 12, fontFamily: FONT_SEMIBOLD },
  ethName: {
    color: C.muted,
    fontSize: 13,
    fontFamily: FONT_MEDIUM,
    marginTop: 1,
  },
  headerIcons: { flexDirection: "row", gap: 16 },

  // Price block
  priceBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  price: {
    fontSize: 34,
    fontFamily: FONT_BOLD,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  changeRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  change: {
    fontSize: 14,
    fontFamily: FONT_SEMIBOLD,
    fontVariant: ["tabular-nums"],
  },
  changeSuffix: { color: C.muted, fontSize: 14, fontFamily: FONT_MEDIUM },
  oiBlock: { alignItems: "flex-end", paddingTop: 4 },
  oiRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  oiValue: { color: C.text, fontSize: 16, fontFamily: FONT_SEMIBOLD },
  oiLabel: {
    color: C.muted,
    fontSize: 12,
    fontFamily: FONT_MEDIUM,
    marginTop: 3,
  },

  // Chart
  chartWrap: { height: CHART_HEIGHT, marginTop: 6 },
  chartCanvas: { backgroundColor: "transparent" },

  // Controls row
  controls: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginTop: 6,
    height: 38,
  },
  intervalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.chip,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  intervalText: { color: C.text, fontSize: 13, fontFamily: FONT_SEMIBOLD },
  rangeRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 2,
    // Left-aligned to the candle-interval dropdown, 16px to its right.
    marginLeft: 16,
  },
  rangeChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  rangeChipActive: { backgroundColor: C.chipStrong },
  rangeText: { color: C.muted, fontSize: 13, fontFamily: FONT_MEDIUM },
  rangeTextActive: { color: C.text, fontFamily: FONT_SEMIBOLD },
  controlsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: C.hairline,
    marginHorizontal: 10,
  },
  typeBtn: { width: 34, alignItems: "center", justifyContent: "center" },

  // Candle / type glyph
  glyph: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    width: 22,
    height: 20,
  },
  glyphCandle: {
    width: 6,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphWick: { position: "absolute", width: 1.5, height: 16, borderRadius: 1 },
  glyphBody: { width: 6, borderRadius: 1.5 },

  // Lower content
  lower: { flex: 1 },
  lowerContent: { paddingBottom: 8 },
  tabs: {
    flexDirection: "row",
    marginTop: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hairline,
  },
  // Two equal-width (50/50) tabs; text centered, active underline spans its half.
  tab: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: C.blue },
  tabActiveText: { color: C.text, fontSize: 15, fontFamily: FONT_SEMIBOLD },
  tabText: { color: C.muted, fontSize: 15, fontFamily: FONT_MEDIUM },

  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterLabel: { color: C.text, fontSize: 13, fontFamily: FONT_MEDIUM },
  toggleTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.chipStrong,
    padding: 2,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.white,
  },
  filterMuted: { color: C.muted, fontSize: 13, fontFamily: FONT_MEDIUM },

  // Holder rows
  holderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.muted, fontSize: 16, fontFamily: FONT_SEMIBOLD },
  holderText: { flex: 1 },
  holderNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  holderName: {
    color: C.text,
    fontSize: 15,
    fontFamily: FONT_SEMIBOLD,
    flexShrink: 1,
  },
  levTag: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  levTagText: { fontSize: 11, fontFamily: FONT_SEMIBOLD },
  holderSub: {
    color: C.muted,
    fontSize: 12,
    fontFamily: FONT_REGULAR,
    marginTop: 3,
  },
  holderRight: { alignItems: "flex-end" },
  holderValue: { color: C.text, fontSize: 15, fontFamily: FONT_SEMIBOLD },
  holderPnl: {
    fontSize: 13,
    fontFamily: FONT_MEDIUM,
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },

  // CTAs
  cta: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  ctaBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: C.white, fontSize: 17, fontFamily: FONT_BOLD },

  // Tooltip pill
  tip: {
    backgroundColor: C.tooltipBg,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.hairline,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tipText: {
    width: 64,
    textAlign: "center",
    color: C.white,
    fontSize: 13,
    fontFamily: FONT_MEDIUM,
    fontVariant: ["tabular-nums"],
    padding: 0,
  },

  // Sheets / dialogs
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  centerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.chipStrong,
    marginBottom: 14,
  },
  sheetTitle: {
    color: C.text,
    fontSize: 20,
    fontFamily: FONT_BOLD,
    textAlign: "center",
  },
  sheetSub: {
    color: C.muted,
    fontSize: 13,
    fontFamily: FONT_REGULAR,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 8,
    lineHeight: 19,
  },
  intervalGroup: { marginTop: 14 },
  intervalGroupLabel: {
    color: C.text,
    fontSize: 15,
    fontFamily: FONT_SEMIBOLD,
    marginBottom: 8,
  },
  intervalGrid: { flexDirection: "row", gap: 8 },
  intervalCell: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: C.chip,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  intervalCellActive: { borderColor: C.blue, backgroundColor: `${C.blue}1A` },
  intervalCellText: { color: C.muted, fontSize: 14, fontFamily: FONT_MEDIUM },
  intervalCellTextActive: { color: C.text, fontFamily: FONT_SEMIBOLD },
  sheetClose: {
    marginTop: 22,
    height: 50,
    borderRadius: 14,
    backgroundColor: C.chipStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseText: { color: C.text, fontSize: 16, fontFamily: FONT_SEMIBOLD },

  // Order ticket
  ticketHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  ticketSide: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 4 },
  ticketSideText: { fontSize: 14, fontFamily: FONT_BOLD },
  ticketType: { color: C.muted, fontSize: 13, fontFamily: FONT_MEDIUM },
  ticketPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  ticketPriceLabel: { color: C.muted, fontSize: 14, fontFamily: FONT_MEDIUM },
  ticketPrice: {
    color: C.text,
    fontSize: 20,
    fontFamily: FONT_BOLD,
    fontVariant: ["tabular-nums"],
  },
  ticketSizeLabel: {
    color: C.muted,
    fontSize: 13,
    fontFamily: FONT_MEDIUM,
    marginTop: 18,
    marginBottom: 8,
  },
  sizeRow: { flexDirection: "row", gap: 8 },
  sizeChip: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    backgroundColor: C.chip,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  sizeChipText: { color: C.muted, fontSize: 14, fontFamily: FONT_SEMIBOLD },
  ticketActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  ticketConfirm: { flex: 2 },

  // Generic dialog buttons
  dialog: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.hairline,
  },
  dialogTitle: { color: C.text, fontSize: 18, fontFamily: FONT_SEMIBOLD },
  dialogSub: {
    color: C.muted,
    fontSize: 15,
    fontFamily: FONT_MEDIUM,
    marginTop: 4,
  },
  dialogRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  dialogBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogKeep: { backgroundColor: C.chipStrong },
  dialogKeepText: { color: C.text, fontSize: 15, fontFamily: FONT_SEMIBOLD },
  dialogConfirmText: {
    color: C.white,
    fontSize: 15,
    fontFamily: FONT_SEMIBOLD,
  },
});
