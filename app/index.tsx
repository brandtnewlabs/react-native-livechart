import { Link, type Href } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { MONO_FONT_FAMILY } from "react-native-livechart";

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
    blurb: "Badge variants, pulse, showValue overlay + momentum color.",
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
    blurb: "Scrub modes, styled tooltip, onScrub readout, candle OHLC.",
  },
  {
    href: "/demo/horizontal-lines",
    title: "Reference lines & bands",
    blurb: "referenceLines array: lines, value/time bands, off-axis badge.",
  },
  {
    href: "/demo/trade-stream",
    title: "Trade stream",
    blurb: "Markers, orderbook vs bonding-curve.",
  },
  {
    href: "/demo/markers",
    title: "Markers",
    blurb: "markers[]: trade/boost/graduation/winner/clawback + tap hover.",
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
    blurb: "Per-series style, degen, legend styling, toggles, scrub.",
  },
  {
    href: "/demo/historical-data",
    title: "Historical data fill",
    blurb: "nowOverride + windowBuffer: fill a fixed span edge-to-edge.",
  },
  {
    href: "/demo/transitions",
    title: "Transitions",
    blurb: "LiveChartTransition cross-fade between line and candle.",
  },
];

const renderDemoItem = ({ item: d }: { item: (typeof DEMOS)[number] }) => (
  <Link href={d.href} asChild>
    <Pressable style={styles.row}>
      <Text style={styles.rowTitle}>{d.title}</Text>
      <Text style={styles.rowBlurb}>{d.blurb}</Text>
    </Pressable>
  </Link>
);

export default function Index() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>LiveChart demos</Text>
      <Text style={styles.subtitle}>
        Open a screen to manually test one feature area.
      </Text>
      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        data={DEMOS}
        keyExtractor={(d) => d.title}
        renderItem={renderDemoItem}
      />
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
