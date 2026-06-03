import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { BadgeConfig, PulseConfig } from "react-native-livechart";
import { APP_THEME } from "../../demo-lib/theme";
import { LiveChart } from "react-native-livechart";

import { useSimulatedChartData } from "../../sim/useSimulatedChartData";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";

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
  const [showValue, setShowValue] = useState(false);
  const [valueMomentumColor, setValueMomentumColor] = useState(false);

  const { data, value } = useSimulatedChartData({
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
          theme={APP_THEME}
          badge={resolveBadge(badgeMode)}
          pulse={resolvePulse(pulseMode)}
          showValue={showValue}
          valueMomentumColor={valueMomentumColor}
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

      <Text style={demoStyles.sectionLabel}>Live value overlay</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, showValue && demoStyles.chipActive]}
          onPress={() => setShowValue((v) => !v)}
        >
          <Text
            style={[demoStyles.chipText, showValue && demoStyles.chipTextActive]}
          >
            showValue
          </Text>
        </Pressable>
        <Pressable
          style={[
            demoStyles.chip,
            valueMomentumColor && demoStyles.chipActive,
          ]}
          onPress={() => setValueMomentumColor((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              valueMomentumColor && demoStyles.chipTextActive,
            ]}
          >
            Momentum color
          </Text>
        </Pressable>
      </View>
    </DemoScreen>
  );
}
