import { useState } from "react";
import { StyleSheet, Text, type LayoutChangeEvent } from "react-native";
import {
  LiveChart,
  usePriceY,
  type ChartOverlayContext,
} from "react-native-livechart";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Overlay bridge" };

const WINDOW_SECS = 60;

type Level = { price: number; label: string; color: string };

// Fixed price levels (the sim starts at 100). They hold their PRICE while the
// line wiggles and the axis breathes — exactly what the bridge demonstrates;
// a level that drifts off-range pins to the nearest plot edge.
const LEVELS: Level[] = [
  { price: 102, label: "Take profit", color: "#16a34a" },
  { price: 99.5, label: "Avg entry", color: ACCENT },
  { price: 97, label: "Liquidation", color: "#dc2626" },
];

/**
 * `renderOverlay` demo — the price↔pixel bridge. The chart hands us worklet
 * `priceToY` + a live `plot` rect; we hand-roll an order overlay (a full-width
 * level line + a right-edge price tag) entirely in React Native, and it stays
 * glued to its price as the Y-axis auto-rescales and while scrubbing — without
 * re-deriving the scale or re-rendering. This is the building block for
 * avg-entry / liquidation / working-order overlays.
 */
export default function OverlayBridgeScreen() {
  const [showLines, setShowLines] = useState(true);

  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    tradeStream: false,
    historySpanSeconds: WINDOW_SECS,
    historyRange: "1m",
    volatilityMode: "volatile",
  });

  return (
    <DemoScreen
      title="Overlay bridge"
      description="renderOverlay hands you worklet priceToY / yToPrice / timeToX + a live plot rect. Here a hand-rolled RN order overlay (level line + price tag) tracks each price as the axis rescales — drag the chart to scrub and watch the tags stay put."
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={WINDOW_SECS}
          // Right gutter widened a touch so the price tags clear the y-axis labels.
          insets={{ right: 96 }}
          renderOverlay={(ctx) => (
            <>
              {LEVELS.map((lvl) => (
                <OrderLevel
                  key={lvl.label}
                  ctx={ctx}
                  level={lvl}
                  showLine={showLines}
                />
              ))}
            </>
          )}
        />
      }
    >
      <ControlRow label="Overlay">
        <ToggleChip
          label="Level lines"
          value={showLines}
          onChange={setShowLines}
        />
      </ControlRow>
    </DemoScreen>
  );
}

/**
 * One order level rendered entirely in RN from the bridge: a full-width line
 * (when enabled) and a right-edge price tag. `usePriceY` gives the price's live Y
 * as a SharedValue (the recommended path — reactivity is handled for us); `scale`
 * supplies the plot rect for the line's x-extent + clamping.
 */
function OrderLevel({
  ctx,
  level,
  showLine,
}: {
  ctx: ChartOverlayContext;
  level: Level;
  showLine: boolean;
}) {
  const { scale } = ctx;
  const { price, label, color } = level;

  // Reactive Y for this price — tracks the rescaling axis on the UI thread.
  const y = usePriceY(ctx, price);

  // Measured tag size, so it can be pinned by its right edge at the axis.
  const tagSize = useSharedValue({ width: 0, height: 0 });
  const onTagLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    tagSize.set({ width, height });
  };

  const lineStyle = useAnimatedStyle(() => {
    const py = y.get();
    const s = scale.get();
    const clampedY = Math.max(s.plot.top, Math.min(s.plot.bottom, py));
    return {
      opacity: py < 0 || !showLine ? 0 : 1,
      width: Math.max(0, s.plot.right - s.plot.left),
      transform: [{ translateX: s.plot.left }, { translateY: clampedY }],
    };
  });

  const tagStyle = useAnimatedStyle(() => {
    const py = y.get();
    const s = scale.get();
    const clampedY = Math.max(s.plot.top, Math.min(s.plot.bottom, py));
    const ts = tagSize.get();
    return {
      opacity: py < 0 ? 0 : 1,
      transform: [
        { translateX: s.plot.right - ts.width },
        { translateY: clampedY - ts.height / 2 },
      ],
    };
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.line, { backgroundColor: color }, lineStyle]}
      />
      <Animated.View
        pointerEvents="none"
        onLayout={onTagLayout}
        style={[styles.tag, { borderColor: color }, tagStyle]}
      >
        <Text style={[styles.tagText, { color }]}>
          {label} {price.toFixed(2)}
        </Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  line: {
    position: "absolute",
    top: 0,
    left: 0,
    height: StyleSheet.hairlineWidth,
    opacity: 0.7,
  },
  tag: {
    position: "absolute",
    top: 0,
    left: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.background,
  },
  tagText: { fontSize: 11, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
