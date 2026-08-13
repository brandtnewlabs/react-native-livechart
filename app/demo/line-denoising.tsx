import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  LiveChart,
  type LineConfig,
  type LiveChartPoint,
} from "react-native-livechart";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { ChipRow } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import {
  APP_FONT_FAMILY,
  APP_FONT_FAMILY_MEDIUM,
} from "../../demo-lib/fonts";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";

export const options = { title: "Line denoising" };

const SPAN_SECONDS = 60;
const POINT_COUNT = 241;
const END_TIME = 1_700_000_060;

/**
 * A deterministic signal with three distinct layers:
 * - broad trend / waves (the structure we want to keep),
 * - two narrow events (a peak and a dip that must survive),
 * - high-frequency, low-amplitude sample noise (the removable detail).
 */
function makeNoisySignal(): LiveChartPoint[] {
  return Array.from({ length: POINT_COUNT }, (_, i) => {
    const t = i / (POINT_COUNT - 1);
    const trend = t * 2.2;
    const structure =
      Math.sin(t * Math.PI * 2.4) * 2.3 +
      Math.sin(t * Math.PI * 6.2) * 0.65;
    const peak = Math.exp(-Math.pow((t - 0.57) / 0.018, 2)) * 2.8;
    const dip = -Math.exp(-Math.pow((t - 0.79) / 0.024, 2)) * 2.3;
    const sampleNoise =
      (Math.sin(i * 2.73) + Math.sin(i * 5.17) * 0.42) * 0.13;

    return {
      time: END_TIME - SPAN_SECONDS + t * SPAN_SECONDS,
      value: 100 + trend + structure + peak + dip + sampleNoise,
    };
  });
}

type Curve = NonNullable<LineConfig["curve"]>;

const TOLERANCE_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 0.75, label: "0.75 px" },
  { value: 1.5, label: "1.5 px" },
  { value: 3, label: "3 px" },
] as const;

const CURVE_OPTIONS: { value: Curve; label: string }[] = [
  { value: "monotone", label: "Monotone" },
  { value: "linear", label: "Linear" },
];

function SignalChart({
  data,
  value,
  curve,
  simplify,
  color,
}: {
  data: SharedValue<LiveChartPoint[]>;
  value: SharedValue<number>;
  curve: Curve;
  simplify: number;
  color: string;
}) {
  return (
    <LiveChart
      static
      data={data}
      value={value}
      accentColor={color}
      theme={APP_THEME}
      timeWindow={SPAN_SECONDS}
      nowOverride={END_TIME}
      windowBuffer={0}
      insets={{ top: 8, right: 6, bottom: 8, left: 6 }}
      line={{ width: 1.6, curve, simplify }}
      gradient={false}
      badge={false}
      dot={false}
      pulse={false}
      valueLine={false}
      yAxis={false}
      xAxis={false}
      scrub={false}
      leftEdgeFade={false}
      style={styles.chart}
    />
  );
}

export default function LineDenoisingScreen() {
  const [tolerance, setTolerance] = useState<number>(1.5);
  const [curve, setCurve] = useState<Curve>("monotone");
  const [points] = useState(makeNoisySignal);
  const data = useSharedValue<LiveChartPoint[]>(points);
  const value = useSharedValue(points[points.length - 1].value);

  return (
    <DemoScreen
      title="Line denoising"
      docs="guides/line-denoising"
      description="One signal, two paths. Remove sub-pixel sample noise while the larger trend, peak, and dip remain anchored to the original data."
      chartWrapperStyle={styles.chartWrapper}
      chart={
        <View style={styles.comparison}>
          <View style={styles.signalPanel}>
            <View style={styles.signalHeader}>
              <Text style={styles.signalLabel}>Raw path</Text>
              <Text style={styles.signalMeta}>{POINT_COUNT} points</Text>
            </View>
            <SignalChart
              data={data}
              value={value}
              curve={curve}
              simplify={0}
              color="#87909c"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.signalPanel}>
            <View style={styles.signalHeader}>
              <Text style={styles.signalLabel}>Simplified path</Text>
              <Text style={styles.signalMeta}>
                tolerance {tolerance.toFixed(2).replace(/\.00$/, "")} px
              </Text>
            </View>
            <SignalChart
              data={data}
              value={value}
              curve={curve}
              simplify={tolerance}
              color={ACCENT}
            />
          </View>
        </View>
      }
    >
      <ChipRow
        label="Path tolerance"
        options={TOLERANCE_OPTIONS}
        value={tolerance}
        onChange={setTolerance}
      />
      <ChipRow
        label="Curve"
        options={CURVE_OPTIONS}
        value={curve}
        onChange={setCurve}
      />
      <View style={styles.note}>
        <Text style={styles.noteTitle}>Geometry only</Text>
        <Text style={styles.noteBody}>
          The scale, live value, markers, and scrub interpolation still read all
          {` ${POINT_COUNT} `}source points. Only intermediate points in the
          rendered line and fill may be removed.
        </Text>
      </View>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  chartWrapper: {
    height: 382,
  },
  comparison: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  signalPanel: {
    flex: 1,
    paddingTop: 9,
  },
  signalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 12,
  },
  signalLabel: {
    color: colors.text,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
    fontSize: 12,
  },
  signalMeta: {
    color: colors.textFaint,
    fontFamily: APP_FONT_FAMILY,
    fontSize: 10,
    fontVariant: ["tabular-nums"],
  },
  chart: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  note: {
    marginTop: 12,
    padding: 12,
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
    backgroundColor: colors.chipBackground,
  },
  noteTitle: {
    color: colors.text,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
    fontSize: 12,
    marginBottom: 4,
  },
  noteBody: {
    color: colors.textMuted,
    fontFamily: APP_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 17,
  },
});
