import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LiveChart } from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { Chip, ChipRow, ControlRow } from "../../demo-lib/ChipRow";
import {
  DrawingToolsPocOverlay,
  type DrawingPocMode,
} from "../../demo-lib/DrawingToolsPocOverlay";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import type { TrendLineDrawing } from "../../demo-lib/drawingToolsPoc";
import { ACCENT } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";
import { APP_THEME, colors } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Drawing tools POC" };

const WINDOW_SECS = 5 * 60;
const MODE_OPTIONS: readonly { value: DrawingPocMode; label: string }[] = [
  { value: "browse", label: "Browse" },
  { value: "draw", label: "Draw line" },
  { value: "edit", label: "Edit" },
];

export default function DrawingToolsPocScreen() {
  const [mode, setMode] = useState<DrawingPocMode>("edit");
  const [status, setStatus] = useState(
    "Seed line selected — drag a handle or its body",
  );
  const [lineCount, setLineCount] = useState(1);
  const [initialLines] = useState<TrendLineDrawing[]>(() => {
    const now = Date.now() / 1000;
    return [
      {
        id: "line-1",
        start: { time: now - 240, value: 99.45 },
        end: { time: now - 60, value: 100.55 },
      },
    ];
  });
  const drawings = useSharedValue(initialLines);
  const selectedIndex = useSharedValue(0);
  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    tradeStream: false,
    historySpanSeconds: WINDOW_SECS * 2,
    historyRange: "1m",
    volatilityMode: "volatile",
  });

  const handleCreated = (id: string) => {
    setLineCount(drawings.get().length);
    setStatus(`Created ${id} — edit mode is now active`);
    setMode("edit");
  };

  const clearLines = () => {
    drawings.set([]);
    selectedIndex.set(-1);
    setLineCount(0);
    setStatus("Cleared — choose Draw line and drag across the plot");
    setMode("draw");
  };

  return (
    <DemoScreen
      title="Drawing tools POC"
      description="Internal spike: finite trend lines stored as time/price anchors, rendered in Skia, and edited on the UI thread. Browse hands touches back to the chart; Draw/Edit own the plot."
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={WINDOW_SECS}
          scrub={mode === "browse"}
          onGestureStart={() => {
            if (mode === "browse") setStatus("Chart scrub started");
          }}
          onGestureEnd={() => {
            if (mode === "browse") setStatus("Chart scrub ended");
          }}
          renderOverlay={(context) => (
            <DrawingToolsPocOverlay
              context={context}
              drawings={drawings}
              selectedIndex={selectedIndex}
              mode={mode}
              onCreated={handleCreated}
              onStatus={setStatus}
            />
          )}
        />
      }
    >
      <ChipRow
        label="Interaction mode"
        options={MODE_OPTIONS}
        value={mode}
        onChange={(nextMode) => {
          setMode(nextMode);
          setStatus(
            nextMode === "browse"
              ? "Browse mode — drag the chart crosshair"
              : nextMode === "draw"
                ? "Draw mode — drag across the plot to add a line"
                : "Edit mode — drag a handle or line body",
          );
        }}
      />
      <ControlRow label="Drawing state">
        <Chip label="Clear all" active={false} onPress={clearLines} />
      </ControlRow>
      <View style={styles.statusPanel} accessibilityLabel={`Drawing status: ${status}`}>
        <Text style={styles.statusTitle}>
          {lineCount} {lineCount === 1 ? "line" : "lines"}
        </Text>
        <Text style={styles.statusBody}>{status}</Text>
      </View>
      <Text style={[demoStyles.chipText, styles.note]}>
        POC boundary: segment only; no snapping, rays, undo stack, persistence,
        or public library API.
      </Text>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  statusPanel: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.chipBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  statusTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 3,
  },
  statusBody: {
    color: colors.textMuted,
    fontSize: 12,
  },
  note: {
    opacity: 0.62,
    marginTop: 10,
    lineHeight: 18,
  },
});
