import { Pressable, Text, View } from "react-native";

import {
  JetBrainsMono_400Regular,
  useFonts as useJetBrainsFonts,
} from "@expo-google-fonts/jetbrains-mono";
import { useFonts } from "expo-font";
import { useState } from "react";
import {
  LiveChart,
  MONO_FONT_FAMILY,
  type FontWeight,
} from "react-native-livechart";
import { useSimulatedData } from "../../sim/useSimulatedData";
import { DemoScreen } from "./lib/DemoScreen";
import { ACCENT_PRESETS } from "./lib/shared";
import { demoStyles } from "./lib/styles";

const googleSansCodeRegular = require("../../assets/fonts/GoogleSansCode-Regular.ttf");

export const options = { title: "Appearance" };

const FONT_SIZES = [10, 11, 13, 15] as const;
const WEIGHTS: FontWeight[] = ["normal", "600", "bold"];

/** Platform `matchFont` mono vs bundled fonts via Skia `typeface` (+ expo-font for RN labels). */
type SkiaFontFamilyDemo = "platformMono" | "jetbrainsMono" | "googleSansCode";

export default function AppearanceScreen() {
  const [jetbrainsLoaded] = useJetBrainsFonts({
    JetBrainsMono_400Regular,
  });
  const [googleSansLoaded] = useFonts({
    GoogleSansCodeRegular: googleSansCodeRegular,
  });

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState(ACCENT_PRESETS[0]);
  const [gradientOn, setGradientOn] = useState(true);
  const [gradientCfg, setGradientCfg] = useState(false);
  const [lineWide, setLineWide] = useState(false);
  const [lineColor, setLineColor] = useState(false);
  const [fontSize, setFontSize] = useState(11);
  const [fontWeight, setFontWeight] = useState<FontWeight>("normal");
  const [skiaFontFamily, setSkiaFontFamily] =
    useState<SkiaFontFamilyDemo>("platformMono");
  const [roundedStyle, setRoundedStyle] = useState(false);

  const { data, value } = useSimulatedData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
  });

  return (
    <DemoScreen
      description="theme, accent, gradient, line, font (Skia: system / JetBrains / Google Sans Code), container style"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={accent}
          theme={theme}
          gradient={
            gradientCfg ? { topOpacity: 0.5, bottomOpacity: 0.05 } : gradientOn
          }
          line={
            lineWide || lineColor
              ? {
                  width: lineWide ? 4 : 2,
                  color: lineColor ? "#f472b6" : undefined,
                }
              : undefined
          }
          font={{
            fontFamily: MONO_FONT_FAMILY,
            fontSize,
            fontWeight,
            ...(skiaFontFamily === "jetbrainsMono"
              ? { typeface: JetBrainsMono_400Regular }
              : skiaFontFamily === "googleSansCode"
                ? { typeface: googleSansCodeRegular }
                : {}),
          }}
          style={
            roundedStyle
              ? {
                  borderRadius: 16,
                  overflow: "hidden",
                  margin: 4,
                }
              : undefined
          }
          scrub={false}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>Theme</Text>
      <View style={demoStyles.buttonRow}>
        {(["dark", "light"] as const).map((t) => (
          <Pressable
            key={t}
            style={[demoStyles.chip, theme === t && demoStyles.chipActive]}
            onPress={() => setTheme(t)}
          >
            <Text
              style={[
                demoStyles.chipText,
                theme === t && demoStyles.chipTextActive,
              ]}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={demoStyles.sectionLabel}>Accent</Text>
      <View style={demoStyles.buttonRow}>
        {ACCENT_PRESETS.map((c) => (
          <Pressable
            key={c}
            style={[demoStyles.chip, accent === c && demoStyles.chipActive]}
            onPress={() => setAccent(c)}
          >
            <Text
              style={[
                demoStyles.chipText,
                accent === c && demoStyles.chipTextActive,
              ]}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={demoStyles.sectionLabel}>Gradient</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[
            demoStyles.chip,
            gradientOn && !gradientCfg && demoStyles.chipActive,
          ]}
          onPress={() => {
            setGradientOn(true);
            setGradientCfg(false);
          }}
        >
          <Text
            style={[
              demoStyles.chipText,
              gradientOn && !gradientCfg && demoStyles.chipTextActive,
            ]}
          >
            On
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, !gradientOn && demoStyles.chipActive]}
          onPress={() => {
            setGradientOn(false);
            setGradientCfg(false);
          }}
        >
          <Text
            style={[
              demoStyles.chipText,
              !gradientOn && demoStyles.chipTextActive,
            ]}
          >
            Off
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, gradientCfg && demoStyles.chipActive]}
          onPress={() => {
            setGradientOn(true);
            setGradientCfg(true);
          }}
        >
          <Text
            style={[
              demoStyles.chipText,
              gradientCfg && demoStyles.chipTextActive,
            ]}
          >
            Custom opacity
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Line</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, lineWide && demoStyles.chipActive]}
          onPress={() => setLineWide((v) => !v)}
        >
          <Text
            style={[demoStyles.chipText, lineWide && demoStyles.chipTextActive]}
          >
            Thick stroke
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, lineColor && demoStyles.chipActive]}
          onPress={() => setLineColor((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              lineColor && demoStyles.chipTextActive,
            ]}
          >
            Pink color
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Font (Skia)</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[
            demoStyles.chip,
            skiaFontFamily === "platformMono" && demoStyles.chipActive,
          ]}
          onPress={() => setSkiaFontFamily("platformMono")}
        >
          <Text
            style={[
              demoStyles.chipText,
              skiaFontFamily === "platformMono" && demoStyles.chipTextActive,
            ]}
          >
            Platform mono
          </Text>
        </Pressable>
        <Pressable
          style={[
            demoStyles.chip,
            skiaFontFamily === "jetbrainsMono" && demoStyles.chipActive,
          ]}
          onPress={() => setSkiaFontFamily("jetbrainsMono")}
        >
          <Text
            style={[
              demoStyles.chipText,
              skiaFontFamily === "jetbrainsMono" && demoStyles.chipTextActive,
              jetbrainsLoaded && { fontFamily: "JetBrainsMono_400Regular" },
            ]}
          >
            JetBrains Mono
          </Text>
        </Pressable>
        <Pressable
          style={[
            demoStyles.chip,
            skiaFontFamily === "googleSansCode" && demoStyles.chipActive,
          ]}
          onPress={() => setSkiaFontFamily("googleSansCode")}
        >
          <Text
            style={[
              demoStyles.chipText,
              skiaFontFamily === "googleSansCode" && demoStyles.chipTextActive,
              googleSansLoaded && { fontFamily: "GoogleSansCodeRegular" },
            ]}
          >
            Google Sans Code
          </Text>
        </Pressable>
      </View>
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
      <View style={demoStyles.buttonRow}>
        {FONT_SIZES.map((s) => (
          <Pressable
            key={s}
            style={[demoStyles.chip, fontSize === s && demoStyles.chipActive]}
            onPress={() => setFontSize(s)}
          >
            <Text
              style={[
                demoStyles.chipText,
                fontSize === s && demoStyles.chipTextActive,
              ]}
            >
              {s}px
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={demoStyles.buttonRow}>
        {WEIGHTS.map((w) => (
          <Pressable
            key={w}
            style={[demoStyles.chip, fontWeight === w && demoStyles.chipActive]}
            onPress={() => setFontWeight(w)}
          >
            <Text
              style={[
                demoStyles.chipText,
                fontWeight === w && demoStyles.chipTextActive,
              ]}
            >
              {w}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={demoStyles.sectionLabel}>Container style</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, roundedStyle && demoStyles.chipActive]}
          onPress={() => setRoundedStyle((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              roundedStyle && demoStyles.chipTextActive,
            ]}
          >
            Rounded + margin
          </Text>
        </Pressable>
      </View>
    </DemoScreen>
  );
}
