import { Pressable, Text, View } from "react-native";
import { ACCENT, VOLATILITY_MODES } from "../../src/demo/shared";
import type { Momentum, MomentumConfig } from "../../src/types";

import { useState } from "react";
import { useSimulatedData } from "../../sim/useSimulatedData";
import { LiveChart } from "../../src";
import { DemoScreen } from "../../src/demo/DemoScreen";
import { demoStyles } from "../../src/demo/styles";

export const options = { title: "Momentum" };

type Mode = "auto" | "off" | "up" | "down" | "flat" | "sensitive" | "dull";

function resolveMomentum(mode: Mode): boolean | Momentum | MomentumConfig {
  switch (mode) {
    case "auto":
      return true;
    case "off":
      return false;
    case "up":
      return "up";
    case "down":
      return "down";
    case "flat":
      return "flat";
    case "sensitive":
      return { threshold: 0.06, lookback: 12 };
    case "dull":
      return { threshold: 0.22, lookback: 28 };
    default:
      return true;
  }
}

export default function MomentumScreen() {
  const [mode, setMode] = useState<Mode>("auto");
  const [volatility, setVolatility] =
    useState<(typeof VOLATILITY_MODES)[number]>("volatile");
  const [exaggerate, setExaggerate] = useState(true);

  const { data, value } = useSimulatedData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    volatilityMode: volatility,
  });

  return (
    <DemoScreen
      description={
        "Momentum tints the value badge on the right (green = up, red = down, blue = flat). " +
        "It eases slowly—wait a second after switching. " +
        "The live dot stays accent-colored; degen uses momentum separately on its own screen."
      }
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme="dark"
          momentum={resolveMomentum(mode)}
          exaggerate={exaggerate}
          scrub={false}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>Sim volatility (auto modes)</Text>
      <View style={demoStyles.buttonRow}>
        {VOLATILITY_MODES.map((v) => (
          <Pressable
            key={v}
            style={[demoStyles.chip, volatility === v && demoStyles.chipActive]}
            onPress={() => setVolatility(v)}
          >
            <Text
              style={[
                demoStyles.chipText,
                volatility === v && demoStyles.chipTextActive,
              ]}
            >
              {v}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={demoStyles.sectionLabel}>Y scale</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, exaggerate && demoStyles.chipActive]}
          onPress={() => setExaggerate(true)}
        >
          <Text
            style={[
              demoStyles.chipText,
              exaggerate && demoStyles.chipTextActive,
            ]}
          >
            Exaggerate (default)
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, !exaggerate && demoStyles.chipActive]}
          onPress={() => setExaggerate(false)}
        >
          <Text
            style={[
              demoStyles.chipText,
              !exaggerate && demoStyles.chipTextActive,
            ]}
          >
            Normal scale
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Momentum</Text>
      <View style={demoStyles.buttonRow}>
        {(
          [
            ["auto", "Auto"],
            ["off", "Off"],
            ["up", "Force up"],
            ["down", "Force down"],
            ["flat", "Force flat"],
            ["sensitive", "Sensitive"],
            ["dull", "Dull"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[demoStyles.chip, mode === k && demoStyles.chipActive]}
            onPress={() => setMode(k)}
          >
            <Text
              style={[
                demoStyles.chipText,
                mode === k && demoStyles.chipTextActive,
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
