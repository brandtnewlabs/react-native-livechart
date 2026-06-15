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
 * Backpack — token-detail recreation (light theme).
 *
 * Same skeleton philosophy as the other showcases (Fomo / Robinhood): everything
 * but the chart and the live price readout is a grey placeholder, so focus stays
 * on LiveChart and the ticking numbers. The only "real" pieces are the back
 * button, the `LiveChart`, and `BackpackPriceReadout` (price + change).
 *
 * The chart matches Backpack's: a thin, hard-edged (linear + miter) green line on
 * a WHITE background with NO grid / fill, a soft pulsing live dot at the leading
 * edge, and a live-scrolling 1H window. The scrub draws a top time label + a
 * crosshair and dims the "future" (everything right of the crosshair) via the
 * documented `dimOpacity` split — exactly the second screenshot.
 *
 * To add another app, copy this file to `app/showcase/<id>.tsx` and register it
 * in `demo-lib/examples.ts`.
 */

// ── Backpack palette (scoped — light surface).
const C = {
  bg: "#FFFFFF",
  green: "#1FC85C",
  red: "#FF4D4D",
  text: "#0A0A0A",
  muted: "rgba(0,0,0,0.45)",
  skeleton: "rgba(0,0,0,0.06)",
  skeletonStrong: "rgba(0,0,0,0.11)",
  hairline: "rgba(0,0,0,0.08)",
  crosshair: "rgba(0,0,0,0.28)",
} as const;

const FONT_BOLD = "PlusJakartaSans_700Bold";
const FONT_SEMIBOLD = "PlusJakartaSans_600SemiBold";
const FONT_MEDIUM = "PlusJakartaSans_500Medium";

// Seed/start price. The change % is measured against the live window-open value
// (computed in BackpackShowcase) so it stays realistic as the feed runs.
const START_PRICE = 0.45059;

// Chart geometry. A short ~90s "LIVE" window so the chart visibly scrolls (the
// dot pushes in at the right and the line drifts left), framed as the "1H" tab.
// `historyRange: "1m"` seeds ~1 point/sec so the window fills edge-to-edge (a
// plain `historySpanSeconds` would inherit the 60s default step and seed nearly
// empty — see the candle-seed-density note).
const WINDOW_SECS = 90;
const CHANGE_LABEL = "1h"; // the period the % readout covers (the selected tab)
const CHART_HEIGHT = 248;

// Built once (constructing Intl.NumberFormat per render is slow). 5 dp currency
// renders the sub-dollar price as "$0.45059".
const PRICE_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

// "9:12:07.531 PM" — 12-hour clock, no leading zero on the hour, down to the
// millisecond (the live feed ticks sub-second, so ms distinguishes points).
function formatStamp(t: number) {
  "worklet";
  const d = new Date(t * 1000);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m}:${s}.${ms} ${ampm}`;
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Scrub tooltip — plain centred grey text floated at the top of the plot (no
 * pill), matching Backpack's "9:12 PM" label. Bound to the `timeStr` SharedValue
 * so it updates on the UI thread while scrubbing (no JS re-render per move).
 */
function BackpackTooltip({ timeStr }: TooltipRenderProps) {
  const animatedProps = useAnimatedProps(() => {
    const t = timeStr.get();
    return { text: t, defaultValue: t };
  });
  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      style={styles.tipText}
      animatedProps={animatedProps}
    />
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

/** Tiny candlestick glyph for the (decorative, line-mode) chart-type toggle. */
function CandleGlyph() {
  return (
    <View style={styles.glyph}>
      <View style={styles.glyphCandle}>
        <View style={[styles.glyphWick, { backgroundColor: C.skeletonStrong }]} />
        <View
          style={[
            styles.glyphBody,
            { backgroundColor: C.skeletonStrong, height: 9, marginTop: -3 },
          ]}
        />
      </View>
      <View style={styles.glyphCandle}>
        <View style={[styles.glyphWick, { backgroundColor: C.skeletonStrong }]} />
        <View
          style={[
            styles.glyphBody,
            { backgroundColor: C.skeletonStrong, height: 7, marginTop: 4 },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * Live price + change readout (the only "real" content besides the chart).
 * Mirrors `value` (or the scrubbed value) and the `baseline` (the window-open)
 * into React state via UI-thread reactions — once per change, not per frame —
 * flashes the price green/red on each tick, and computes change/percent against
 * that live baseline. The secondary stats (Mkt Cap / Vol) stay grey skeletons.
 * Seeded with plain numbers (never reads a SharedValue during render → no
 * strict-mode warning).
 */
function BackpackPriceReadout({
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
      <View style={styles.priceRow}>
        <Animated.Text style={[styles.price, priceStyle]}>
          {PRICE_FMT.format(raw)}
        </Animated.Text>
        <Ionicons name="swap-vertical" size={18} color={C.muted} />
      </View>
      <View style={styles.statsRow}>
        <Text style={[styles.change, { color: changeColor }]}>
          {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
        </Text>
        <Text style={styles.changeSuffix}> {CHANGE_LABEL}</Text>
        {/* Secondary stats (Mkt Cap · 24h Vol) — grey skeletons. */}
        <Sk w={78} h={13} style={{ marginLeft: 14 }} />
        <Sk w={64} h={13} style={{ marginLeft: 10 }} />
      </View>
    </View>
  );
}

export default function BackpackShowcase() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Live feed: 3 ticks/sec → a busy, fast-moving line. Line-only (no candles /
  // tape / multi-series) keeps the per-tick work minimal.
  const { data, value } = useSimulatedChartData({
    volatilityMode: "normal",
    tradesPerSecond: 3,
    startValue: START_PRICE,
    tokenSymbol: "BP",
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
  // (latest time − window). Drives the change % and the red/green trend so both
  // reflect the visible window, not a fixed anchor that drifts the whole session.
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

  // Red when the price is below the window-open, green when above — recolors the
  // line, dot, and glow together. Flips only on a crossing (rare).
  const [trendDown, setTrendDown] = useState(false);
  useAnimatedReaction(
    () => value.get() < baseline.get(),
    (down, prev) => {
      if (down !== prev) runOnJS(setTrendDown)(down);
    },
  );
  const trendColor = trendDown ? C.red : C.green;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* ── Header: real back button, everything else grey */}
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
        <Sk w={30} h={30} r={15} />
        <View style={styles.headerTitle}>
          <Sk w={42} h={13} strong />
          <Sk w={72} h={10} style={{ marginTop: 5 }} />
        </View>
        <View style={styles.headerIcons}>
          <Sk w={24} h={24} r={12} />
          <Sk w={6} h={22} r={3} />
        </View>
      </View>

      {/* ── Token name (grey) */}
      <View style={styles.nameBlock}>
        <Sk w={150} h={24} strong />
      </View>

      {/* ── Price + change (the live readout) */}
      <View style={styles.priceBlock}>
        <BackpackPriceReadout value={displayValue} baseline={baseline} />
      </View>

      {/* ── Hero chart: clean edgy green line + pulse dot + scrub dim-split */}
      <View style={styles.chartWrap}>
        <LiveChart
          data={data}
          value={value}
          // Transparent container so the pure-white page shows through (the light
          // theme's default surface is a faint zinc-50 wash). The scrub dim erases
          // to this same white via `dstOut`.
          style={styles.chartCanvas}
          theme="light"
          accentColor={trendColor}
          // Bold + hard-edged: `curve: "linear"` draws straight segments (no
          // spline smoothing) and `join: "miter"` keeps peaks as sharp points.
          line={{ color: trendColor, width: 3.5, curve: "linear", join: "miter" }}
          dot={{ radius: 4.5 }}
          // Soft halo that grows out from the dot and fades — reads as the
          // "live" pulse at the leading edge.
          pulse={{ maxRadius: 16, strokeWidth: 7, opacity: 0.35 }}
          gradient={false}
          badge={false}
          valueLine={false}
          momentum={false}
          yAxis={false}
          xAxis={false}
          // Vertical breathing room; the larger top inset is a header band the
          // scrub time label floats in (see `tooltipMargin` below). A small right
          // gutter keeps the live-dot glow off the hard edge.
          insets={{ left: 0, right: 16, top: 40, bottom: 20 }}
          timeWindow={WINDOW_SECS}
          formatTime={formatStamp}
          renderTooltip={BackpackTooltip}
          selectionDot={{ size: 5, color: trendColor, ring: false }}
          scrub={{
            tooltipPlacement: "top",
            crosshairLineColor: C.crosshair,
            // Dashed vertical line, like Backpack's scrub crosshair.
            crosshairDash: [3, 4],
            // Negative margin lifts the time label up into the top inset so it
            // sits ABOVE the crosshair line (which starts at the plot top),
            // rather than the line running behind the text.
            tooltipMargin: -26,
            dimOpacity: 0.28,
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

      {/* ── Timeframe selector (grey pills, first = active) + chart-type toggle */}
      <View style={styles.timeframes}>
        <View style={styles.tfPills}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Sk key={i} h={30} r={9} strong={i === 0} style={styles.tfChip} />
          ))}
        </View>
        <View style={styles.chartTypeBtn}>
          <CandleGlyph />
        </View>
      </View>

      {/* ── About (grey heading + description) */}
      <View style={styles.section}>
        <Sk w={92} h={20} strong />
        <Sk w="92%" h={13} style={{ marginTop: 16 }} />
        <Sk w="78%" h={13} style={{ marginTop: 9 }} />
        <View style={styles.linkRow}>
          <Sk w={36} h={36} r={18} />
          <Sk w={36} h={36} r={18} />
          <Sk w={132} h={36} r={18} />
        </View>
      </View>

      {/* ── Stats (grey heading + one row) */}
      <View style={styles.section}>
        <Sk w={76} h={20} strong />
        <View style={styles.statLine}>
          <Sk w={96} h={13} />
          <Sk w={44} h={13} />
        </View>
      </View>

      <View style={{ flex: 1 }} />

      {/* ── Buy CTA (grey placeholder button) */}
      <View style={[styles.ctaArea, { paddingBottom: insets.bottom + 8 }]}>
        <Sk w="100%" h={54} r={27} strong />
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
  headerTitle: {
    flex: 1,
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  nameBlock: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  priceBlock: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  price: {
    fontSize: 36,
    fontFamily: FONT_BOLD,
    letterSpacing: -0.5,
    // Tabular figures: equal-width digits so the ticking price doesn't jitter.
    fontVariant: ["tabular-nums"],
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  change: {
    fontSize: 14,
    fontFamily: FONT_SEMIBOLD,
    fontVariant: ["tabular-nums"],
  },
  changeSuffix: {
    color: C.muted,
    fontSize: 14,
    fontFamily: FONT_MEDIUM,
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
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  tfPills: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  tfChip: {
    flex: 1,
  },
  chartTypeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
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
  glyphWick: {
    position: "absolute",
    width: 1.5,
    height: 16,
    borderRadius: 1,
  },
  glyphBody: {
    width: 6,
    borderRadius: 1.5,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 18,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  statLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hairline,
  },
  ctaArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tipText: {
    // Fixed width (measured once) + centred — wide enough for "12:00:00.000 PM".
    width: 168,
    textAlign: "center",
    color: C.muted,
    fontSize: 14,
    fontFamily: FONT_MEDIUM,
    fontVariant: ["tabular-nums"],
    padding: 0,
  },
});
