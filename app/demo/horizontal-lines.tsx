import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LiveChart, type ReferenceLine } from "react-native-livechart";
import { APP_THEME } from "../../demo-lib/theme";

import { useSimulatedChartData } from "../../sim/useSimulatedChartData";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";

export const options = { title: "Reference lines & bands" };

const START = 100;

export default function HorizontalLinesScreen() {
  const [lines, setLines] = useState(true);
  const [valueBand, setValueBand] = useState(false);
  const [timeBand, setTimeBand] = useState(false);
  const [offAxis, setOffAxis] = useState(false);
  const [valueLine, setValueLine] = useState(true);

  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    startValue: START,
  });

  // Pin the time band ONCE when it's enabled (the band lives in absolute
  // unix-seconds space, so it then scrolls smoothly leftward with the chart).
  // Re-pinning on an interval would make it jump back to the right each tick.
  // Pinned directly in the toggle handler below — it's a response to the button
  // press, not derived state, so it doesn't belong in an effect.
  const [timeWindow, setTimeWindow] = useState<{
    from: number;
    to: number;
  } | null>(null);

  const toggleTimeBand = () => {
    const next = !timeBand;
    setTimeBand(next);
    if (next) {
      const now = Date.now() / 1000;
      setTimeWindow({ from: now - 20, to: now - 8 });
    }
  };

  const referenceLines: ReferenceLine[] = [];
  if (lines) {
    referenceLines.push({ value: START * 1.05, label: "+5%", color: "#34d399" });
    referenceLines.push({
      value: START * 0.95,
      label: "-5%",
      color: "#f87171",
      strokeWidth: 2,
      intervals: [6, 4],
    });
  }
  if (valueBand) {
    referenceLines.push({
      valueFrom: START * 0.98,
      valueTo: START * 1.02,
      color: "#fbbf24",
      label: "±2% band",
      // strokeWidth adds a dashed border; fillOpacity tunes the fill alpha.
      strokeWidth: 1,
      intervals: [4, 3],
      fillOpacity: 0.18,
    });
  }
  if (timeBand && timeWindow) {
    referenceLines.push({
      from: timeWindow.from,
      to: timeWindow.to,
      color: "#60a5fa",
      label: "event",
      strokeWidth: 1,
      intervals: [4, 3],
    });
  }
  if (offAxis) {
    referenceLines.push({
      value: START * 1.5,
      offAxisBadge: true,
      offAxisBadgeLabel: "Target",
      excludeFromRange: true,
      color: "#a855f7",
      // Target panel styling: background / border / radius.
      badgeBackground: "rgba(168,85,247,0.18)",
      badgeBorderColor: "#a855f7",
      badgeRadius: 8,
    });
  }

  return (
    <DemoScreen
      description="referenceLines array — lines, value bands, time bands, off-axis badge"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          referenceLines={referenceLines}
          valueLine={valueLine}
          scrub={false}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>Reference forms</Text>
      <View style={demoStyles.buttonRow}>
        <Toggle label="Lines (±5%)" on={lines} onPress={() => setLines((v) => !v)} />
        <Toggle
          label="Value band"
          on={valueBand}
          onPress={() => setValueBand((v) => !v)}
        />
        <Toggle
          label="Time band"
          on={timeBand}
          onPress={toggleTimeBand}
        />
      </View>
      <View style={demoStyles.buttonRow}>
        <Toggle
          label="Off-axis target"
          on={offAxis}
          onPress={() => setOffAxis((v) => !v)}
        />
        <Toggle
          label="Value line"
          on={valueLine}
          onPress={() => setValueLine((v) => !v)}
        />
      </View>
    </DemoScreen>
  );
}

function Toggle({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[demoStyles.chip, on && demoStyles.chipActive]}
      onPress={onPress}
    >
      <Text style={[demoStyles.chipText, on && demoStyles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}
