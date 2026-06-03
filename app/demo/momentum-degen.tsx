import { useState } from "react";
import type {
  DegenOptions,
  Momentum,
  MomentumConfig,
} from "react-native-livechart";
import { LiveChart } from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow } from "../../demo-lib/ChipRow";
import { ACCENT, VOLATILITY_MODES } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Momentum & degen" };

type MomentumMode =
  | "auto"
  | "off"
  | "up"
  | "down"
  | "flat"
  | "sensitive"
  | "dull";

function resolveMomentum(mode: MomentumMode): boolean | Momentum | MomentumConfig {
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

const MOMENTUM_OPTIONS: { value: MomentumMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "off", label: "Off" },
  { value: "up", label: "Force up" },
  { value: "down", label: "Force down" },
  { value: "flat", label: "Force flat" },
  { value: "sensitive", label: "Sensitive" },
  { value: "dull", label: "Dull" },
];

type DegenPreset =
  | "off"
  | "on"
  | "minimal"
  | "heavy"
  | "noShake"
  | "downToo"
  | "customParticles";

function degenFor(p: DegenPreset): boolean | DegenOptions | undefined {
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

const DEGEN_OPTIONS: { value: DegenPreset; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "on", label: "Default" },
  { value: "minimal", label: "Minimal" },
  { value: "heavy", label: "Heavy" },
  { value: "noShake", label: "No shake" },
  { value: "downToo", label: "Down momentum" },
  { value: "customParticles", label: "Particle colors" },
];

const VOLATILITY_OPTIONS = VOLATILITY_MODES.map((v) => ({ value: v, label: v }));
const Y_SCALE_OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: "Exaggerate" },
  { value: false, label: "Normal scale" },
];

export default function MomentumDegenScreen() {
  const [momentumMode, setMomentumMode] = useState<MomentumMode>("auto");
  const [degenPreset, setDegenPreset] = useState<DegenPreset>("on");
  const [volatility, setVolatility] =
    useState<(typeof VOLATILITY_MODES)[number]>("volatile");
  const [exaggerate, setExaggerate] = useState(true);

  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    volatilityMode: volatility,
  });

  return (
    <DemoScreen
      docs="guides/momentum-and-degen"
      description={
        "Momentum tints the value badge (green = up, red = down, blue = flat); it eases slowly, so wait a beat after switching. " +
        "Degen layers particle bursts + screen shake on top. Use volatile/chaotic to see both react."
      }
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          momentum={resolveMomentum(momentumMode)}
          degen={degenFor(degenPreset)}
          exaggerate={exaggerate}
          scrub={false}
        />
      }
    >
      <ChipRow
        label="Sim volatility"
        options={VOLATILITY_OPTIONS}
        value={volatility}
        onChange={setVolatility}
      />
      <ChipRow
        label="Y scale"
        options={Y_SCALE_OPTIONS}
        value={exaggerate}
        onChange={setExaggerate}
      />
      <ChipRow
        label="Momentum"
        options={MOMENTUM_OPTIONS}
        value={momentumMode}
        onChange={setMomentumMode}
      />
      <ChipRow
        label="Degen"
        options={DEGEN_OPTIONS}
        value={degenPreset}
        onChange={setDegenPreset}
      />
    </DemoScreen>
  );
}
