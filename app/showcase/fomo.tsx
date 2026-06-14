import { Ionicons } from "@expo/vector-icons";
import { Canvas, Points, vec } from "@shopify/react-native-skia";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  type DimensionValue,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
 * Fomo — token-detail recreation.
 *
 * Per the reference screenshots, everything except the chart and the live
 * top-left price readout is a grey skeleton: it keeps focus on LiveChart and the
 * ticking numbers without faking avatars / usernames / copy. The only "real"
 * pieces are the back button (so you can leave), the `LiveChart`, and
 * `FomoPriceReadout` (price + change, driven by the live value SharedValue and
 * retargeted to the scrubbed point while the crosshair is active).
 *
 * To add another app, copy this file to `app/showcase/<id>.tsx` and register it
 * in `demo-lib/examples.ts`.
 */

// ── Fomo palette (scoped — does not touch the app-wide light theme).
const C = {
  bg: "#0A0A0E",
  green: "#23D55C",
  red: "#FF5247",
  white: "#FFFFFF",
  skeleton: "rgba(255,255,255,0.07)",
  skeletonStrong: "rgba(255,255,255,0.13)",
  tooltipBg: "#1E1E26",
  hairline: "rgba(255,255,255,0.08)",
} as const;

const FONT_BOLD = "PlusJakartaSans_700Bold";
const FONT_SEMIBOLD = "PlusJakartaSans_600SemiBold";
const FONT_MEDIUM = "PlusJakartaSans_500Medium";

// Seed/start price. The change % is measured against the live window-open value
// (computed in FomoShowcase) so it stays realistic as the feed runs.
const START_PRICE = 0.00389;

// Chart geometry. Short 1-minute "LIVE" window so the chart visibly scrolls
// (~6px/s) instead of crawling; 3s candles → ~20 bars. The seed is far finer than
// the candle width, so each candle still aggregates many ticks (bodies + wicks).
const WINDOW_SECS = 60;
const CANDLE_WIDTH_SECS = 3;
// Suffix on the change readout — the period the % covers (= the window).
const CHANGE_LABEL = "1m";
const CHART_HEIGHT = 300;
// Dotted backdrop (Skia), behind the transparent chart canvas — like Fomo's grid.
// Tight lattice + tiny dots to match Fomo's fine, dense field.
const GRID_SPACING = 12;
const GRID_DOT_SIZE = 1.6;

// Built once (constructing Intl.NumberFormat per render is slow). 5 dp currency
// renders the sub-cent price as "$0.00389".
const PRICE_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Custom scrub tooltip (`renderTooltip`) — a fixed-width RN pill with the time
 * centred via `textAlign`. The chart floats it centred over the crosshair (it
 * inherits `scrub.tooltipPlacement="top"`), so this owns the exact centring the
 * built-in pill's monospace width estimate couldn't get right with a
 * proportional font. The time is bound to the `timeStr` SharedValue so it
 * updates on the UI thread while scrubbing — no JS re-render per pointer move.
 */
function FomoTooltip({ timeStr }: TooltipRenderProps) {
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

/**
 * Tiny candlestick glyph for the chart-type toggle: an up (green) + down (red)
 * candle when active, muted grey when line mode is showing. Built from views so
 * it reads exactly like Fomo's red/green bars (no candlestick in the icon set).
 */
function CandleGlyph({ active }: { active: boolean }) {
  const up = active ? C.green : C.skeletonStrong;
  const down = active ? C.red : C.skeletonStrong;
  return (
    <View style={styles.glyph}>
      <View style={styles.glyphCandle}>
        <View style={[styles.glyphWick, { backgroundColor: up }]} />
        <View
          style={[styles.glyphBody, { backgroundColor: up, height: 9, marginTop: -3 }]}
        />
      </View>
      <View style={styles.glyphCandle}>
        <View style={[styles.glyphWick, { backgroundColor: down }]} />
        <View
          style={[styles.glyphBody, { backgroundColor: down, height: 7, marginTop: 4 }]}
        />
      </View>
    </View>
  );
}

/**
 * Subtle dotted backdrop drawn into a Skia canvas behind the (transparent) chart
 * canvas. One static `Points` draw (round caps = dots); no per-frame work. The
 * chart's line/area composite on top, so the dots only show in the empty plot.
 */
function DotGrid({ width }: { width: number }) {
  const dots = useMemo(() => {
    const pts = [];
    for (let y = GRID_SPACING / 2; y < CHART_HEIGHT; y += GRID_SPACING) {
      for (let x = GRID_SPACING / 2; x < width; x += GRID_SPACING) {
        pts.push(vec(x, y));
      }
    }
    return pts;
  }, [width]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Points
        points={dots}
        mode="points"
        color="rgba(255,255,255,0.06)"
        style="stroke"
        strokeWidth={GRID_DOT_SIZE}
        strokeCap="round"
      />
    </Canvas>
  );
}

/**
 * Live price + change readout. Mirrors `value` (or the scrubbed value) and the
 * `baseline` (the window-open) into React state via UI-thread reactions
 * — once per change, not per frame — flashes the price green/red on each tick,
 * and computes change/percent against that live baseline. Seeded with plain
 * numbers (never reads a SharedValue during render → no strict-mode warning).
 */
function FomoPriceReadout({
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
    color: interpolateColor(flash.get(), [-1, 0, 1], [C.red, C.white, C.green]),
  }));

  const delta = raw - base;
  const pct = base !== 0 ? (delta / base) * 100 : 0;
  const up = delta >= 0;
  const changeColor = up ? C.green : C.red;

  return (
    <View>
      <Animated.Text style={[styles.price, priceStyle]}>
        {PRICE_FMT.format(raw)}
      </Animated.Text>
      <View style={styles.changeRow}>
        <Text style={[styles.change, { color: changeColor }]}>
          {up ? "▲" : "▼"} ${Math.abs(delta).toFixed(7)} (
          {Math.abs(pct).toFixed(2)}%)
        </Text>
        <Text style={styles.changeSuffix}> {CHANGE_LABEL}</Text>
      </View>
    </View>
  );
}

/** One skeleton holder row: avatar + name/sub on the left, value/pct on the right. */
function HolderRow() {
  return (
    <View style={styles.holderRow}>
      <Sk w={40} h={40} r={20} />
      <View style={styles.holderText}>
        <Sk w={96} h={14} />
        <Sk w={70} h={11} style={{ marginTop: 6 }} />
      </View>
      <View style={styles.holderRight}>
        <Sk w={92} h={14} />
        <Sk w={52} h={11} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

export default function FomoShowcase() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [chartMode, setChartMode] = useState<"line" | "candle">("line");

  // Live feed: 2 ticks/sec at "normal" volatility (each tick moves the 5-dp price
  // visibly). `historyRange: "1m"` seeds ~1 point/sec so the short window fills
  // edge-to-edge — without it the hook's "1d" default uses a 60s step and leaves
  // the window nearly empty. Candles are aggregated up front so the line↔candle
  // toggle is instant; maxPoints stays well above the window so candles are stable.
  const { data, value, candles, liveCandle } = useSimulatedChartData({
    volatilityMode: "normal",
    tradesPerSecond: 2,
    startValue: START_PRICE,
    tokenSymbol: "WORLDCUP",
    candleAggregation: true,
    candleWidth: CANDLE_WIDTH_SECS,
    historySpanSeconds: WINDOW_SECS + 20,
    historyRange: "1m",
    maxPoints: 4000,
  });
  const candleMode = chartMode === "candle";

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
      // is time-sorted; the buffer can hold more than the window, so skip the
      // older prefix).
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
  // line, dot, glow, and area together. Flips only on a crossing (rare).
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
      <StatusBar style="light" />

      {/* ── Header: real back button, everything else grey */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to Examples"
        >
          <Ionicons name="chevron-back" size={26} color={C.white} />
        </Pressable>
        <Sk w={36} h={36} r={18} />
        <View style={styles.headerTitle}>
          <Sk w={120} h={15} />
          <Sk w={78} h={11} style={{ marginTop: 6 }} />
        </View>
        <View style={styles.headerIcons}>
          <Sk w={26} h={26} r={13} />
          <Sk w={26} h={26} r={13} />
          <Sk w={26} h={26} r={13} />
        </View>
      </View>

      {/* ── Price block: live readout (left) + grey market cap (right) */}
      <View style={styles.priceBlock}>
        <FomoPriceReadout value={displayValue} baseline={baseline} />
        <View style={styles.marketCap}>
          <Sk w={88} h={16} />
          <Sk w={66} h={12} style={{ marginTop: 6 }} />
        </View>
      </View>

      {/* ── Hero chart (dotted backdrop behind a transparent chart canvas) */}
      <View style={styles.chartWrap}>
        <DotGrid width={screenWidth} />
        <LiveChart
          data={data}
          value={value}
          // Transparent container so the DotGrid behind shows through the empty
          // plot (the chart's own <Canvas> paints no background).
          style={styles.chartCanvas}
          theme="dark"
          mode={chartMode}
          candles={candleMode ? candles : undefined}
          liveCandle={candleMode ? liveCandle : undefined}
          candleWidth={CANDLE_WIDTH_SECS}
          // Stable green accent in candle mode (candle bodies are theme green/red),
          // trend-flipping red/green for the line.
          accentColor={candleMode ? C.green : trendColor}
          line={{ color: trendColor, width: 2.5 }}
          dot={{ radius: 4.5 }}
          // Soft glow that grows out from the dot (radius 9 → 16) and fades. A
          // thick-ish stroke reads as a glow without ballooning in size.
          pulse={{ maxRadius: 16, strokeWidth: 7, opacity: 0.4 }}
          gradient={{ topOpacity: 0.16, bottomOpacity: 0 }}
          badge={false}
          valueLine={false}
          momentum={false}
          yAxis={false}
          xAxis={false}
          // Vertical breathing room so the line/area + candles float above the
          // timeframe row instead of reading as cut off at the bottom edge. Small
          // right gutter keeps the live-dot glow from hard-clipping at the edge.
          insets={{ left: 0, right: 16, top: 20, bottom: 26 }}
          timeWindow={WINDOW_SECS}
          // Default formatTime is HH:MM:SS — the right resolution for a 1m window
          // (HH:MM would barely change as you scrub across 60s).
          renderTooltip={FomoTooltip}
          scrub={{
            tooltipPlacement: "top",
            crosshairLineColor: "rgba(255,255,255,0.25)",
            dimOpacity: 0.3,
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

      {/* ── Timeframe selector (grey pills) + line/candle toggle */}
      <View style={styles.timeframes}>
        <View style={styles.tfPills}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Sk key={i} h={30} r={9} strong={i === 0} style={styles.tfChip} />
          ))}
        </View>
        <View style={styles.tfDivider} />
        <Pressable
          onPress={() => setChartMode((m) => (m === "line" ? "candle" : "line"))}
          hitSlop={10}
          style={styles.chartTypeBtn}
          accessibilityRole="button"
          accessibilityLabel={
            candleMode ? "Switch to line chart" : "Switch to candlestick chart"
          }
        >
          <CandleGlyph active={candleMode} />
        </Pressable>
      </View>

      {/* ── Tab row (grey) */}
      <View style={styles.tabs}>
        <Sk w={110} h={15} strong />
        <Sk w={48} h={15} />
        <Sk w={58} h={15} />
      </View>

      {/* ── Holder list (grey skeleton rows) */}
      <View style={styles.holders}>
        <HolderRow />
        <HolderRow />
      </View>

      <View style={{ flex: 1 }} />

      {/* ── Apple Pay button placeholder */}
      <View style={[styles.payArea, { paddingBottom: insets.bottom + 12 }]}>
        <Sk w="100%" h={52} r={16} strong />
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
    paddingHorizontal: 12,
    height: 52,
  },
  backButton: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
  },
  headerIcons: {
    flexDirection: "row",
    gap: 12,
  },
  priceBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  price: {
    fontSize: 36,
    fontFamily: FONT_BOLD,
    letterSpacing: -0.5,
    // Tabular figures: equal-width digits so the ticking price doesn't jitter.
    fontVariant: ["tabular-nums"],
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  change: {
    fontSize: 14,
    fontFamily: FONT_SEMIBOLD,
    fontVariant: ["tabular-nums"],
  },
  changeSuffix: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontFamily: FONT_MEDIUM,
  },
  marketCap: {
    alignItems: "flex-end",
    paddingTop: 6,
  },
  chartWrap: {
    height: CHART_HEIGHT,
    marginTop: 6,
  },
  chartCanvas: {
    backgroundColor: "transparent",
  },
  timeframes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  tfPills: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  tfChip: {
    flex: 1,
  },
  tfDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: C.hairline,
  },
  chartTypeBtn: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    width: 24,
    height: 22,
  },
  glyphCandle: {
    width: 6,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphWick: {
    position: "absolute",
    width: 1.5,
    height: 18,
    borderRadius: 1,
  },
  glyphBody: {
    width: 6,
    borderRadius: 1.5,
  },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    paddingHorizontal: 20,
    marginTop: 22,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hairline,
  },
  holders: {
    paddingHorizontal: 16,
    marginTop: 6,
  },
  holderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  holderText: {
    flex: 1,
  },
  holderRight: {
    alignItems: "flex-end",
  },
  payArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tip: {
    backgroundColor: C.tooltipBg,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.hairline,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tipText: {
    // Fixed width + centered text: the TextInput is measured once at mount, so
    // UI-thread text updates never re-layout. "HH:MM:SS" fits in ~64px.
    width: 64,
    textAlign: "center",
    color: C.white,
    fontSize: 13,
    fontFamily: FONT_MEDIUM,
    fontVariant: ["tabular-nums"],
    padding: 0,
  },
});
