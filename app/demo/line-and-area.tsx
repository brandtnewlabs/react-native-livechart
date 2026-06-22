import { useState } from "react";
import type {
  AreaDotsConfig,
  BadgeConfig,
  GradientConfig,
  LineConfig,
  PulseConfig,
} from "react-native-livechart";
import { LiveChart } from "react-native-livechart";
import { StyleSheet, TextInput } from "react-native";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Line & area" };

type BadgeMode = "on" | "off" | "left" | "minimal" | "noTail" | "customBg";

type LineMode = "default" | "solid" | "gradient" | "tricolor" | "custom";

const LINE_OPTIONS: { value: LineMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "solid", label: "Solid" },
  { value: "gradient", label: "Gradient" },
  { value: "tricolor", label: "3-color" },
  { value: "custom", label: "Custom" },
];

type CurveMode = "monotone" | "linear";

const CURVE_OPTIONS: { value: CurveMode; label: string }[] = [
  { value: "monotone", label: "Monotone" },
  { value: "linear", label: "Linear" },
];

// `curve`, `join`, and `cap` are independent knobs (see the "Curve & edges"
// guide section) — they don't have to move together, so each gets its own chip.
type JoinMode = "round" | "miter" | "bevel";

const JOIN_OPTIONS: { value: JoinMode; label: string }[] = [
  { value: "round", label: "Round" },
  { value: "miter", label: "Miter" },
  { value: "bevel", label: "Bevel" },
];

type CapMode = "round" | "butt" | "square";

const CAP_OPTIONS: { value: CapMode; label: string }[] = [
  { value: "round", label: "Round" },
  { value: "butt", label: "Butt" },
  { value: "square", label: "Square" },
];

function resolveLine(
  mode: LineMode,
  customColors: string[],
  curve: CurveMode,
  join: JoinMode,
  cap: CapMode,
): LineConfig | undefined {
  let base: LineConfig | undefined;
  switch (mode) {
    case "solid":
      base = { color: "#ff6b6b" };
      break;
    case "gradient":
      base = { colors: ["#ff6b6b", "#6b6bff"] };
      break;
    case "tricolor":
      base = { colors: ["#ff6b6b", "#6bff6b", "#6b6bff"] };
      break;
    case "custom": {
      const valid = customColors.filter((c) => c.trim().length > 0);
      base = valid.length < 2 ? undefined : { colors: valid };
      break;
    }
    default:
      base = undefined;
  }
  // Each edge knob is applied independently — e.g. a smooth curve with butt caps,
  // or linear segments with round joins. Defaults (monotone/round/round) collapse
  // back to `base` so the chart's own defaults shine through.
  const overrides: LineConfig = {};
  if (curve !== "monotone") overrides.curve = curve;
  if (join !== "round") overrides.join = join;
  if (cap !== "round") overrides.cap = cap;
  if (Object.keys(overrides).length === 0) return base;
  return { ...(base ?? {}), ...overrides };
}

// Area fill `gradient`: off, the accent-derived default, or explicit multi-stop
// `colors` (see the guide's "Gradient fill" usage). GradientConfig fields:
// topOpacity / bottomOpacity / colors / positions.
type GradientMode = "default" | "off" | "custom";

const GRADIENT_OPTIONS: { value: GradientMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "off", label: "Off" },
  { value: "custom", label: "Custom" },
];

function resolveGradient(mode: GradientMode): boolean | GradientConfig {
  if (mode === "off") return false;
  if (mode === "default") return true;
  // Explicit multi-stop colors (top → bottom) with matching stop positions.
  return {
    colors: ["rgba(107,107,255,0.45)", "rgba(255,107,107,0.12)", "transparent"],
    positions: [0, 0.6, 1],
  };
}

// Dotted-lattice area fill (`areaDots`, guide's "Dotted area fill"). Off by
// default. AreaDotsConfig fields: spacing / size / color / opacity.
type AreaDotsMode = "off" | "on" | "dense";

const AREA_DOTS_OPTIONS: { value: AreaDotsMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
  { value: "dense", label: "Dense" },
];

function resolveAreaDots(mode: AreaDotsMode): boolean | AreaDotsConfig {
  if (mode === "off") return false;
  if (mode === "on") return true;
  return { spacing: 7, size: 1.4 };
}

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
  const [lineMode, setLineMode] = useState<LineMode>("default");
  const [curve, setCurve] = useState<CurveMode>("monotone");
  const [join, setJoin] = useState<JoinMode>("round");
  const [cap, setCap] = useState<CapMode>("round");
  const [gradientMode, setGradientMode] = useState<GradientMode>("default");
  const [areaDotsMode, setAreaDotsMode] = useState<AreaDotsMode>("off");
  const [customColors, setCustomColors] = useState(["#ff6b6b", "#6bff6b"]);
  const [valueLine, setValueLine] = useState(true);
  const [showValue, setShowValue] = useState(false);
  const [valueMomentumColor, setValueMomentumColor] = useState(false);
  const [dots, setDots] = useState(true);
  const [ring, setRing] = useState(true);

  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    // Dense seed so the line is fully drawn (and lively) on first frame instead
    // of flat until live ticks fill the default 30s window.
    historySpanSeconds: 40,
    historyRange: "1m",
  });

  return (
    <DemoScreen
      title="Line & area"
      docs="guides/line-and-area"
      description="The single line: badge, pulse, value line, and the live value overlay."
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          line={resolveLine(lineMode, customColors, curve, join, cap)}
          gradient={resolveGradient(gradientMode)}
          areaDots={resolveAreaDots(areaDotsMode)}
          badge={resolveBadge(badgeMode)}
          pulse={resolvePulse(pulseMode)}
          dot={{ show: dots, ring }}
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
        label="Line"
        options={LINE_OPTIONS}
        value={lineMode}
        onChange={setLineMode}
      />
      <ChipRow
        label="Curve"
        options={CURVE_OPTIONS}
        value={curve}
        onChange={setCurve}
      />
      <ChipRow
        label="Join (corners)"
        options={JOIN_OPTIONS}
        value={join}
        onChange={setJoin}
      />
      <ChipRow
        label="Cap (ends)"
        options={CAP_OPTIONS}
        value={cap}
        onChange={setCap}
      />
      <ChipRow
        label="Gradient fill"
        options={GRADIENT_OPTIONS}
        value={gradientMode}
        onChange={setGradientMode}
      />
      <ChipRow
        label="Area dots"
        options={AREA_DOTS_OPTIONS}
        value={areaDotsMode}
        onChange={setAreaDotsMode}
      />
      {lineMode === "custom" && (
        <ControlRow label="Gradient colors">
          {customColors.map((c, i) => (
            <TextInput
              key={i}
              style={styles.colorInput}
              value={c}
              onChangeText={(t) =>
                setCustomColors((prev) => {
                  const next = [...prev];
                  next[i] = t;
                  return next;
                })
              }
              placeholder="#ff0000"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
            />
          ))}
          <TextInput
            style={styles.colorInput}
            value=""
            onChangeText={(t) =>
              t.trim().length > 0
                ? setCustomColors((prev) => [...prev, t])
                : undefined
            }
            placeholder="+ add color"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </ControlRow>
      )}
      <ChipRow
        label="Pulse"
        options={PULSE_OPTIONS}
        value={pulseMode}
        onChange={setPulseMode}
      />
      <ControlRow label="Dot">
        <ToggleChip label="Dot" value={dots} onChange={setDots} />
        <ToggleChip label="Ring" value={ring} onChange={setRing} />
      </ControlRow>
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

const styles = StyleSheet.create({
  colorInput: {
    width: 100,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#1a1a1a",
    color: "#eee",
    fontSize: 13,
    paddingHorizontal: 10,
    fontFamily: "JetBrainsMono_400Regular",
  },
});
