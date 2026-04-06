import { Pressable, Text, View } from "react-native";
import type { BadgeConfig, PulseConfig } from "react-native-livechart";

import { useState } from "react";
import { useSimulatedData } from "../../sim/useSimulatedData";
import { LiveChart } from "react-native-livechart";
import { DemoScreen } from "./lib/DemoScreen";
import { ACCENT } from "./lib/shared";
import { demoStyles } from "./lib/styles";

export const options = { title: "Badge & pulse" };

type BadgeMode = "on" | "off" | "left" | "minimal" | "noTail" | "customBg";

function resolveBadge(mode: BadgeMode): boolean | BadgeConfig {
  switch (mode) {
    case "off":
      return false;
    case "on":
      return true;
    case "left":
      return { position: "left" };
    case "minimal":
      return { variant: "minimal" };
    case "noTail":
      return { tail: false };
    case "customBg":
      return { background: "rgba(168,85,247,0.9)" };
    default:
      return true;
  }
}

type PulseMode = "on" | "off" | "custom";

function resolvePulse(mode: PulseMode): boolean | PulseConfig {
  if (mode === "off") return false;
  if (mode === "on") return true;
  return { interval: 900, maxRadius: 28, duration: 1200, opacity: 0.55 };
}

export default function BadgePulseScreen() {
  const [badgeMode, setBadgeMode] = useState<BadgeMode>("on");
  const [pulseMode, setPulseMode] = useState<PulseMode>("on");

  const { data, value } = useSimulatedData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
  });

  return (
    <DemoScreen
      description="badge variants and pulse / PulseConfig"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme="dark"
          badge={resolveBadge(badgeMode)}
          pulse={resolvePulse(pulseMode)}
          scrub={false}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>Badge</Text>
      <View style={demoStyles.buttonRow}>
        {(
          [
            ["on", "Default"],
            ["off", "Off"],
            ["left", "Left"],
            ["minimal", "Minimal"],
            ["noTail", "No tail"],
            ["customBg", "Purple bg"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[demoStyles.chip, badgeMode === k && demoStyles.chipActive]}
            onPress={() => setBadgeMode(k)}
          >
            <Text
              style={[
                demoStyles.chipText,
                badgeMode === k && demoStyles.chipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={demoStyles.sectionLabel}>Pulse</Text>
      <View style={demoStyles.buttonRow}>
        {(
          [
            ["on", "Default"],
            ["off", "Off"],
            ["custom", "Fast / large"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[demoStyles.chip, pulseMode === k && demoStyles.chipActive]}
            onPress={() => setPulseMode(k)}
          >
            <Text
              style={[
                demoStyles.chipText,
                pulseMode === k && demoStyles.chipTextActive,
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
