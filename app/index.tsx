import { Link, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MONO_FONT_FAMILY } from "../src/monoFontFamily";

const DEMOS: { href: Href; title: string; blurb: string }[] = [
  {
    href: "/demo/playground",
    title: "Playground",
    blurb: "All-in-one: line/candle, trades, degen, loading, etc.",
  },
  {
    href: "/demo/line-playback",
    title: "Line & playback",
    blurb: "timeWindow, pause, smoothing, exaggerate.",
  },
  {
    href: "/demo/candlestick",
    title: "Candlestick",
    blurb: "mode=candle, candles, liveCandle, candleWidth.",
  },
  {
    href: "/demo/appearance",
    title: "Appearance",
    blurb: "Theme, accent, gradient, line, font, container style.",
  },
  {
    href: "/demo/axes-insets",
    title: "Axes & insets",
    blurb: "Hide X/Y/both, minGap, insets; LiveChart vs LiveChartSeries.",
  },
  {
    href: "/demo/chart-size",
    title: "Chart size",
    blurb: "Heights, narrow width, flex fill in fixed box.",
  },
  {
    href: "/demo/badge-pulse",
    title: "Badge & pulse",
    blurb: "Badge variants and pulse / PulseConfig.",
  },
  {
    href: "/demo/momentum",
    title: "Momentum",
    blurb:
      "Badge tint vs auto/forced/config; volatility + exaggerate to see changes.",
  },
  {
    href: "/demo/scrub",
    title: "Scrub",
    blurb: "Scrub modes, onScrub readout, candle OHLC payload.",
  },
  {
    href: "/demo/horizontal-lines",
    title: "Reference & value lines",
    blurb: "referenceLine and valueLine styling.",
  },
  {
    href: "/demo/trade-stream",
    title: "Trade stream",
    blurb: "Markers, orderbook vs bonding-curve.",
  },
  {
    href: "/demo/degen",
    title: "Degen",
    blurb: "Particles, shake, DegenOptions presets.",
  },
  {
    href: "/demo/edge-cases",
    title: "Loading, empty, formatters",
    blurb: "loading, empty data, formatValue / formatTime.",
  },
  {
    href: "/demo/multi-series",
    title: "Multi-series",
    blurb: "LiveChartSeries, toggles, scrub, shared core props.",
  },
];

export default function Index() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>LiveChart demos</Text>
      <Text style={styles.subtitle}>
        Open a screen to manually test one feature area.
      </Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {DEMOS.map((d) => (
          <Link key={d.title} href={d.href} asChild>
            <Pressable style={styles.row}>
              <Text style={styles.rowTitle}>{d.title}</Text>
              <Text style={styles.rowBlurb}>{d.blurb}</Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "rgb(10, 10, 10)",
    paddingTop: 56,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    fontFamily: MONO_FONT_FAMILY,
    paddingHorizontal: 20,
  },
  subtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontFamily: MONO_FONT_FAMILY,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 16,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  row: {
    marginTop: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  rowTitle: {
    color: "#60a5fa",
    fontSize: 16,
    fontFamily: MONO_FONT_FAMILY,
    fontWeight: "600",
  },
  rowBlurb: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontFamily: MONO_FONT_FAMILY,
    lineHeight: 17,
    marginTop: 6,
  },
});
