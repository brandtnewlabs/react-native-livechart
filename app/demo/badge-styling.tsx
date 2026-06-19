import { useState } from "react";
import type {
  BadgeConfig,
  FontWeight,
  LiveChartPalette,
} from "react-native-livechart";
import { LiveChart } from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Badge styling" };

// ─── Position (tail on "right", plain pill on "left") ───────────────────────
type Pos = "right" | "left";
const POSITIONS: { value: Pos; label: string }[] = [
  { value: "right", label: "Right (tail)" },
  { value: "left", label: "Left (pill)" },
];

// ─── Corner radius ──────────────────────────────────────────────────────────
type RadiusMode = "capsule" | "rounded" | "sharp";
// The pill is short (~17px tall → capsule radius ~8.5), so "rounded" must be
// well below that to read as a distinct rounded-rect rather than the capsule.
const RADIUS: Record<RadiusMode, number | undefined> = {
  capsule: undefined, // default: pillHeight / 2
  rounded: 4,
  sharp: 0,
};
const RADIUS_OPTIONS: { value: RadiusMode; label: string }[] = [
  { value: "capsule", label: "Capsule" },
  { value: "rounded", label: "Rounded 4" },
  { value: "sharp", label: "Sharp 0" },
];

// ─── Background ──────────────────────────────────────────────────────────
// `undefined` keeps the default momentum tint (green up / red down / accent
// flat); a string pins a fixed color and overrides the tint.
type BgMode = "momentum" | "violet" | "slate" | "amber";
const BACKGROUND: Record<BgMode, string | undefined> = {
  momentum: undefined,
  violet: "#7c3aed",
  slate: "#1e293b",
  amber: "#f59e0b",
};
const BG_OPTIONS: { value: BgMode; label: string }[] = [
  { value: "momentum", label: "Momentum" },
  { value: "violet", label: "Violet" },
  { value: "slate", label: "Slate" },
  { value: "amber", label: "Amber" },
];

// ─── Momentum tint (palette) ─────────────────────────────────────────────
// When Background = "Momentum", the pill is tinted from the chart `palette`:
// up → dotUp, down → dotDown, flat → badgeBg. Override those keys to recolor
// the tinted states. (No effect when a fixed Background color is chosen.)
type TintMode = "default" | "tealRose" | "mono";
const TINT: Record<TintMode, Partial<LiveChartPalette> | undefined> = {
  default: undefined,
  tealRose: { dotUp: "#14b8a6", dotDown: "#f43f5e", badgeBg: "#475569" },
  mono: { dotUp: "#64748b", dotDown: "#64748b", badgeBg: "#64748b" },
};
const TINT_OPTIONS: { value: TintMode; label: string }[] = [
  { value: "default", label: "Theme" },
  { value: "tealRose", label: "Teal / Rose" },
  { value: "mono", label: "Mono" },
];

// ─── Border ───────────────────────────────────────────────────────────────
type BorderMode = "none" | "white" | "accent";
const BORDER: Record<BorderMode, Pick<BadgeConfig, "borderColor" | "borderWidth">> = {
  none: { borderColor: undefined },
  white: { borderColor: "#ffffff", borderWidth: 1 },
  accent: { borderColor: ACCENT, borderWidth: 2.5 },
};
const BORDER_OPTIONS: { value: BorderMode; label: string }[] = [
  { value: "none", label: "None" },
  { value: "white", label: "White 1px" },
  { value: "accent", label: "Accent 2.5px" },
];

// ─── Text color ──────────────────────────────────────────────────────────
type TextMode = "default" | "dark" | "lime";
const TEXT_COLOR: Record<TextMode, string | undefined> = {
  default: undefined,
  dark: "#0f172a",
  lime: "#a3e635",
};
const TEXT_OPTIONS: { value: TextMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "dark", label: "Dark" },
  { value: "lime", label: "Lime" },
];

// ─── Font ────────────────────────────────────────────────────────────────
type FontMode = "default" | "large" | "bold";
const FONT: Record<FontMode, Pick<BadgeConfig, "fontSize" | "fontWeight">> = {
  default: {},
  large: { fontSize: 18 },
  bold: { fontSize: 14, fontWeight: "700" as FontWeight },
};
const FONT_OPTIONS: { value: FontMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "large", label: "Large 18" },
  { value: "bold", label: "Bold 14" },
];

// ─── Offset ──────────────────────────────────────────────────────────────
type OffsetMode = "none" | "up" | "in";
const OFFSET: Record<OffsetMode, Pick<BadgeConfig, "offsetX" | "offsetY">> = {
  none: { offsetX: 0, offsetY: 0 },
  up: { offsetX: 0, offsetY: -16 },
  in: { offsetX: -18, offsetY: 0 },
};
const OFFSET_OPTIONS: { value: OffsetMode; label: string }[] = [
  { value: "none", label: "None" },
  { value: "up", label: "Up 16" },
  { value: "in", label: "In 18" },
];

export default function BadgeStylingScreen() {
  const [position, setPosition] = useState<Pos>("right");
  const [radius, setRadius] = useState<RadiusMode>("rounded");
  const [bg, setBg] = useState<BgMode>("momentum");
  const [tint, setTint] = useState<TintMode>("default");
  const [border, setBorder] = useState<BorderMode>("white");
  const [text, setText] = useState<TextMode>("default");
  const [font, setFont] = useState<FontMode>("default");
  const [offset, setOffset] = useState<OffsetMode>("none");

  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    historySpanSeconds: 40,
    historyRange: "1m",
  });

  const badge: BadgeConfig = {
    position,
    radius: RADIUS[radius],
    background: BACKGROUND[bg],
    textColor: TEXT_COLOR[text],
    ...BORDER[border],
    ...FONT[font],
    ...OFFSET[offset],
  };

  return (
    <DemoScreen
      title="Badge styling"
      docs="guides/theming"
      description="Skia-native badge knobs (radius, background, border, text color, font, offset), plus recoloring the momentum tint via the chart palette."
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          palette={TINT[tint]}
          badge={badge}
          scrub={false}
        />
      }
    >
      <ChipRow
        label="Position"
        options={POSITIONS}
        value={position}
        onChange={setPosition}
      />
      <ChipRow
        label="Radius"
        options={RADIUS_OPTIONS}
        value={radius}
        onChange={setRadius}
      />
      <ChipRow
        label="Background"
        options={BG_OPTIONS}
        value={bg}
        onChange={setBg}
      />
      <ChipRow
        label="Momentum tint"
        options={TINT_OPTIONS}
        value={tint}
        onChange={setTint}
      />
      <ChipRow
        label="Border"
        options={BORDER_OPTIONS}
        value={border}
        onChange={setBorder}
      />
      <ChipRow
        label="Text color"
        options={TEXT_OPTIONS}
        value={text}
        onChange={setText}
      />
      <ChipRow label="Font" options={FONT_OPTIONS} value={font} onChange={setFont} />
      <ChipRow
        label="Offset"
        options={OFFSET_OPTIONS}
        value={offset}
        onChange={setOffset}
      />
    </DemoScreen>
  );
}
