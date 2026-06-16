import { StyleSheet, Text, TextInput, View } from "react-native";

import {
  LiveChart,
  type CandlePoint,
  type TooltipRenderProps,
} from "react-native-livechart";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";
import { APP_THEME, colors } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Candle scrub" };

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Field = "open" | "high" | "low" | "close";

const OHLC: { label: string; field: Field }[] = [
  { label: "Open", field: "open" },
  { label: "High", field: "high" },
  { label: "Low", field: "low" },
  { label: "Close", field: "close" },
];

/**
 * One header cell. Shows the *scrubbed* candle's value while scrubbing, else the
 * *live* candle's — both on the UI thread (the scrubbed string is pushed from
 * `onScrub`, and the live value is read straight off the `liveCandle` SharedValue).
 */
function OhlcCell({
  label,
  field,
  scrubbing,
  scrubbed,
  liveCandle,
}: {
  label: string;
  field: Field;
  scrubbing: SharedValue<boolean>;
  scrubbed: SharedValue<string>;
  liveCandle: SharedValue<CandlePoint | null>;
}) {
  const animatedProps = useAnimatedProps(() => {
    let text = "—";
    if (scrubbing.get()) {
      text = scrubbed.get();
    } else {
      const c = liveCandle.get();
      if (c) text = c[field].toFixed(2);
    }
    return { text, defaultValue: text };
  });
  return (
    <View style={styles.cell}>
      <AnimatedTextInput
        editable={false}
        underlineColorAndroid="transparent"
        style={styles.cellValue}
        animatedProps={animatedProps}
      />
      <Text style={styles.cellLabel}>{label}</Text>
    </View>
  );
}

/**
 * The custom candle tooltip: just the scrubbed time, pinned to the top edge of
 * the plot (`scrub.tooltipPlacement: "top"`). It reads `ctx.timeStr` (formatted
 * UI-side), so the OHLC can live in the header above the chart instead.
 */
function TimeTooltip({ timeStr }: TooltipRenderProps) {
  const animatedProps = useAnimatedProps(() => {
    const t = timeStr.get();
    return { text: t, defaultValue: t };
  });
  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      style={styles.timeText}
      animatedProps={animatedProps}
    />
  );
}

export default function CandleScrubScreen() {
  const windowSecs = 300;
  const candleWidthSecs = 15;

  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: true,
    tradeStream: false,
    candleWidth: candleWidthSecs,
    historySpanSeconds: windowSecs,
    historyRange: "1m",
    volatilityMode: "volatile",
    tradesPerSecond: 2,
    maxPoints: 6000,
  });

  // Whether a scrub is active, plus the scrubbed candle's O/H/L/C as strings.
  // `onScrub` (worklet) writes these; the header cells read them on the UI thread.
  const scrubbing = useSharedValue(false);
  const open = useSharedValue("—");
  const high = useSharedValue("—");
  const low = useSharedValue("—");
  const close = useSharedValue("—");
  const cells = { open, high, low, close };

  return (
    <DemoScreen
      title="Candle scrub"
      docs="guides/scrubbing"
      description="Brokerage-style candle scrub: O/H/L/C in a header above the chart, the time pinned to the top edge, and the crosshair kept. A custom renderTooltip shows only ctx.timeStr; the OHLC comes from onScrub's point.candle (live candle when idle)."
      chart={
        <View style={styles.wrap}>
          <View style={styles.header}>
            {OHLC.map(({ label, field }) => (
              <OhlcCell
                key={field}
                label={label}
                field={field}
                scrubbing={scrubbing}
                scrubbed={cells[field]}
                liveCandle={liveCandle}
              />
            ))}
          </View>
          <View style={styles.chart}>
            <LiveChart
              data={data}
              value={value}
              mode="candle"
              candles={candles}
              liveCandle={liveCandle}
              candleWidth={candleWidthSecs}
              accentColor={ACCENT}
              theme={APP_THEME}
              timeWindow={windowSecs}
              // Reserve a top band so the candles sit *below* the pinned time
              // label — the label parks at the canvas edge and the crosshair line
              // stops at it, neither overlapping the data (cf. the extrema labels).
              insets={{ top: 28 }}
              // Custom tooltip = time only, pinned to the top edge. The crosshair
              // line + selection dot stay (the built-in OHLC stack is replaced).
              scrub={{ tooltipPlacement: "top", tooltipMargin: 4 }}
              renderTooltip={TimeTooltip}
              onScrub={(point) => {
                "worklet";
                if (point && point.candle) {
                  scrubbing.set(true);
                  open.set(point.candle.open.toFixed(2));
                  high.set(point.candle.high.toFixed(2));
                  low.set(point.candle.low.toFixed(2));
                  close.set(point.candle.close.toFixed(2));
                } else {
                  // Released — fall back to the live candle in the header.
                  scrubbing.set(false);
                }
              }}
            />
          </View>
        </View>
      }
    >
      <Text style={demoStyles.scrubReadout}>
        Press and drag across the candles. The header shows the scrubbed O/H/L/C
        and the time pins to the top; release to return to the live candle.
      </Text>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: "row",
    paddingBottom: 10,
  },
  cell: { flex: 1 },
  cellValue: {
    color: colors.text,
    fontSize: 15,
    padding: 0,
    fontFamily: "JetBrainsMono_400Regular",
  },
  cellLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  chart: { flex: 1 },
  timeText: {
    // Hug the "HH:MM:SS" text (8 monospace glyphs ≈ 58px) instead of a wide box,
    // so when the label clamps to the canvas edge the *text* reaches the edge
    // rather than sitting inset inside an 80px box.
    width: 64,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 12,
    padding: 0,
    fontFamily: "JetBrainsMono_400Regular",
  },
});
