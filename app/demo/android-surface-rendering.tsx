import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  LiveChart,
  type CanvasMode,
  type ThemeMode,
} from "react-native-livechart";
import { ChipRow, ToggleChip, ControlRow } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { colors } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Android surface rendering" };

const MODES: { value: CanvasMode; label: string }[] = [
  { value: "transparent", label: "TextureView" },
  { value: "opaque", label: "SurfaceView" },
];

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function AndroidSurfaceRenderingScreen() {
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("transparent");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [loading, setLoading] = useState(false);
  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    historySpanSeconds: 60,
    historyRange: "1m",
  });

  return (
    <DemoScreen
      title="Android surface rendering"
      docs="guides/android-surface-rendering"
      description="Compare the default transparent TextureView with the experimental opaque SurfaceView path."
      chart={
        <View style={styles.chartShell}>
          <LiveChart
            data={data}
            value={value}
            canvasMode={canvasMode}
            theme={theme}
            loading={loading}
            accessibilityLabel={`${canvasMode} ${theme} live chart`}
          />
          <View pointerEvents="none" style={styles.siblingOverlay}>
            <Text style={styles.siblingText}>RN sibling overlay</Text>
          </View>
        </View>
      }
    >
      <ChipRow
        label="Android backing view"
        options={MODES}
        value={canvasMode}
        onChange={setCanvasMode}
      />
      <ChipRow
        label="Background"
        options={THEMES}
        value={theme}
        onChange={setTheme}
      />
      <ControlRow label="States">
        <ToggleChip
          label="Loading / empty mask"
          value={loading}
          onChange={setLoading}
        />
      </ControlRow>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  chartShell: { flex: 1, overflow: "hidden", borderRadius: 16 },
  siblingOverlay: {
    position: "absolute",
    left: 12,
    top: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(236,72,153,0.9)",
  },
  siblingText: { color: colors.background, fontSize: 11, fontWeight: "700" },
});
