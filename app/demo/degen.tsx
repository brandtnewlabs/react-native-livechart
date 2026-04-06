import { Pressable, Text, View } from "react-native";
import { ACCENT, VOLATILITY_MODES } from "./_lib/shared";

import { useState } from "react";
import { useSimulatedData } from "../../sim/useSimulatedData";
import { LiveChart } from "../../src";
import type { DegenOptions } from "../../src/types";
import { DemoScreen } from "./_lib/DemoScreen";
import { demoStyles } from "./_lib/styles";

export const options = { title: "Degen" };

type Preset =
  | "off"
  | "on"
  | "minimal"
  | "heavy"
  | "noShake"
  | "downToo"
  | "customParticles";

function degenFor(p: Preset): boolean | DegenOptions | undefined {
  switch (p) {
    case "off":
      return undefined;
    case "on":
      return true;
    case "minimal":
      return {
        scale: 0.65,
        burstParticleCount: 8,
        particleBurstDurationSec: 0.6,
        shakeIntensity: 0.5,
      };
    case "heavy":
      return {
        scale: 1.35,
        burstParticleCount: 36,
        particleBurstDurationSec: 1.4,
        shakeIntensity: 1.2,
        particleOpacity: 0.7,
        spreadAngle: Math.PI * 1.35,
      };
    case "noShake":
      return { shake: false, scale: 1.1 };
    case "downToo":
      return { downMomentum: true };
    case "customParticles":
      return {
        particleSizeMin: 2,
        particleSizeMax: 5,
        drag: 0.88,
        speedMin: 40,
        speedMax: 200,
        positionJitterX: 40,
        positionJitterY: 14,
        colors: ["#f472b6", "#22d3ee", "#fde047"],
      };
    default:
      return undefined;
  }
}

export default function DegenScreen() {
  const [preset, setPreset] = useState<Preset>("on");
  const [vol, setVol] = useState<(typeof VOLATILITY_MODES)[number]>("volatile");

  const { data, value } = useSimulatedData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    volatilityMode: vol,
  });

  return (
    <DemoScreen
      description="DegenOptions presets; use volatile/chaotic to see bursts"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme="dark"
          exaggerate
          degen={degenFor(preset)}
          scrub={false}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>Preset</Text>
      <View style={demoStyles.buttonRow}>
        {(
          [
            ["off", "Off"],
            ["on", "Default"],
            ["minimal", "Minimal"],
            ["heavy", "Heavy"],
            ["noShake", "No shake"],
            ["downToo", "Down momentum"],
            ["customParticles", "Particle colors"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[demoStyles.chip, preset === k && demoStyles.chipActive]}
            onPress={() => setPreset(k)}
          >
            <Text
              style={[
                demoStyles.chipText,
                preset === k && demoStyles.chipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={demoStyles.sectionLabel}>Volatility</Text>
      <View style={demoStyles.buttonRow}>
        {VOLATILITY_MODES.map((m) => (
          <Pressable
            key={m}
            style={[demoStyles.chip, vol === m && demoStyles.chipActive]}
            onPress={() => setVol(m)}
          >
            <Text
              style={[
                demoStyles.chipText,
                vol === m && demoStyles.chipTextActive,
              ]}
            >
              {m}
            </Text>
          </Pressable>
        ))}
      </View>
    </DemoScreen>
  );
}
