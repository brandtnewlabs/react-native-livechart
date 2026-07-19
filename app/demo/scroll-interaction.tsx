import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LiveChart, LiveChartSeries } from "react-native-livechart";

import {
  APP_FONT_FAMILY,
  APP_FONT_FAMILY_MEDIUM,
  APP_FONT_FAMILY_SEMIBOLD,
} from "../../demo-lib/fonts";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Scroll interaction" };

type ActiveChart = "single" | "series" | "none";

export default function ScrollInteractionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, value, series } = useSimulatedChartData({
    multiSeries: true,
    tradeStream: false,
    historySpanSeconds: 40,
  });

  const [scrollOffset, setScrollOffset] = useState(0);
  const [singleScrubs, setSingleScrubs] = useState(0);
  const [seriesScrubs, setSeriesScrubs] = useState(0);
  const [activeChart, setActiveChart] = useState<ActiveChart>("none");

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollOffset(Math.round(event.nativeEvent.contentOffset.y));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to demos"
        >
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backText}>Demos</Text>
        </Pressable>
        <Text style={styles.heading}>Scroll interaction</Text>
        <Text style={styles.description}>
          Both charts are children of this vertical ScrollView. Start every test
          gesture inside the plot.
        </Text>
      </View>

      <View style={styles.statusPanel}>
        <Text style={styles.statusPrimary}>
          Parent offset: {scrollOffset}px
        </Text>
        <Text
          accessibilityLabel={`single scrubs ${singleScrubs}, series scrubs ${seriesScrubs}, active ${activeChart}`}
          style={styles.statusSecondary}
        >
          Single scrubs: {singleScrubs} · Series scrubs: {seriesScrubs} ·
          Active: {activeChart}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator
      >
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Expected result</Text>
          <Text style={styles.instructionsText}>
            Vertical or mostly vertical: the offset changes and scrub count
            stays still. Horizontal: the offset stays still and that
            chart&apos;s scrub count increases.
          </Text>
        </View>

        <Text style={styles.chartTitle}>LiveChart</Text>
        <Text style={styles.chartHint}>
          Try vertical, diagonal, then horizontal.
        </Text>
        <View
          style={styles.chartCard}
          accessibilityLabel="Single-series scroll test chart"
        >
          <LiveChart
            data={data}
            value={value}
            accentColor={ACCENT}
            theme={APP_THEME}
            timeWindow={30}
            scrub
            onGestureStart={() => {
              setSingleScrubs((count) => count + 1);
              setActiveChart("single");
            }}
            onGestureEnd={() => setActiveChart("none")}
          />
        </View>

        <View style={styles.betweenCharts}>
          <Text style={styles.betweenText}>
            Keep scrolling to repeat the same checks with LiveChartSeries.
          </Text>
        </View>

        <Text style={styles.chartTitle}>LiveChartSeries</Text>
        <Text style={styles.chartHint}>
          Try vertical, diagonal, then horizontal.
        </Text>
        <View
          style={styles.chartCard}
          accessibilityLabel="Multi-series scroll test chart"
        >
          <LiveChartSeries
            series={series}
            accentColor={ACCENT}
            theme={APP_THEME}
            timeWindow={30}
            scrub
            onGestureStart={() => {
              setSeriesScrubs((count) => count + 1);
              setActiveChart("series");
            }}
            onGestureEnd={() => setActiveChart("none")}
          />
        </View>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Done when</Text>
          <Text style={styles.footerText}>
            Both charts let vertical movement scroll this page, while horizontal
            movement scrubs immediately without a hold.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginBottom: 2,
  },
  backChevron: {
    color: colors.link,
    fontSize: 22,
    lineHeight: 22,
    marginRight: 2,
    marginTop: -2,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
  },
  backText: {
    color: colors.link,
    fontSize: 15,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    marginBottom: 4,
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: APP_FONT_FAMILY,
  },
  statusPanel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.chipBackground,
  },
  statusPrimary: {
    color: colors.text,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
  },
  statusSecondary: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
    fontFamily: APP_FONT_FAMILY,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
  },
  instructions: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.chipBackground,
    marginBottom: 24,
  },
  instructionsTitle: {
    color: colors.text,
    fontSize: 14,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    marginBottom: 4,
  },
  instructionsText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: APP_FONT_FAMILY,
  },
  chartTitle: {
    color: colors.text,
    fontSize: 18,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
  },
  chartHint: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY,
    marginTop: 3,
    marginBottom: 10,
  },
  chartCard: {
    height: 260,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  betweenCharts: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  betweenText: {
    color: colors.textFaint,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    fontFamily: APP_FONT_FAMILY,
  },
  footerCard: {
    minHeight: 280,
    marginTop: 28,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.chipBackground,
  },
  footerTitle: {
    color: colors.text,
    fontSize: 14,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    marginBottom: 4,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: APP_FONT_FAMILY,
  },
});
