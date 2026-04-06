import { Pressable, Text, View } from "react-native";
import { LiveChart, LiveChartSeries } from "react-native-livechart";

import { useState } from "react";
import { useSimulatedData } from "../../sim/useSimulatedData";
import { DemoScreen } from "./lib/DemoScreen";
import { ACCENT } from "./lib/shared";
import { demoStyles } from "./lib/styles";
import type { ChartInsets } from "react-native-livechart";

export const options = { title: "Axes & insets" };

type AxisVis = "both" | "noY" | "noX" | "none";
type InsetPreset = "default" | "tight" | "loose";
type GapPreset = "default" | "wide";

const INSETS: Record<InsetPreset, ChartInsets | undefined> = {
  default: undefined,
  tight: { top: 6, bottom: 16, left: 6, right: 6 },
  loose: { top: 20, bottom: 40, left: 20, right: 20 },
};

export default function AxesInsetsScreen() {
  const [vis, setVis] = useState<AxisVis>("both");
  const [insets, setInsets] = useState<InsetPreset>("default");
  const [gap, setGap] = useState<GapPreset>("default");
  const [which, setWhich] = useState<"single" | "multi">("single");
  const [badgePos, setBadgePos] = useState<"off" | "default" | "left">(
    "default",
  );
  const [pulseOn, setPulseOn] = useState(true);

  const yOn = vis !== "noY" && vis !== "none";
  const xOn = vis !== "noX" && vis !== "none";

  const yAxis = !yOn ? false : gap === "wide" ? { minGap: 72 } : true;
  const xAxis = !xOn ? false : gap === "wide" ? { minGap: 100 } : true;

  const { data, value, series } = useSimulatedData({
    multiSeries: which === "multi",
    candleAggregation: false,
    tradeStream: false,
  });

  const insetCfg = INSETS[insets];

  return (
    <DemoScreen
      description="Hide Y, X, or both; minGap; insets; badge (default / left of dot / off) and pulse (LiveChart). Toggle single vs multi chart."
      chart={
        which === "single" ? (
          <LiveChart
            data={data}
            value={value}
            accentColor={ACCENT}
            theme="dark"
            yAxis={yAxis}
            xAxis={xAxis}
            insets={insetCfg}
            badge={
              badgePos === "off"
                ? false
                : badgePos === "left"
                  ? { position: "left" }
                  : true
            }
            pulse={pulseOn}
            scrub
          />
        ) : (
          <LiveChartSeries
            series={series}
            accentColor={ACCENT}
            theme="dark"
            yAxis={yAxis}
            xAxis={xAxis}
            insets={insetCfg}
            scrub
          />
        )
      }
    >
      <Text style={demoStyles.sectionLabel}>Chart</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, which === "single" && demoStyles.chipActive]}
          onPress={() => setWhich("single")}
        >
          <Text
            style={[
              demoStyles.chipText,
              which === "single" && demoStyles.chipTextActive,
            ]}
          >
            LiveChart
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, which === "multi" && demoStyles.chipActive]}
          onPress={() => setWhich("multi")}
        >
          <Text
            style={[
              demoStyles.chipText,
              which === "multi" && demoStyles.chipTextActive,
            ]}
          >
            LiveChartSeries
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Badge (LiveChart)</Text>
      <View style={demoStyles.buttonRow}>
        {(
          [
            ["default", "Default"],
            ["off", "Off"],
            ["left", "Left"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[demoStyles.chip, badgePos === k && demoStyles.chipActive]}
            onPress={() => setBadgePos(k)}
          >
            <Text
              style={[
                demoStyles.chipText,
                badgePos === k && demoStyles.chipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={demoStyles.sectionLabel}>Pulse (LiveChart)</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, pulseOn && demoStyles.chipActive]}
          onPress={() => setPulseOn(true)}
        >
          <Text
            style={[demoStyles.chipText, pulseOn && demoStyles.chipTextActive]}
          >
            On
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, !pulseOn && demoStyles.chipActive]}
          onPress={() => setPulseOn(false)}
        >
          <Text
            style={[demoStyles.chipText, !pulseOn && demoStyles.chipTextActive]}
          >
            Off
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Axis visibility</Text>
      <View style={demoStyles.buttonRow}>
        {(
          [
            ["both", "Both on"],
            ["noY", "Hide Y"],
            ["noX", "Hide X"],
            ["none", "Hide both"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[demoStyles.chip, vis === k && demoStyles.chipActive]}
            onPress={() => setVis(k)}
          >
            <Text
              style={[
                demoStyles.chipText,
                vis === k && demoStyles.chipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={demoStyles.sectionLabel}>Axis minGap (when shown)</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, gap === "default" && demoStyles.chipActive]}
          onPress={() => setGap("default")}
        >
          <Text
            style={[
              demoStyles.chipText,
              gap === "default" && demoStyles.chipTextActive,
            ]}
          >
            Default
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, gap === "wide" && demoStyles.chipActive]}
          onPress={() => setGap("wide")}
        >
          <Text
            style={[
              demoStyles.chipText,
              gap === "wide" && demoStyles.chipTextActive,
            ]}
          >
            Wide minGap
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Insets</Text>
      <View style={demoStyles.buttonRow}>
        {(
          [
            ["default", "Default"],
            ["tight", "Tight"],
            ["loose", "Loose"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[demoStyles.chip, insets === k && demoStyles.chipActive]}
            onPress={() => setInsets(k)}
          >
            <Text
              style={[
                demoStyles.chipText,
                insets === k && demoStyles.chipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </DemoScreen>
  );
}
