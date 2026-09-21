import { Pressable, Text, View } from "react-native";

import {
  JetBrainsMono_400Regular,
  useFonts as useJetBrainsFonts,
} from "@expo-google-fonts/jetbrains-mono";
import { useFonts } from "expo-font";
import {
  useState,
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  LiveChart,
  MONO_FONT_FAMILY,
  type FontConfig,
  type FontWeight,
  type LiveChartMetricsOverride,
} from "react-native-livechart";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT_PRESETS } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";
import { APP_THEME } from "../../demo-lib/theme";

const googleSansCodeRegular = require("../../assets/fonts/GoogleSansCode-Regular.ttf");

const FONT_SIZES = [10, 11, 13, 15] as const;
const WEIGHTS: FontWeight[] = ["normal", "600", "bold"];

const THEME_OPTIONS: { value: "dark" | "light"; label: string }[] = [
  { value: "dark", label: "dark" },
  { value: "light", label: "light" },
];

const ACCENT_OPTIONS = ACCENT_PRESETS.map((c) => ({ value: c, label: c }));

type GradientMode = "on" | "off" | "custom" | "multi";

const GRADIENT_OPTIONS: { value: GradientMode; label: string }[] = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
  { value: "custom", label: "Custom opacity" },
  { value: "multi", label: "Multi-color" },
];

/** A 3-stop area fill (accent → violet → transparent). */
const MULTI_GRADIENT_COLORS = [
  "rgba(51,35,230,0.45)",
  "rgba(168,85,247,0.25)",
  "rgba(168,85,247,0)",
];

// `metrics` is the shape-and-feel override (namespaced like `palette` is for
// color). These two toggles each flip a couple of tokens that produce a visible
// effect: a roomier value pill (badge geometry) and snappier motion (faster
// badge-color lerp + grid fade-in).
const ROOMY_BADGE: LiveChartMetricsOverride["badge"] = {
  padX: 16,
  tailLength: 9,
};
const FAST_MOTION: LiveChartMetricsOverride = {
  motion: { badgeColorSpeed: 0.3 },
  grid: { fadeInSpeed: 0.45 },
};

const FONT_SIZE_OPTIONS = FONT_SIZES.map((s) => ({
  value: s,
  label: `${s}px`,
}));
const WEIGHT_OPTIONS = WEIGHTS.map((w) => ({ value: w, label: w }));

/** Platform `matchFont` mono vs bundled fonts via Skia `typeface` (+ expo-font for RN labels). */
type SkiaFontFamilyDemo = "platformMono" | "jetbrainsMono" | "googleSansCode";

type LiveChartProps = ComponentProps<typeof LiveChart>;

function resolveMetrics(
  roomyBadge: boolean,
  fastMotion: boolean,
): LiveChartMetricsOverride | undefined {
  if (!roomyBadge && !fastMotion) return undefined;
  return {
    ...(roomyBadge ? { badge: ROOMY_BADGE } : {}),
    ...(fastMotion ? FAST_MOTION : {}),
  };
}

function resolveGradient(mode: GradientMode): LiveChartProps["gradient"] {
  switch (mode) {
    case "off":
      return false;
    case "custom":
      return { topOpacity: 0.5, bottomOpacity: 0.05 };
    case "multi":
      return { colors: MULTI_GRADIENT_COLORS };
    case "on":
      return true;
  }
}

function resolveTypeface(
  family: SkiaFontFamilyDemo,
): FontConfig["typeface"] | undefined {
  if (family === "jetbrainsMono") return JetBrainsMono_400Regular;
  if (family === "googleSansCode") return googleSansCodeRegular;
  return undefined;
}

type ThemedChartProps = {
  data: ReturnType<typeof useSimulatedChartData>["data"];
  value: ReturnType<typeof useSimulatedChartData>["value"];
  accent: string;
  theme: "dark" | "light";
  gradientMode: GradientMode;
  lineWide: boolean;
  lineColor: boolean;
  fontSize: number;
  fontWeight: FontWeight;
  skiaFontFamily: SkiaFontFamilyDemo;
  gridDashed: boolean;
  metrics: LiveChartMetricsOverride | undefined;
  paletteOverride: boolean;
  roundedStyle: boolean;
};

function ThemedChart(props: ThemedChartProps) {
  return (
    <LiveChart
      data={props.data}
      value={props.value}
      accentColor={props.accent}
      theme={props.theme}
      gradient={resolveGradient(props.gradientMode)}
      line={
        props.lineWide || props.lineColor
          ? {
              width: props.lineWide ? 4 : 2,
              color: props.lineColor ? "#f472b6" : undefined,
            }
          : undefined
      }
      font={{
        fontFamily: MONO_FONT_FAMILY,
        fontSize: props.fontSize,
        fontWeight: props.fontWeight,
        ...(resolveTypeface(props.skiaFontFamily)
          ? { typeface: resolveTypeface(props.skiaFontFamily) }
          : {}),
      }}
      gridStyle={
        props.gridDashed ? { intervals: [1, 3], opacity: 0.8 } : undefined
      }
      metrics={props.metrics}
      palette={
        props.paletteOverride
          ? { gridLine: "rgba(96,165,250,0.35)", gridLabel: "#60a5fa" }
          : undefined
      }
      style={
        props.roundedStyle
          ? { borderRadius: 16, overflow: "hidden", margin: 4 }
          : undefined
      }
      scrub={false}
    />
  );
}

type FontControlsProps = {
  family: SkiaFontFamilyDemo;
  setFamily: Dispatch<SetStateAction<SkiaFontFamilyDemo>>;
  jetbrainsLoaded: boolean;
  googleSansLoaded: boolean;
};

function FontControls(props: FontControlsProps) {
  const options: {
    family: SkiaFontFamilyDemo;
    label: string;
    fontFamily?: string;
  }[] = [
    { family: "platformMono", label: "Platform mono" },
    {
      family: "jetbrainsMono",
      label: "JetBrains Mono",
      fontFamily: props.jetbrainsLoaded
        ? "JetBrainsMono_400Regular"
        : undefined,
    },
    {
      family: "googleSansCode",
      label: "Google Sans Code",
      fontFamily: props.googleSansLoaded ? "GoogleSansCodeRegular" : undefined,
    },
  ];
  return (
    <>
      <Text style={demoStyles.sectionLabel}>Font (Skia)</Text>
      <View style={demoStyles.buttonRow}>
        {options.map((option) => (
          <Pressable
            key={option.family}
            style={[
              demoStyles.chip,
              props.family === option.family && demoStyles.chipActive,
            ]}
            onPress={() => props.setFamily(option.family)}
          >
            <Text
              style={[
                demoStyles.chipText,
                props.family === option.family && demoStyles.chipTextActive,
                option.fontFamily
                  ? { fontFamily: option.fontFamily }
                  : undefined,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

export default function ThemingScreen() {
  const [jetbrainsLoaded] = useJetBrainsFonts({
    JetBrainsMono_400Regular,
  });
  const [googleSansLoaded] = useFonts({
    GoogleSansCodeRegular: googleSansCodeRegular,
  });

  const [theme, setTheme] = useState<"dark" | "light">(APP_THEME);
  const [accent, setAccent] = useState(ACCENT_PRESETS[0]);
  const [gradientMode, setGradientMode] = useState<GradientMode>("on");
  const [lineWide, setLineWide] = useState(false);
  const [lineColor, setLineColor] = useState(false);
  const [fontSize, setFontSize] = useState(11);
  const [fontWeight, setFontWeight] = useState<FontWeight>("normal");
  const [skiaFontFamily, setSkiaFontFamily] =
    useState<SkiaFontFamilyDemo>("platformMono");
  const [roundedStyle, setRoundedStyle] = useState(false);
  const [gridDashed, setGridDashed] = useState(false);
  const [paletteOverride, setPaletteOverride] = useState(false);
  const [roomyBadge, setRoomyBadge] = useState(false);
  const [fastMotion, setFastMotion] = useState(false);

  // Merge the two metric toggles into a single override (or undefined when both
  // are off, so the chart keeps its built-in defaults).
  const metrics = resolveMetrics(roomyBadge, fastMotion);

  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    // Dense seed so the styled line is fully drawn on first frame (the default
    // sparse "1d" seed renders flat in a 30s window until live ticks arrive).
    historySpanSeconds: 40,
    historyRange: "1m",
  });

  return (
    <DemoScreen
      title="Theming"
      docs="guides/theming"
      description="Theming: theme, accent, gradient, line, font (Skia: system / JetBrains / Google Sans Code), grid & palette, container style"
      chart={
        <ThemedChart
          data={data}
          value={value}
          accent={accent}
          theme={theme}
          gradientMode={gradientMode}
          lineWide={lineWide}
          lineColor={lineColor}
          fontSize={fontSize}
          fontWeight={fontWeight}
          skiaFontFamily={skiaFontFamily}
          gridDashed={gridDashed}
          metrics={metrics}
          paletteOverride={paletteOverride}
          roundedStyle={roundedStyle}
        />
      }
    >
      <ChipRow
        label="Theme"
        options={THEME_OPTIONS}
        value={theme}
        onChange={setTheme}
      />

      <ChipRow
        label="Accent"
        options={ACCENT_OPTIONS}
        value={accent}
        onChange={setAccent}
      />

      <ChipRow
        label="Gradient"
        options={GRADIENT_OPTIONS}
        value={gradientMode}
        onChange={setGradientMode}
      />

      <ControlRow label="Line">
        <ToggleChip
          label="Thick stroke"
          value={lineWide}
          onChange={setLineWide}
        />
        <ToggleChip
          label="Pink color"
          value={lineColor}
          onChange={setLineColor}
        />
      </ControlRow>

      <FontControls
        family={skiaFontFamily}
        setFamily={setSkiaFontFamily}
        jetbrainsLoaded={jetbrainsLoaded}
        googleSansLoaded={googleSansLoaded}
      />
      <Text style={[demoStyles.chipText, { opacity: 0.65, marginBottom: 8 }]}>
        Bundled fonts use Skia{" "}
        <Text style={{ fontFamily: "monospace" }}>font.typeface</Text> with{" "}
        <Text style={{ fontFamily: "monospace" }}>require()</Text>. JetBrains
        comes from{" "}
        <Text style={{ fontFamily: "monospace" }}>
          @expo-google-fonts/jetbrains-mono
        </Text>
        ; Google Sans Code is{" "}
        <Text style={{ fontFamily: "monospace" }}>
          assets/fonts/GoogleSansCode-Regular.ttf
        </Text>{" "}
        (also registered via{" "}
        <Text style={{ fontFamily: "monospace" }}>expo-font</Text> for chip
        labels).
      </Text>
      <ChipRow
        options={FONT_SIZE_OPTIONS}
        value={fontSize}
        onChange={setFontSize}
      />
      <ChipRow
        options={WEIGHT_OPTIONS}
        value={fontWeight}
        onChange={setFontWeight}
      />

      <ControlRow label="Grid & palette">
        <ToggleChip
          label="Dotted grid"
          value={gridDashed}
          onChange={setGridDashed}
        />
        <ToggleChip
          label="Palette override"
          value={paletteOverride}
          onChange={setPaletteOverride}
        />
      </ControlRow>

      <ControlRow label="Sizing & motion (metrics)">
        {/* `metrics` overrides shape + feel (namespaced like `palette` is for
            color). "Roomy badge" widens the value-pill geometry (badge.padX +
            tailLength); "Fast motion" speeds the badge-color lerp and grid
            fade-in (motion.badgeColorSpeed + grid.fadeInSpeed). */}
        <ToggleChip
          label="Roomy badge"
          value={roomyBadge}
          onChange={setRoomyBadge}
        />
        <ToggleChip
          label="Fast motion"
          value={fastMotion}
          onChange={setFastMotion}
        />
      </ControlRow>

      <ControlRow label="Container style">
        <ToggleChip
          label="Rounded + margin"
          value={roundedStyle}
          onChange={setRoundedStyle}
        />
      </ControlRow>
    </DemoScreen>
  );
}
