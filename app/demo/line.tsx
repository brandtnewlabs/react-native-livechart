import { useState } from "react";
import type { BadgeConfig, PulseConfig } from "react-native-livechart";
import { LiveChart } from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Line & area" };

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

const BADGE_OPTIONS: { value: BadgeMode; label: string }[] = [
  { value: "on", label: "Default" },
  { value: "off", label: "Off" },
  { value: "left", label: "Left" },
  { value: "minimal", label: "Minimal" },
  { value: "noTail", label: "No tail" },
  { value: "customBg", label: "Purple bg" },
];

type PulseMode = "on" | "off" | "custom";

function resolvePulse(mode: PulseMode): boolean | PulseConfig {
  if (mode === "off") return false;
  if (mode === "on") return true;
  return { interval: 900, maxRadius: 28, duration: 1200, opacity: 0.55 };
}

const PULSE_OPTIONS: { value: PulseMode; label: string }[] = [
  { value: "on", label: "Default" },
  { value: "off", label: "Off" },
  { value: "custom", label: "Fast / large" },
];

export default function LineScreen() {
  const [badgeMode, setBadgeMode] = useState<BadgeMode>("on");
  const [pulseMode, setPulseMode] = useState<PulseMode>("on");
  const [valueLine, setValueLine] = useState(true);
  const [showValue, setShowValue] = useState(false);
  const [valueMomentumColor, setValueMomentumColor] = useState(false);

  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
  });

  return (
    <DemoScreen
      docs="guides/line-and-area"
      description="The single line: badge, pulse, value line, and the live value overlay."
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          badge={resolveBadge(badgeMode)}
          pulse={resolvePulse(pulseMode)}
          valueLine={valueLine}
          showValue={showValue}
          valueMomentumColor={valueMomentumColor}
          scrub={false}
        />
      }
    >
      <ChipRow
        label="Badge"
        options={BADGE_OPTIONS}
        value={badgeMode}
        onChange={setBadgeMode}
      />
      <ChipRow
        label="Pulse"
        options={PULSE_OPTIONS}
        value={pulseMode}
        onChange={setPulseMode}
      />
      <ControlRow label="Value line">
        <ToggleChip
          label="valueLine"
          value={valueLine}
          onChange={setValueLine}
        />
      </ControlRow>
      <ControlRow label="Live value overlay">
        <ToggleChip
          label="showValue"
          value={showValue}
          onChange={setShowValue}
        />
        <ToggleChip
          label="Momentum color"
          value={valueMomentumColor}
          onChange={setValueMomentumColor}
        />
      </ControlRow>
    </DemoScreen>
  );
}
