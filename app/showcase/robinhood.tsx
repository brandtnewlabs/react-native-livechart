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
  type ChartSegment,
  LiveChart,
  type LiveChartPoint,
  type ScrubPoint,
  type TooltipRenderProps,
} from "react-native-livechart";
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
} from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Robinhood (EU) — tokenized-stock detail recreation.
 *
 * Same skeleton philosophy as Fomo: everything but the chart and the live price
 * readout is a grey placeholder. The chart matches Robinhood's: a clean, thin,
 * hard-edged (miter joins) line on pure black with NO grid / fill / glow / dot,
 * framed as a fixed 1-week historical view. The only chart interaction is the
 * scrub dim-split — the line stays full colour up to the crosshair and the part
 * past it drops to a strong fade — plus a plain date/time tooltip.
 *
 * To add another app, copy this file to `app/showcase/<id>.tsx` and register it
 * in `demo-lib/examples.ts`.
 */

const C = {
  bg: "#000000",
  green: "#4FE05A",
  red: "#FF5247",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.5)",
  skeleton: "rgba(255,255,255,0.08)",
  skeletonStrong: "rgba(255,255,255,0.14)",
  hairline: "rgba(255,255,255,0.1)",
  crosshair: "rgba(255,255,255,0.45)",
} as const;

const FONT_BOLD = "PlusJakartaSans_700Bold";
const FONT_SEMIBOLD = "PlusJakartaSans_600SemiBold";
const FONT_MEDIUM = "PlusJakartaSans_500Medium";

const START_PRICE = 113; // a week ago; drifts up/down to "now" within a few %.
const SPAN_SECS = 7 * 24 * 3600; // 1 week (the selected "1W" timeframe)
const POINT_COUNT = 180;
const CHANGE_LABEL = "Letzte Woche";

// German formatting to match the screenshots: "119,03 $" and "5,19 %".
const PRICE_FMT = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const PCT_FMT = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// "HH:MM, D Mon" for the scrub tooltip (German month abbreviations, each 3 chars).
const MONTHS_DE = "JanFebMärAprMaiJunJulAugSepOktNovDez";
function formatStamp(t: number) {
  "worklet";
  const d = new Date(t * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const m = d.getMonth();
  return `${hh}:${mm}, ${d.getDate()} ${MONTHS_DE.slice(m * 3, m * 3 + 3)}`;
}

/** A fixed week of edgy prices — small steps so the change stays realistic (~few %). */
function seedWeek(endTime: number) {
  const start = endTime - SPAN_SECS;
  const points: LiveChartPoint[] = [];
  let v = START_PRICE;
  for (let i = 0; i < POINT_COUNT; i++) {
    const time = start + (i / (POINT_COUNT - 1)) * SPAN_SECS;
    v += (Math.random() - 0.5) * 1.3; // small, frequent reversals → sharp zigzags
    points.push({ time, value: v });
  }
  return {
    points,
    open: points[0].value,
    last: points[points.length - 1].value,
    now: endTime,
  };
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Scrub tooltip — plain centred text floated at the top of the plot (no pill). */
function RobinhoodTooltip({ timeStr }: TooltipRenderProps) {
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

/**
 * Price (white) + change readout. Shows the week's close at rest, the crosshair
 * value while scrubbing; change is vs the week open, and the period suffix hides
 * while scrubbing — matching the screenshots.
 */
function RobinhoodPriceReadout({
  value,
  baseline,
  initial,
  scrubbing,
}: {
  value: SharedValue<number>;
  baseline: number;
  initial: number;
  scrubbing: SharedValue<boolean>;
}) {
  const [raw, setRaw] = useState(initial);
  const [isScrubbing, setIsScrubbing] = useState(false);

  useAnimatedReaction(
    () => value.get(),
    (cur, prev) => {
      if (cur !== prev && Number.isFinite(cur)) runOnJS(setRaw)(cur);
    },
  );
  useAnimatedReaction(
    () => scrubbing.get(),
    (s, prev) => {
      if (s !== prev) runOnJS(setIsScrubbing)(s);
    },
  );

  const delta = raw - baseline;
  const up = delta >= 0;
  const changeColor = up ? C.green : C.red;
  const pct = baseline !== 0 ? delta / baseline : 0;

  return (
    <View>
      <Text style={styles.price}>{PRICE_FMT.format(raw)}</Text>
      <View style={styles.changeRow}>
        <Text style={[styles.change, { color: changeColor }]}>
          {up ? "▲" : "▼"} {PRICE_FMT.format(Math.abs(delta))} (
          {PCT_FMT.format(Math.abs(pct))})
        </Text>
        {!isScrubbing ? (
          <Text style={styles.changeSuffix}> {CHANGE_LABEL}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** One fake bottom tab icon. */
function TabIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return <Ionicons name={name} size={24} color={C.skeletonStrong} />;
}

export default function RobinhoodShowcase() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Fixed historical week — seeded once. `nowOverride` + `timeWindow` pin the
  // frame (no live scroll), like a real 1W view.
  const [seed] = useState(() => seedWeek(Date.now() / 1000));
  const data = useSharedValue<LiveChartPoint[]>(seed.points);
  const value = useSharedValue(seed.last);

  // Readout follows the week's close, or the crosshair value while scrubbing.
  const isScrubbing = useSharedValue(false);
  const displayValue = useSharedValue(seed.last);

  const trendDown = seed.last < seed.open;
  const trendColor = trendDown ? C.red : C.green;

  // Robinhood "segments on scroll" — the documented `segments` scrub-focus model:
  // three equal sessions, no dividers. At rest the line is one colour; scrubbing
  // into a session keeps it full and fades the OTHER segments. With no dividers the
  // fade has to carry it, so the off-segments drop hard (the focused one pops).
  const muted = trendDown ? "rgba(255,82,71,0.2)" : "rgba(79,224,90,0.2)";
  const segStart = seed.now - SPAN_SECS;
  const t1 = segStart + SPAN_SECS / 3;
  const t2 = segStart + (2 * SPAN_SECS) / 3;
  const segments: ChartSegment[] = [
    { to: t1, mutedColor: muted },
    { from: t1, to: t2, mutedColor: muted },
    { from: t2, mutedColor: muted },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* ── Header: back + centred symbol skeleton + add */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.headerSide}
          accessibilityRole="button"
          accessibilityLabel="Back to Examples"
        >
          <Ionicons name="chevron-back" size={26} color={C.green} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Sk w={84} h={13} />
          <Sk w={44} h={9} style={{ marginTop: 5 }} />
        </View>
        <View style={[styles.headerSide, { alignItems: "flex-end" }]}>
          <Ionicons name="add-circle-outline" size={28} color={C.green} />
        </View>
      </View>

      {/* ── Symbol + Token badge (grey) */}
      <View style={styles.symbolRow}>
        <Sk w={62} h={16} strong />
        <Sk w={78} h={26} r={13} />
      </View>

      {/* ── Fund name (grey, two lines) */}
      <View style={styles.nameBlock}>
        <Sk w="82%" h={20} style={{ marginBottom: 7 }} />
        <Sk w="64%" h={20} />
      </View>

      {/* ── Price + change */}
      <View style={styles.priceBlock}>
        <RobinhoodPriceReadout
          value={displayValue}
          baseline={seed.open}
          initial={seed.last}
          scrubbing={isScrubbing}
        />
        {/* bid / ask (Geldkurs · Briefkurs) — grey */}
        <Sk w="62%" h={12} style={{ marginTop: 10 }} />
      </View>

      {/* ── Hero chart: clean hard-edged line + scrub dim-split + date tooltip */}
      <View style={styles.chartWrap}>
        <LiveChart
          data={data}
          value={value}
          theme="dark"
          accentColor={trendColor}
          // Thin + fully hard-edged: `curve: "linear"` draws straight segments (no
          // spline smoothing), miter joins keep peaks as sharp points (0 corner
          // radius), butt caps keep the ends flat. No rounding anywhere.
          line={{
            color: trendColor,
            width: 1.4,
            curve: "linear",
            join: "miter",
            cap: "butt",
          }}
          segments={segments}
          dot={false}
          pulse={false}
          gradient={false}
          badge={false}
          valueLine={false}
          momentum={false}
          yAxis={false}
          xAxis={false}
          insets={{ left: 0, right: 0, top: 24, bottom: 24 }}
          timeWindow={SPAN_SECS}
          nowOverride={seed.now}
          windowBuffer={0}
          formatTime={formatStamp}
          renderTooltip={RobinhoodTooltip}
          selectionDot={{ size: 4, color: trendColor, ring: { width: 2 } }}
          scrub={{
            tooltipPlacement: "top",
            crosshairLineColor: C.crosshair,
            // De-emphasis is handled by `segments` (scrub-focus), not dimOpacity.
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

      {/* ── Timeframe selector (grey pills) */}
      <View style={styles.timeframes}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Sk key={i} h={26} r={8} strong={i === 1} style={styles.tfChip} />
        ))}
      </View>

      {/* ── "Übersicht" + description (grey) */}
      <View style={styles.overview}>
        <Sk w={120} h={22} strong />
        <Sk w="92%" h={13} style={{ marginTop: 16 }} />
        <Sk w="88%" h={13} style={{ marginTop: 9 }} />
        <Sk w="48%" h={13} style={{ marginTop: 9 }} />
      </View>

      <View style={{ flex: 1 }} />

      {/* ── Fake bottom tab bar */}
      <View style={[styles.tabBar, { paddingBottom: insets.bottom + 6 }]}>
        <TabIcon name="trending-up-outline" />
        <TabIcon name="cube-outline" />
        <TabIcon name="sync-circle-outline" />
        <TabIcon name="search-outline" />
        <TabIcon name="person-outline" />
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
    paddingHorizontal: 16,
    height: 44,
  },
  headerSide: {
    width: 40,
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  nameBlock: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  priceBlock: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  price: {
    color: C.text,
    fontSize: 34,
    fontFamily: FONT_BOLD,
    letterSpacing: -0.5,
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
    color: C.muted,
    fontSize: 14,
    fontFamily: FONT_MEDIUM,
  },
  chartWrap: {
    height: 320,
    marginTop: 10,
  },
  timeframes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  tfChip: {
    flex: 1,
  },
  overview: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.hairline,
  },
  tipText: {
    // Fixed width (measured once) — wide enough for "20:00, 11 Jun" at this size.
    width: 156,
    textAlign: "center",
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    fontFamily: FONT_MEDIUM,
    fontVariant: ["tabular-nums"],
    padding: 0,
  },
});
