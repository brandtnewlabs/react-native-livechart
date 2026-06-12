import { memo, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";
import {
  LegendList,
  type LegendListRenderItemProps,
} from "@legendapp/list/react-native";
import { LiveChart, type LiveChartPoint } from "react-native-livechart";

import {
  APP_FONT_FAMILY,
  APP_FONT_FAMILY_MEDIUM,
  APP_FONT_FAMILY_SEMIBOLD,
} from "../../demo-lib/fonts";
import { demoStyles } from "../../demo-lib/styles";
import { APP_THEME, colors } from "../../demo-lib/theme";

export const options = { title: "Coin list" };

// Hundreds of rows, each a static sparkline, in one virtualized + recycled list.
const COIN_COUNT = 500;
const ROW_HEIGHT = 64;
const SPARK_WIDTH = 76;
const SPARK_HEIGHT = 32;
// 24 points reads the same at 76px wide but halves the per-row SkPath the
// static-settle rebuilds when a row recycles — cheaper UI-thread work on a fast
// fling. (The line already decimates to ~pixel resolution, so more points here
// buy nothing visible.)
const SPARK_POINTS = 24;
const SPARK_SPAN = 60; // seconds of history per sparkline

const UP = "#16a34a";
const DOWN = "#dc2626";

// Meme-coin name parts — combined into ~800 plausible names so 500 coins read
// as a believable market list rather than "Coin 1 … Coin 500".
const PREFIXES = [
  "Doge", "Shiba", "Pepe", "Bonk", "Floki", "Wojak", "Moon", "Turbo", "Giga",
  "Mega", "Hyper", "Based", "Wagmi", "Lambo", "Degen", "Ape", "Chad", "Frog",
  "Cat", "Inu", "Elon", "Mars", "Sol", "Bit", "Quantum", "Neon", "Cyber",
  "Pixel", "Astro", "Nova", "Volt", "Zen", "Aqua", "Ember", "Lunar", "Solar",
  "Atlas", "Orbit", "Nitro", "Vortex",
];
const SUFFIXES = [
  "Coin", "Token", "Cash", "Finance", "Swap", "DAO", "Net", "Chain", "Verse",
  "X", "Pay", "Protocol", "Labs", "Money", "Yield", "Moon", "Rocket", "AI",
  "Fi", "Dollar",
];

// Avatar circle hues — purely cosmetic, picked deterministically per coin.
const AVATAR_COLORS = [
  "#3323E6", "#22c55e", "#eab308", "#ef4444", "#a855f7", "#06b6d4", "#f97316",
  "#ec4899", "#14b8a6", "#6366f1",
];

// Price magnitudes from sub-cent meme coins up to BTC-sized — gives the column a
// realistic spread of formats.
const MAGNITUDES = [0.0001, 0.01, 1, 25, 100, 1200, 67_500];

type Coin = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  price: number;
  changePct: number;
  up: boolean;
  points: LiveChartPoint[];
  last: number;
};

/** Mulberry32 — tiny deterministic PRNG so the list is identical every launch. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Manual thousands grouping (no Intl dependency — Hermes-safe everywhere). */
function withThousands(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatPrice(p: number): string {
  if (p >= 1000) return `$${withThousands(Math.round(p).toString())}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

/** Build the fixed coin set once. `endTime` frames every sparkline edge-to-edge. */
function buildCoins(count: number, endTime: number): Coin[] {
  const coins: Coin[] = [];
  for (let i = 0; i < count; i++) {
    const rand = mulberry32(i * 7919 + 13);
    const prefix = PREFIXES[Math.floor(rand() * PREFIXES.length)];
    const suffix = SUFFIXES[Math.floor(rand() * SUFFIXES.length)];
    const name = `${prefix} ${suffix}`;
    const symbol = (prefix.slice(0, 3) + suffix.slice(0, 1)).toUpperCase();
    const color = AVATAR_COLORS[Math.floor(rand() * AVATAR_COLORS.length)];
    const price = MAGNITUDES[Math.floor(rand() * MAGNITUDES.length)] *
      (0.3 + rand() * 3);
    const changePct = (rand() * 2 - 1) * 18; // −18% … +18%
    const up = changePct >= 0;

    // Seeded walk biased by the change sign so the sparkline trend matches the
    // 24h number. The walk's absolute scale is irrelevant — the static chart
    // auto-fits to its own min/max (yAxis off).
    const drift = up ? 0.55 : -0.55;
    const points: LiveChartPoint[] = [];
    let v = 100;
    for (let j = 0; j < SPARK_POINTS; j++) {
      v += (rand() - 0.5) * 6 + drift;
      points.push({
        time: endTime - SPARK_SPAN + (j / (SPARK_POINTS - 1)) * SPARK_SPAN,
        value: v,
      });
    }

    coins.push({
      id: String(i),
      name,
      symbol,
      color,
      price,
      changePct,
      up,
      points,
      last: points[points.length - 1].value,
    });
  }
  return coins;
}

// A pinned "now" so each coin's last point sits exactly at the sparkline's right
// edge (the historical-data-fill pattern, same as the Sparklines demo).
const NOW = Date.now() / 1000;

/**
 * One row: `(avatar) Name … Price/24h (sparkline)`. The sparkline is a `static`
 * LiveChart — zero frame loops — so hundreds of these cost almost nothing.
 *
 * LegendList recycles this view as you scroll: the same instance is re-bound to
 * a new `coin`, so the chart's SharedValues are resynced in an effect (you can't
 * write a SharedValue during render) and the static chart re-settles to the new
 * series. No re-mount, no extra Canvas per scroll.
 */
const CoinRow = memo(function CoinRow({ coin }: { coin: Coin }) {
  const dataSV = useSharedValue<LiveChartPoint[]>(coin.points);
  const valueSV = useSharedValue(coin.last);

  useEffect(() => {
    dataSV.set(coin.points);
    valueSV.set(coin.last);
  }, [coin, dataSV, valueSV]);

  const trendColor = coin.up ? UP : DOWN;

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: coin.color }]}>
        <Text style={styles.avatarText}>{coin.symbol.slice(0, 1)}</Text>
      </View>

      <View style={styles.nameCol}>
        <Text style={styles.name} numberOfLines={1}>
          {coin.name}
        </Text>
        <Text style={styles.symbol} numberOfLines={1}>
          {coin.symbol}
        </Text>
      </View>

      <View style={styles.valueCol}>
        <Text style={styles.price} numberOfLines={1}>
          {formatPrice(coin.price)}
        </Text>
        <Text style={[styles.change, { color: trendColor }]} numberOfLines={1}>
          {coin.up ? "+" : ""}
          {coin.changePct.toFixed(2)}%
        </Text>
      </View>

      <View style={styles.spark}>
        <LiveChart
          static
          data={dataSV}
          value={valueSV}
          accentColor={trendColor}
          theme={APP_THEME}
          timeWindow={SPARK_SPAN}
          nowOverride={NOW}
          windowBuffer={0}
          line={{ width: 1.5 }}
          badge={false}
          valueLine={false}
          yAxis={false}
          xAxis={false}
          scrub={false}
          pulse={false}
          dot={{ radius: 2.5, ring: false }}
          leftEdgeFade={false}
          style={styles.sparkChart}
        />
      </View>
    </View>
  );
});

function ListHeader() {
  return (
    <View style={styles.header}>
      <Text style={demoStyles.demoHeading}>Coin list</Text>
      <Text style={demoStyles.demoDesc}>
        {COIN_COUNT} coins, each with a `static` LiveChart sparkline, in a single
        LegendList. Only the on-screen rows are mounted and their views are
        recycled as you scroll — so the whole list stays smooth with no per-row
        animation loop.
      </Text>
      <View style={styles.columnsRow}>
        <Text style={styles.colHint}>Asset</Text>
        <Text style={styles.colHintRight}>Price · 24h · Chart</Text>
      </View>
    </View>
  );
}

const keyExtractor = (coin: Coin) => coin.id;

// Every row is exactly ROW_HEIGHT tall, so hand LegendList the size up front.
// This disables its per-row measure/layout pass — JS-thread work that otherwise
// runs on every recycle — which is the v3 perf guidance for fixed-size rows.
const getFixedItemSize = () => ROW_HEIGHT;

const renderItem = ({ item }: LegendListRenderItemProps<Coin>) => (
  <CoinRow coin={item} />
);

export default function CoinListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const coins = useMemo(() => buildCoins(COIN_COUNT, NOW), []);

  return (
    <View style={[demoStyles.demoRoot, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={demoStyles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to demos"
        >
          <Text style={demoStyles.backChevron}>‹</Text>
          <Text style={demoStyles.backText}>Demos</Text>
        </Pressable>
      </View>

      <LegendList
        data={coins}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={ROW_HEIGHT}
        getFixedItemSize={getFixedItemSize}
        // Render only ~2 rows beyond each edge instead of the default ~250px.
        // Each row is its own Skia <Canvas>, so a tighter draw window keeps far
        // fewer canvases mounted — less to rasterize (UI thread) and reconcile
        // (JS thread) while flinging. Trade: a touch more pop-in at extreme speed.
        drawDistance={ROW_HEIGHT * 2}
        recycleItems
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  columnsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  colHint: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  colHintRight: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
  },
  symbol: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY,
    marginTop: 2,
  },
  valueCol: {
    alignItems: "flex-end",
  },
  price: {
    color: colors.text,
    fontSize: 14,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
  },
  change: {
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
    marginTop: 2,
  },
  spark: {
    width: SPARK_WIDTH,
    height: SPARK_HEIGHT,
  },
  sparkChart: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
