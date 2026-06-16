import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  type DimensionValue,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import {
  LiveChart,
  type ScrubPoint,
  type TooltipRenderProps,
} from "react-native-livechart";
import Animated, {
  Easing,
  interpolateColor,
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

/**
 * Kraken — asset-detail recreation (light theme, BTC/USD).
 *
 * Same skeleton philosophy as the other showcases (Fomo / Robinhood / Backpack):
 * everything but the chart and the live price readout is a grey placeholder, so
 * focus stays on LiveChart. The "real" pieces are the back button, the BTC
 * mark/ticker, the `LiveChart`, and `KrakenPriceReadout` (price + change).
 *
 * The chart is the showpiece for the library's `areaDots` feature: a thin orange
 * line whose area below the line is filled with a DOT LATTICE (a procedural
 * shader bounded to the under-line region) instead of a gradient. It also pairs
 * right-gutter Y-axis labels and a dashed scrub crosshair + time pill.
 *
 * To add another app, copy this file to `app/showcase/<id>.tsx` and register it
 * in `demo-lib/examples.ts`.
 */

// ── Kraken palette (scoped — light surface).
const C = {
  bg: "#FFFFFF",
  orange: "#F7931A", // Bitcoin orange — the line + dot color
  green: "#15B870",
  red: "#FF4D4D",
  text: "#0A0A0A",
  muted: "rgba(0,0,0,0.45)",
  skeleton: "rgba(0,0,0,0.06)",
  skeletonStrong: "rgba(0,0,0,0.11)",
  hairline: "rgba(0,0,0,0.08)",
  crosshair: "rgba(0,0,0,0.30)",
  // Faint orange tint for the dot lattice under the line — kept subtle so it
  // reads as texture, not a second data layer.
  areaDots: "rgba(247,147,26,0.18)",
} as const;

const FONT_BOLD = "PlusJakartaSans_700Bold";
const FONT_SEMIBOLD = "PlusJakartaSans_600SemiBold";
const FONT_MEDIUM = "PlusJakartaSans_500Medium";

// Seed/start price (BTC ~ $55.9k). The sim walks proportionally (steps scale
// with the price), so the line stays lively.
const START_PRICE = 55866.9;

// Chart geometry. A short ~3min "LIVE" window so the chart visibly scrolls (the
// dot pushes in at the right and the line drifts left). `historyRange: "1m"`
// seeds ~1 point/sec so the window fills edge-to-edge (a plain
// `historySpanSeconds` would inherit the 60s default step and seed nearly empty
// — see the candle-seed-density note).
const WINDOW_SECS = 180;
const CHART_HEIGHT = 230;

/**
 * Worklet-safe USD axis formatter (NO `Intl` — `grid.ts` calls `formatValue` on
 * the UI thread, so it must be a worklet; `Intl` is not worklet-safe). Groups
 * thousands with "," and drops the cents → "$58,000".
 */
function formatUsd(v: number): string {
  "worklet";
  const sign = v < 0 ? "-" : "";
  const digits = String(Math.round(Math.abs(v)));
  let grouped = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += ",";
    grouped += digits[i];
  }
  return `${sign}$${grouped}`;
}

/** "13:15" — 24-hour clock to the minute, for the scrub time label. */
function formatClock(t: number): string {
  "worklet";
  const d = new Date(t * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Price + change readout formatting (React thread — `Intl` is fine here).
const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Scrub tooltip — a small grey pill with the time, floated centred at the top of
 * the plot. Bound to the `timeStr` SharedValue so it updates on the UI thread
 * while scrubbing (no JS re-render per pointer move).
 */
function KrakenTooltip({ timeStr }: TooltipRenderProps) {
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

/** Grey placeholder block (bar or, with `r = h/2`, a circle). */
function Sk({
  w,
  h,
  r = 6,
  strong,
  style,
}: {
  w?: DimensionValue;
  h: number;
  r?: number;
  strong?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          width: w,
          height: h,
          borderRadius: r,
          backgroundColor: strong ? C.skeletonStrong : C.skeleton,
        },
        style,
      ]}
    />
  );
}

/** BTC mark — an orange coin with the Bitcoin glyph. The only real logo on the
 *  otherwise-skeleton page (alongside the ticker + name). */
function BtcLogo({ size = 34 }: { size?: number }) {
  return (
    <View
      style={[
        styles.logo,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Ionicons name="logo-bitcoin" size={size * 0.6} color="#FFFFFF" />
    </View>
  );
}

/**
 * Live price + change readout (the only "real" content besides the chart).
 * Mirrors `value` (or the scrubbed value) and the `baseline` (window-open) into
 * React state via UI-thread reactions — once per change, not per frame — flashes
 * the price green/red on each tick, and computes change/percent against that live
 * baseline. Seeded with plain numbers (never reads a SharedValue during render →
 * no strict-mode warning).
 */
function KrakenPriceReadout({
  value,
  baseline,
}: {
  value: SharedValue<number>;
  baseline: SharedValue<number>;
}) {
  const flash = useSharedValue(0);
  const [raw, setRaw] = useState(START_PRICE);
  const [base, setBase] = useState(START_PRICE);

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

  // Baseline steps slowly (only as the window-open point scrolls), so this fires
  // far less than once per tick.
  useAnimatedReaction(
    () => baseline.get(),
    (b, prev) => {
      if (b !== prev && Number.isFinite(b)) runOnJS(setBase)(b);
    },
  );

  const priceStyle = useAnimatedStyle(() => ({
    color: interpolateColor(flash.get(), [-1, 0, 1], [C.red, C.text, C.green]),
  }));

  const delta = raw - base;
  const pct = base !== 0 ? (delta / base) * 100 : 0;
  const up = delta >= 0;
  const changeColor = up ? C.green : C.red;

  return (
    <View>
      <Animated.Text style={[styles.price, priceStyle]}>
        {USD_FMT.format(raw)}
      </Animated.Text>
      <Text style={[styles.change, { color: changeColor }]}>
        {up ? "+" : "−"}
        {USD_FMT.format(Math.abs(delta))} · {up ? "↗" : "↘"}{" "}
        {Math.abs(pct).toFixed(2)}%
      </Text>
    </View>
  );
}

/** One stats skeleton row: grey label (left) + grey value (right). */
function StatRow() {
  return (
    <View style={styles.statRow}>
      <Sk w={96} h={13} />
      <Sk w={64} h={13} />
    </View>
  );
}

export default function KrakenShowcase() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Live feed: 3 ticks/sec → a busy, fast-moving line. Line-only (no candles /
  // tape / multi-series) keeps the per-tick work minimal.
  const { data, value } = useSimulatedChartData({
    volatilityMode: "normal",
    tradesPerSecond: 3,
    startValue: START_PRICE,
    tokenSymbol: "BTC",
    multiSeries: false,
    tradeStream: false,
    candleAggregation: false,
    historyRange: "1m",
    historySpanSeconds: WINDOW_SECS + 20,
    maxPoints: 4000,
  });

  // The readout follows the live value, except while scrubbing it shows the
  // crosshair's value (and snaps back to live when the gesture ends).
  const isScrubbing = useSharedValue(false);
  const displayValue = useSharedValue(START_PRICE);
  useAnimatedReaction(
    () => value.get(),
    (v) => {
      if (!isScrubbing.get()) displayValue.set(v);
    },
  );

  // Live window-open reference = the value of the first point inside the window
  // (latest time − window). Drives the change % so it reflects the visible
  // window, not a fixed anchor that drifts the whole session.
  const baseline = useSharedValue(START_PRICE);
  useAnimatedReaction(
    () => {
      const arr = data.get();
      const n = arr.length;
      if (n === 0) return START_PRICE;
      const openT = arr[n - 1].time - WINDOW_SECS;
      // Binary search for the first point at/after the window's left edge (data
      // is time-sorted; the buffer can hold more than the window).
      let lo = 0;
      let hi = n - 1;
      let idx = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid].time >= openT) {
          idx = mid;
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }
      return arr[idx].value;
    },
    (openVal) => {
      if (Number.isFinite(openVal)) baseline.set(openVal);
    },
  );

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar style="dark" />

      {/* ── Header: real back button + BTC ticker, everything else grey */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to Examples"
        >
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </Pressable>
        <Text style={styles.hdrTitle}>BTC</Text>
        <View style={styles.headerIcons}>
          <Sk w={26} h={26} r={13} />
          <Sk w={26} h={26} r={13} />
          <Sk w={26} h={26} r={13} />
        </View>
      </View>

      {/* ── Asset mark + name */}
      <View style={styles.nameBlock}>
        <BtcLogo size={34} />
        <Text style={styles.tokenName}>Bitcoin</Text>
      </View>

      {/* ── Price + change (the live readout) */}
      <View style={styles.priceBlock}>
        <KrakenPriceReadout value={displayValue} baseline={baseline} />
      </View>

      {/* ── Hero chart: thin orange line + dot-lattice area fill + scrub crosshair */}
      <View style={styles.chartWrap}>
        <LiveChart
          data={data}
          value={value}
          // Transparent container so the white page shows through.
          style={styles.chartCanvas}
          theme="light"
          accentColor={C.orange}
          line={{ color: C.orange, width: 2 }}
          // ✦ The feature: a fine, faint dot lattice filling the area UNDER the
          //   line — tight pitch + low alpha so it reads as texture. Pitch/alpha
          //   measured off the reference (~2% of width, ~9–10 rows per gridline).
          areaDots={{ spacing: 8, size: 1.5, color: C.areaDots }}
          gradient={false}
          dot={{ radius: 4 }}
          pulse={{ maxRadius: 14, strokeWidth: 6, opacity: 0.3 }}
          badge={false}
          valueLine={false}
          momentum={false}
          // Right-gutter price labels only — no horizontal grid lines (a clean
          // chart). `gridStyle.opacity: 0` hides the lines; labels are unaffected.
          yAxis
          gridStyle={{ opacity: 0 }}
          xAxis={false}
          formatValue={formatUsd}
          // Right gutter ≈ 21% of width to match the reference (plot ends ~78%
          // across, labels occupy the right ~22% with a ~16pt right margin); top
          // band for the scrub time pill; small bottom inset floats the line.
          insets={{ left: 0, right: 84, top: 36, bottom: 18 }}
          timeWindow={WINDOW_SECS}
          formatTime={formatClock}
          renderTooltip={KrakenTooltip}
          selectionDot={{ size: 5, color: C.orange, ring: false }}
          scrub={{
            tooltipPlacement: "top",
            crosshairLineColor: C.crosshair,
            // Dashed vertical crosshair.
            crosshairDash: [3, 4],
            tooltipMargin: 10,
            dimOpacity: 0.22,
          }}
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

      {/* ── Timeframe selector (grey pills, first = active) */}
      <View style={styles.timeframes}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Sk key={i} h={28} r={9} strong={i === 0} style={styles.tfChip} />
        ))}
      </View>

      {/* ── Action buttons (grey placeholders) */}
      <View style={styles.actionRow}>
        <Sk w="48%" h={48} r={14} />
        <Sk w="48%" h={48} r={14} />
      </View>

      {/* ── Stats (grey heading + rows) */}
      <View style={styles.section}>
        <Sk w={150} h={20} strong />
        <StatRow />
        <StatRow />
      </View>

      <View style={{ flex: 1 }} />

      {/* ── Footer CTAs (grey skeleton placeholders) */}
      <View style={styles.ctaArea}>
        <Sk w="48%" h={52} r={16} />
        <Sk w="48%" h={52} r={16} strong />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 48,
  },
  backButton: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  hdrTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: FONT_BOLD,
    color: C.text,
    // Offset the back button so the title is visually centred.
    marginLeft: -26,
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    backgroundColor: C.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  nameBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  tokenName: {
    fontSize: 17,
    fontFamily: FONT_SEMIBOLD,
    color: C.text,
  },
  priceBlock: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  price: {
    fontSize: 34,
    fontFamily: FONT_BOLD,
    letterSpacing: -0.5,
    // Tabular figures: equal-width digits so the ticking price doesn't jitter.
    fontVariant: ["tabular-nums"],
  },
  change: {
    fontSize: 14,
    fontFamily: FONT_SEMIBOLD,
    fontVariant: ["tabular-nums"],
    marginTop: 8,
  },
  chartWrap: {
    height: CHART_HEIGHT,
    marginTop: 10,
  },
  chartCanvas: {
    backgroundColor: "transparent",
  },
  timeframes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  tfChip: {
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 18,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 22,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hairline,
  },
  ctaArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tip: {
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tipText: {
    // Fixed width (measured once) + centred — wide enough for "13:15".
    width: 44,
    textAlign: "center",
    color: C.text,
    fontSize: 13,
    fontFamily: FONT_MEDIUM,
    fontVariant: ["tabular-nums"],
    padding: 0,
  },
});
