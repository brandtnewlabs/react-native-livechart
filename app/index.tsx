import { Link, type Href } from "expo-router";
import {
  Linking,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  APP_FONT_FAMILY,
  APP_FONT_FAMILY_MEDIUM,
  APP_FONT_FAMILY_SEMIBOLD,
} from "../demo-lib/fonts";
import { colors } from "../demo-lib/theme";

type Demo = { href: Href; title: string; blurb: string };
type DemoSection = { title: string; data: Demo[] };

/**
 * Demos are grouped to mirror the docs taxonomy (core → interaction → effects
 * → annotation → presentation), plus an "Engine & data" group for the
 * playback / state / layout concerns the guides don't yet cover.
 */
const SECTIONS: DemoSection[] = [
  {
    title: "Get started",
    data: [
      {
        href: "/demo/playground",
        title: "Playground",
        blurb: "Kitchen sink — most LiveChart props on one screen.",
      },
    ],
  },
  {
    title: "Core charts",
    data: [
      {
        href: "/demo/line",
        title: "Line & area",
        blurb: "Badge, pulse, value line, live value overlay.",
      },
      {
        href: "/demo/candlestick",
        title: "Candlestick",
        blurb: "mode=candle: timeframes, candle colors, OHLC bodies + wicks.",
      },
      {
        href: "/demo/multi-series",
        title: "Multi-series",
        blurb: "LiveChartSeries: per-series style, legend, dots, scrub.",
      },
      {
        href: "/demo/sparklines",
        title: "Sparklines",
        blurb: "Many static mini-charts in a list (no per-chart animation loop).",
      },
      {
        href: "/demo/coin-list",
        title: "Coin list",
        blurb: "Hundreds of coins in a LegendList — recycled rows, each a static sparkline.",
      },
    ],
  },
  {
    title: "Interaction",
    data: [
      {
        href: "/demo/scrubbing",
        title: "Scrubbing",
        blurb: "Scrub modes, styled tooltip, onScrub readout, candle OHLC.",
      },
      {
        href: "/demo/scrub-action",
        title: "Order ticket",
        blurb: "scrubAction: tap to drop a price, drag to adjust, press + to place a limit order.",
      },
    ],
  },
  {
    title: "Effects",
    data: [
      {
        href: "/demo/momentum-degen",
        title: "Momentum & degen",
        blurb: "Momentum badge tint + particle / shake presets.",
      },
    ],
  },
  {
    title: "Annotations",
    data: [
      {
        href: "/demo/markers",
        title: "Markers & trades",
        blurb: "markers[] glyphs, tap hover, tradeStream overlay.",
      },
      {
        href: "/demo/reference-lines",
        title: "Reference lines & bands",
        blurb: "referenceLines: lines, value/time bands, off-axis badge.",
      },
      {
        href: "/demo/threshold",
        title: "Threshold split",
        blurb: "threshold: green above / red below a live break-even — split stroke, P/L fill band, marker line.",
      },
      {
        href: "/demo/segments",
        title: "Segments",
        blurb: "segments: after-hours / overnight sessions — scrub-focus line recolor, divider + label.",
      },
    ],
  },
  {
    title: "Appearance",
    data: [
      {
        href: "/demo/theming",
        title: "Theming",
        blurb: "Theme, accent, gradient, line, font, grid, palette.",
      },
      {
        href: "/demo/axes-grid",
        title: "Axes & grid",
        blurb: "Hide X/Y, minGap, insets; LiveChart vs LiveChartSeries.",
      },
    ],
  },
  {
    title: "Engine & data",
    data: [
      {
        href: "/demo/playback",
        title: "Playback",
        blurb: "timeWindow, paused, smoothing, exaggerate, range clamps.",
      },
      {
        href: "/demo/states",
        title: "States & formatting",
        blurb: "Loading, empty data, formatValue / formatTime.",
      },
      {
        href: "/demo/historical-data",
        title: "Historical data fill",
        blurb: "nowOverride + windowBuffer: fill a fixed span edge-to-edge.",
      },
      {
        href: "/demo/transitions",
        title: "Transitions",
        blurb: "mode morph + LiveChartTransition cross-fade.",
      },
    ],
  },
];

const renderDemoItem = ({ item: d }: { item: Demo }) => (
  <Link href={d.href} asChild>
    <Pressable style={styles.row}>
      <Text style={styles.rowTitle}>{d.title}</Text>
      <Text style={styles.rowBlurb}>{d.blurb}</Text>
    </Pressable>
  </Link>
);

const renderSectionHeader = ({
  section,
}: {
  section: DemoSection;
}) => <Text style={styles.sectionHeader}>{section.title}</Text>;

/** brandtnew labs — Lennart Brandt (Product Designer & React Native dev). */
const SITE_URL = "https://www.brandtnewlabs.com";
const X_URL = "https://x.com/brandtnewlabs";

const Footer = () => (
  <View style={styles.footer}>
    <Text style={styles.footerMade}>Made by Lennart Brandt</Text>
    <Text style={styles.footerLinks}>
      <Text style={styles.footerLink} onPress={() => Linking.openURL(X_URL)}>
        @brandtnewlabs
      </Text>
      <Text style={styles.footerDot}>{"  ·  "}</Text>
      <Text style={styles.footerLink} onPress={() => Linking.openURL(SITE_URL)}>
        brandtnewlabs.com
      </Text>
    </Text>
  </View>
);

export default function Index() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>LiveChart demos</Text>
      <Text style={styles.subtitle}>
        Grouped to match the docs. Open a screen to test one feature area.
      </Text>
      <SectionList
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        sections={SECTIONS}
        keyExtractor={(d) => d.title}
        renderItem={renderDemoItem}
        renderSectionHeader={renderSectionHeader}
        ListFooterComponent={Footer}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    paddingHorizontal: 20,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: APP_FONT_FAMILY,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 8,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionHeader: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 2,
  },
  row: {
    marginTop: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: {
    color: colors.link,
    fontSize: 16,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
  },
  rowBlurb: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY,
    lineHeight: 17,
    marginTop: 6,
  },
  footer: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerMade: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY,
  },
  footerLinks: {
    marginTop: 5,
    fontSize: 12,
  },
  footerLink: {
    color: colors.link,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
  },
  footerDot: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY,
  },
});
