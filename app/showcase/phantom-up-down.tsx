import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans";
import { useFont, type SkFont } from "@shopify/react-native-skia";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  LiveChart,
  usePriceY,
  type ChartOverlayContext,
} from "react-native-livechart";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  APP_FONT_FAMILY,
  APP_FONT_FAMILY_MEDIUM,
  APP_FONT_FAMILY_SEMIBOLD,
} from "../../demo-lib/fonts";
import {
  formatPhantomCountdown,
  nextPhantomClockDelay,
  phantomCountdownAccessibilityLabel,
  phantomRoundSecondsRemaining,
  resolvePhantomTargetPlacement,
  resolvePhantomRound,
  type PhantomRound,
} from "../../sim/phantomRound";
import {
  PHANTOM_TIMEFRAMES,
  PHANTOM_TIMEFRAME_SECONDS,
  formatPhantomMarketOutcome,
  phantomPriceAt,
  usePhantomMarketSimulation,
  type PhantomTimeframe,
} from "../../sim/usePhantomMarketSimulation";

const C = {
  background: "#000000",
  surface: "#171717",
  surfaceStrong: "#222222",
  text: "#F5F5F5",
  muted: "#A3A3A3",
  faint: "#747474",
  green: "#4EF95D",
  red: "#FF5C5C",
  reference: "#8A8A8A",
  referencePill: "#EDEDED",
  referencePillText: "#242424",
  purple: "#9B7BFF",
} as const;

const REFERENCE_PILL_BOX_SHADOW = "0 0 8px rgba(237, 237, 237, 0.2)";

const PRICE_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const PHANTOM_CHART_FONT = {
  fontFamily: APP_FONT_FAMILY_MEDIUM,
  fontSize: 11,
  fontWeight: "500",
  typeface: PlusJakartaSans_500Medium,
} as const;

const PHANTOM_CHART_PALETTE = {
  bgRgb: [0, 0, 0] as [number, number, number],
  gridLabel: C.muted,
};

// The 60pt target pill extends about 13pt beyond the formatted axis text.
// Keep the axis column 29pt from the edge, then pull the pill 8pt left. Matching
// gridEndGap keeps the reference line terminating at the pill's new left edge.
const Y_AXIS_LABEL_RIGHT_MARGIN = 29;
const Y_AXIS_LABEL_COUNT = 5;
const REFERENCE_PILL_LEFT_OFFSET = 8;
const REFERENCE_LINE_DASH_LENGTH = 4;
const REFERENCE_LINE_DASH_GAP = 4;
const REFERENCE_LINE_DASH_INTERVAL =
  REFERENCE_LINE_DASH_LENGTH + REFERENCE_LINE_DASH_GAP;
const REFERENCE_LINE_DASH_OFFSETS = Array.from(
  { length: 64 },
  (_, index) => index * REFERENCE_LINE_DASH_INTERVAL,
);
const TARGET_CARET_BOB_AMPLITUDE = 1.5;
const TARGET_CARET_BOB_HALF_PERIOD_MS = 700;
const TARGET_CARET_EASING = Easing.inOut(Easing.sin);

const TIMEFRAME_LABELS: Readonly<Record<PhantomTimeframe, string>> = {
  live: "LIVE",
  "15m": "15M",
  "1h": "1H",
  "1d": "1D",
  "1w": "1W",
};

const TIMEFRAME_ACCESSIBILITY: Readonly<Record<PhantomTimeframe, string>> = {
  live: "live 30-second",
  "15m": "15-minute",
  "1h": "1-hour",
  "1d": "1-day",
  "1w": "1-week",
};

function formatChartPrice(value: number): string {
  "worklet";
  return `$${value.toFixed(3)}`;
}

function RoundTargetOverlay({
  context,
  price,
  label,
  axisFont,
}: {
  context: ChartOverlayContext;
  price: number;
  label: string;
  axisFont: SkFont;
}): ReactElement {
  const y = usePriceY(context, price);
  const reduceMotion = useReducedMotion();
  const caretOffset = useSharedValue(0);
  const layout = useDerivedValue(() => {
    const priceY = y.get();
    const scale = context.scale.get();
    const pillHalfHeight = 12;
    const targetPlacement = resolvePhantomTargetPlacement(
      price,
      scale.min,
      scale.max,
      priceY,
      scale.plot.top,
      scale.plot.bottom,
    );
    const pillCenterY = targetPlacement.connectorY;
    const tickStep = (scale.max - scale.min) / (Y_AXIS_LABEL_COUNT - 1);
    const tickStepY =
      (scale.plot.bottom - scale.plot.top) / (Y_AXIS_LABEL_COUNT - 1);
    let widestTickWidth = 0;
    let closestTickWidth = 0;
    let closestTickY = scale.plot.top;
    let closestTickDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < Y_AXIS_LABEL_COUNT; index += 1) {
      const tickLabel = formatChartPrice(scale.max - tickStep * index);
      const tickWidth = axisFont.measureText(tickLabel).width;
      widestTickWidth = Math.max(widestTickWidth, tickWidth);
      const tickY = scale.plot.top + tickStepY * index;
      const distance = Math.abs(tickY - pillCenterY);
      if (distance < closestTickDistance) {
        closestTickDistance = distance;
        closestTickWidth = tickWidth;
        closestTickY = tickY;
      }
    }
    const fontMetrics = axisFont.getMetrics();
    const tickHeight = fontMetrics.descent - fontMetrics.ascent;
    const axisX =
      scale.plot.width - Y_AXIS_LABEL_RIGHT_MARGIN - widestTickWidth;
    const pillX = axisX - REFERENCE_PILL_LEFT_OFFSET;

    return {
      opacity:
        scale.plot.width > 0 &&
        scale.plot.bottom > scale.plot.top &&
        Number.isFinite(scale.min) &&
        Number.isFinite(scale.max) &&
        scale.max > scale.min
          ? 1
          : 0,
      edge: targetPlacement.edge,
      axisX,
      pillX,
      pillY: targetPlacement.pillY,
      lineX: scale.plot.left,
      lineY: pillCenterY,
      lineWidth: Math.max(0, pillX - scale.plot.left),
      tickMaskOpacity:
        closestTickDistance < pillHalfHeight + tickHeight / 2 ? 1 : 0,
      tickMaskY: closestTickY - tickHeight / 2 - 1,
      tickMaskWidth: closestTickWidth,
      tickMaskHeight: tickHeight + 2,
    };
  });
  useEffect(() => {
    if (reduceMotion) {
      caretOffset.set(0);
      return;
    }
    caretOffset.set(
      withRepeat(
        withTiming(-TARGET_CARET_BOB_AMPLITUDE, {
          duration: TARGET_CARET_BOB_HALF_PERIOD_MS,
          easing: TARGET_CARET_EASING,
        }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(caretOffset);
  }, [caretOffset, reduceMotion]);

  const tickMaskStyle = useAnimatedStyle(() => {
    const next = layout.get();
    return {
      opacity: next.opacity * next.tickMaskOpacity,
      width: next.tickMaskWidth,
      height: next.tickMaskHeight,
      transform: [{ translateX: next.axisX }, { translateY: next.tickMaskY }],
    };
  });
  const targetLineStyle = useAnimatedStyle(() => {
    const next = layout.get();
    return {
      opacity: next.opacity,
      width: next.lineWidth,
      transform: [{ translateX: next.lineX }, { translateY: next.lineY }],
    };
  });
  const pillStyle = useAnimatedStyle(() => {
    const next = layout.get();
    return {
      opacity: next.opacity,
      transform: [{ translateX: next.pillX }, { translateY: next.pillY }],
    };
  });
  const aboveIndicatorStyle = useAnimatedStyle(() => ({
    opacity: layout.get().edge === "above" ? 1 : 0,
    transform: [{ translateY: caretOffset.get() }],
  }));
  const belowIndicatorStyle = useAnimatedStyle(() => ({
    opacity: layout.get().edge === "below" ? 1 : 0,
    transform: [{ translateY: -caretOffset.get() }],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.axisTickCollisionMask, tickMaskStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.targetReferenceLine, targetLineStyle]}
        testID="round-target-line"
      >
        {REFERENCE_LINE_DASH_OFFSETS.map((left) => (
          <View key={left} style={[styles.targetReferenceDash, { left }]} />
        ))}
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.targetPill, pillStyle]}
        testID="round-target-pill"
      >
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.targetEdgeIndicator,
            styles.targetEdgeIndicatorAbove,
            aboveIndicatorStyle,
          ]}
        >
          <View style={[styles.targetEdgeCaret, styles.targetEdgeCaretAbove]} />
        </Animated.View>
        <Text numberOfLines={1} style={styles.targetPillText}>
          {label}
        </Text>
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.targetEdgeIndicator,
            styles.targetEdgeIndicatorBelow,
            belowIndicatorStyle,
          ]}
        >
          <View style={[styles.targetEdgeCaret, styles.targetEdgeCaretBelow]} />
        </Animated.View>
      </Animated.View>
    </>
  );
}

function SolanaMark(): ReactElement {
  return (
    <View style={styles.solanaMark}>
      <View style={[styles.solanaBar, styles.solanaBarTop]} />
      <View style={[styles.solanaBar, styles.solanaBarMiddle]} />
      <View style={[styles.solanaBar, styles.solanaBarBottom]} />
    </View>
  );
}

function RoundCountdown({
  initialRound,
  onRoundChange,
}: {
  initialRound: PhantomRound;
  onRoundChange: (round: PhantomRound) => void;
}): ReactElement {
  const roundId = useRef(initialRound.id);
  const [seconds, setSeconds] = useState(() =>
    phantomRoundSecondsRemaining(Date.now(), initialRound.endMs),
  );

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const reconcile = () => {
      const nowMs = Date.now();
      const currentRound = resolvePhantomRound(nowMs);
      if (currentRound.id !== roundId.current) {
        roundId.current = currentRound.id;
        onRoundChange(currentRound);
      }
      setSeconds(phantomRoundSecondsRemaining(nowMs, currentRound.endMs));
    };

    const schedule = () => {
      reconcile();
      if (!active) return;
      timer = setTimeout(schedule, nextPhantomClockDelay(Date.now()));
    };

    schedule();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reconcile();
    });

    return () => {
      active = false;
      if (timer !== null) clearTimeout(timer);
      subscription.remove();
    };
  }, [onRoundChange]);

  return (
    <View
      accessibilityLabel={phantomCountdownAccessibilityLabel(seconds)}
      accessibilityRole="timer"
      style={styles.timerPill}
      testID="round-countdown"
    >
      <Ionicons name="hourglass-outline" color={C.text} size={13} />
      <Text style={styles.timerText}>{formatPhantomCountdown(seconds)}</Text>
    </View>
  );
}

function MarketReadout({
  value,
  target,
  initialValue,
  initialTarget,
}: {
  value: SharedValue<number>;
  target: SharedValue<number>;
  initialValue: number;
  initialTarget: number;
}): ReactElement {
  const [snapshot, setSnapshot] = useState({
    value: initialValue,
    target: initialTarget,
  });
  const lastPublishMs = useSharedValue(0);

  useAnimatedReaction(
    () => ({ value: value.get(), target: target.get() }),
    (next, previous) => {
      const nowMs = Date.now();
      const targetChanged = previous == null || next.target !== previous.target;
      if (!targetChanged && nowMs - lastPublishMs.get() < 200) return;
      lastPublishMs.set(nowMs);
      runOnJS(setSnapshot)(next);
    },
  );

  const outcome = formatPhantomMarketOutcome(snapshot.value, snapshot.target);
  const outcomeColor =
    outcome.side === "at" ? C.muted : outcome.side === "up" ? C.green : C.red;

  return (
    <View>
      <Text style={styles.price} testID="market-price">
        {PRICE_FORMAT.format(snapshot.value)}
      </Text>
      <Text
        style={[styles.outcome, { color: outcomeColor }]}
        testID="market-outcome"
      >
        {outcome.text}
      </Text>
    </View>
  );
}

function DirectionChip(): ReactElement {
  return (
    <View accessibilityElementsHidden style={styles.directionChip}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.directionTriangle} />
      ))}
    </View>
  );
}

function TimeframeControl({
  timeframe,
  selected,
  loading,
  onPress,
}: {
  timeframe: PhantomTimeframe;
  selected: boolean;
  loading: boolean;
  onPress: (timeframe: PhantomTimeframe) => void;
}): ReactElement {
  const label = TIMEFRAME_LABELS[timeframe];
  const accessibleRange = TIMEFRAME_ACCESSIBILITY[timeframe];
  return (
    <Pressable
      accessibilityLabel={`Show ${accessibleRange} chart`}
      accessibilityRole="button"
      accessibilityState={{ selected, busy: selected && loading }}
      hitSlop={{ top: 10, bottom: 10 }}
      onPress={() => onPress(timeframe)}
      style={[styles.timeframeSlot, selected && styles.timeframeSlotActive]}
      testID={`timeframe-${timeframe}`}
    >
      {timeframe === "live" ? (
        <View style={styles.timeframeLiveContent}>
          <View
            style={[
              styles.timeframeLiveDot,
              selected && styles.timeframeLiveDotActive,
            ]}
          />
          <Text
            style={[
              styles.timeframeText,
              selected && styles.timeframeTextActive,
            ]}
          >
            {label}
          </Text>
        </View>
      ) : (
        <Text
          style={[styles.timeframeText, selected && styles.timeframeTextActive]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export default function PhantomUpDownShowcase(): ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [favorite, setFavorite] = useState(false);
  const [initialRound] = useState(() => resolvePhantomRound(Date.now()));
  const [initialPrice] = useState(() => phantomPriceAt(Date.now() / 1000));
  const initialTarget = phantomPriceAt(initialRound.startMs / 1000);
  const [roundTargetNumber, setRoundTargetNumber] = useState(initialTarget);
  const roundStartPrice = useSharedValue(initialTarget);
  const [outcomeSide, setOutcomeSide] = useState<"up" | "down">(
    initialPrice >= initialTarget ? "up" : "down",
  );

  const {
    displayData,
    value,
    seriesOpacity,
    selectedTimeframe,
    committedTimeframe,
    dataSnapVersion,
    isLoadingTimeframe,
    selectTimeframe,
  } = usePhantomMarketSimulation();

  const handleRoundChange = (nextRound: PhantomRound) => {
    const nextTarget = phantomPriceAt(nextRound.startMs / 1000);
    roundStartPrice.set(nextTarget);
    setRoundTargetNumber(nextTarget);
  };

  useAnimatedReaction(
    () => value.get() >= roundStartPrice.get(),
    (isUp, wasUp) => {
      if (wasUp != null && isUp === wasUp) return;
      runOnJS(setOutcomeSide)(isUp ? "up" : "down");
    },
  );

  const outcomeColor = outcomeSide === "up" ? C.green : C.red;
  const roundTargetLabel = PRICE_FORMAT.format(roundTargetNumber);
  const targetLabelFont = useFont(
    PlusJakartaSans_500Medium,
    PHANTOM_CHART_FONT.fontSize,
  );
  const renderTargetOverlay = (context: ChartOverlayContext) =>
    targetLabelFont ? (
      <RoundTargetOverlay
        axisFont={targetLabelFont}
        context={context}
        label={roundTargetLabel}
        price={roundTargetNumber}
      />
    ) : null;

  const handleShare = () => {
    void Share.share({
      message: "SOL 5-minute Up/Down market",
    });
  };

  return (
    <View style={styles.root} testID="phantom-up-down-screen">
      <StatusBar style="light" />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        style={{ paddingTop: insets.top }}
      >
        <View style={styles.grabber} />

        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to Examples"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => router.back()}
            style={styles.logoButton}
            testID="phantom-back"
          >
            <SolanaMark />
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel={
                favorite
                  ? "Remove market from favorites"
                  : "Add market to favorites"
              }
              accessibilityRole="button"
              accessibilityState={{ selected: favorite }}
              onPress={() => setFavorite((current) => !current)}
              style={styles.headerAction}
              testID="phantom-favorite"
            >
              <Ionicons
                color={C.text}
                name={favorite ? "heart" : "heart-outline"}
                size={21}
              />
            </Pressable>
            <Pressable
              accessibilityLabel="Share market"
              accessibilityRole="button"
              onPress={handleShare}
              style={styles.headerAction}
              testID="phantom-share"
            >
              <Ionicons color={C.text} name="share-outline" size={21} />
            </Pressable>
          </View>
        </View>

        <View style={styles.marketHeader}>
          <Text style={styles.eyebrow}>Up or Down</Text>
          <View style={styles.marketTitleRow}>
            <Text style={styles.marketTitle}>SOL 5min</Text>
            <Ionicons color={C.muted} name="chevron-down" size={17} />
          </View>
          <MarketReadout
            initialTarget={initialTarget}
            initialValue={initialPrice}
            target={roundStartPrice}
            value={value}
          />
          <RoundCountdown
            initialRound={initialRound}
            onRoundChange={handleRoundChange}
          />
        </View>

        <View style={styles.chartWrap} testID="phantom-chart">
          <LiveChart
            accessibilityLabel={`SOL price chart, ${TIMEFRAME_LABELS[committedTimeframe]}`}
            accentColor={outcomeColor}
            badge={false}
            canvasMode="opaque"
            data={displayData}
            degen={false}
            dot={{
              radius: 4,
              color: outcomeColor,
              ring: { color: C.background, width: 2 },
              glow: { radius: 9, blur: 5, opacity: 0.28 },
            }}
            font={PHANTOM_CHART_FONT}
            formatValue={formatChartPrice}
            gradient={false}
            gridStyle={{ color: "transparent", opacity: 0 }}
            insets={{
              left: 4,
              top: 18,
              bottom: 18,
            }}
            leftEdgeFade={false}
            line={{
              color: outcomeColor,
              width: 2.5,
              curve: "linear",
              join: "round",
              cap: "round",
            }}
            momentum={false}
            palette={PHANTOM_CHART_PALETTE}
            pulse={false}
            renderOverlay={renderTargetOverlay}
            scrub={false}
            seriesOpacity={seriesOpacity}
            snapKey={dataSnapVersion}
            style={styles.chartCanvas}
            theme="dark"
            timeWindow={PHANTOM_TIMEFRAME_SECONDS[committedTimeframe]}
            transitions={{ reveal: 0 }}
            value={value}
            valueLine={false}
            xAxis={false}
            yAxis={{
              count: Y_AXIS_LABEL_COUNT,
              gridEndGap: REFERENCE_PILL_LEFT_OFFSET,
              labelRightMargin: Y_AXIS_LABEL_RIGHT_MARGIN,
            }}
          />
        </View>

        <View style={styles.controlsViewport}>
          <View style={styles.controlsInner}>
            <DirectionChip />
            <View style={styles.timeframeGroup}>
              {PHANTOM_TIMEFRAMES.map((timeframe) => (
                <TimeframeControl
                  key={timeframe}
                  loading={isLoadingTimeframe}
                  onPress={selectTimeframe}
                  selected={selectedTimeframe === timeframe}
                  timeframe={timeframe}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.lowerContent}>
          <Pressable
            accessibilityRole="button"
            style={styles.sectionHeadingRow}
          >
            <Text style={styles.sectionHeading}>Live Chat</Text>
            <Ionicons color={C.muted} name="chevron-forward" size={17} />
          </Pressable>
          <View style={styles.chatPrompt}>
            <Ionicons
              color={C.faint}
              name="chatbubble-ellipses-outline"
              size={15}
            />
            <Text style={styles.chatPromptText}>React to this round</Text>
          </View>

          <Pressable accessibilityRole="button" style={styles.aboutHeadingRow}>
            <Text style={styles.sectionHeading}>About this market</Text>
            <Ionicons color={C.muted} name="chevron-forward" size={17} />
          </Pressable>
          <Text style={styles.aboutCopy}>
            Predict whether SOL will finish above or below the round&apos;s
            starting price. Each round lasts five minutes.
          </Text>
          <View style={styles.regionCard}>
            <View style={styles.regionIcon}>
              <Ionicons color={C.purple} name="location-outline" size={17} />
            </View>
            <View style={styles.regionText}>
              <Text style={styles.regionTitle}>Market availability</Text>
              <Text style={styles.regionCopy}>
                Trading availability may vary by region.
              </Text>
            </View>
          </View>
        </View>
        <View style={{ height: insets.bottom + 18 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  grabber: {
    alignSelf: "center",
    width: 35,
    height: 5,
    borderRadius: 3,
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.38)",
  },
  header: {
    height: 40,
    marginTop: 10,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  solanaMark: { width: 27, height: 26, justifyContent: "center", gap: 3 },
  solanaBar: {
    width: 24,
    height: 5,
    borderRadius: 2,
    transform: [{ skewX: "-20deg" }],
  },
  solanaBarTop: { alignSelf: "flex-start", backgroundColor: "#55F3AE" },
  solanaBarMiddle: { alignSelf: "flex-end", backgroundColor: "#5DA8FF" },
  solanaBarBottom: { alignSelf: "flex-start", backgroundColor: "#9B67FF" },
  headerActions: { flexDirection: "row", gap: 8 },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface,
  },
  marketHeader: { paddingHorizontal: 20, marginTop: 14 },
  eyebrow: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
  },
  marketTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 5,
  },
  marketTitle: {
    color: C.text,
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.4,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
  },
  price: {
    color: C.text,
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -0.7,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    fontVariant: ["tabular-nums"],
  },
  outcome: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
    fontVariant: ["tabular-nums"],
  },
  timerPill: {
    width: 73,
    height: 24,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 12,
    backgroundColor: C.surface,
  },
  timerText: {
    color: C.text,
    fontSize: 13,
    lineHeight: 17,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
    fontVariant: ["tabular-nums"],
  },
  chartWrap: { height: 280, marginTop: 8 },
  chartCanvas: { backgroundColor: C.background },
  axisTickCollisionMask: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: C.background,
  },
  targetReferenceLine: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 1,
    overflow: "hidden",
  },
  targetReferenceDash: {
    position: "absolute",
    top: 0,
    width: REFERENCE_LINE_DASH_LENGTH,
    height: 1,
    backgroundColor: C.reference,
  },
  targetPill: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 60,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.referencePill,
    boxShadow: REFERENCE_PILL_BOX_SHADOW,
  },
  targetPillText: {
    color: C.referencePillText,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
    fontVariant: ["tabular-nums"],
  },
  targetEdgeIndicator: {
    position: "absolute",
    left: 26,
    width: 8,
    height: 5,
    alignItems: "center",
  },
  // The 5pt caret rests 1pt inside the pill edge, avoiding a black seam before
  // the subtle outward bob begins.
  targetEdgeIndicatorAbove: { top: -4 },
  targetEdgeIndicatorBelow: { bottom: -4 },
  targetEdgeCaret: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  targetEdgeCaretAbove: {
    borderBottomWidth: 5,
    borderBottomColor: C.referencePill,
  },
  targetEdgeCaretBelow: {
    borderTopWidth: 5,
    borderTopColor: C.referencePill,
  },
  controlsViewport: {
    width: "100%",
    height: 44,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  controlsInner: {
    width: 402,
    flexDirection: "row",
    alignItems: "center",
  },
  directionChip: {
    width: 69,
    height: 24,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: C.surface,
  },
  directionTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: C.green,
  },
  timeframeGroup: { marginLeft: 12, flexDirection: "row", gap: 4 },
  timeframeSlot: {
    width: 61,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  timeframeSlotActive: { backgroundColor: C.text },
  timeframeText: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
  },
  timeframeLiveContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  timeframeLiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.muted,
  },
  timeframeLiveDotActive: { backgroundColor: C.referencePillText },
  timeframeTextActive: { color: C.referencePillText },
  lowerContent: { paddingHorizontal: 20, paddingTop: 2 },
  sectionHeadingRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionHeading: {
    color: C.text,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
  },
  chatPrompt: {
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: C.surface,
  },
  chatPromptText: {
    color: C.muted,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY,
  },
  aboutHeadingRow: {
    minHeight: 42,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  aboutCopy: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: APP_FONT_FAMILY,
  },
  regionCard: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.surface,
  },
  regionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(155,123,255,0.14)",
  },
  regionText: { flex: 1 },
  regionTitle: {
    color: C.text,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
  },
  regionCopy: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 14,
    fontFamily: APP_FONT_FAMILY,
  },
});
