import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LiveChart, type LiveChartPoint } from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { DemoScreen } from "./lib/DemoScreen";
import { ACCENT } from "./lib/shared";
import { demoStyles } from "./lib/styles";

export const options = { title: "Historical data fill" };

const SPAN = 600; // 10 minutes of history
const COUNT = 150;

function seedHistory(endTime: number): LiveChartPoint[] {
  const out: LiveChartPoint[] = [];
  let v = 100;
  for (let i = 0; i < COUNT; i++) {
    v += (Math.random() - 0.48) * 2;
    out.push({ time: endTime - SPAN + (i / (COUNT - 1)) * SPAN, value: v });
  }
  return out;
}

export default function HistoricalDataScreen() {
  const [buffer, setBuffer] = useState(0);

  // A fixed historical dataset seeded once; maxT is the latest sample.
  const [seed] = useState(() => {
    const maxT = Date.now() / 1000;
    return { points: seedHistory(maxT), maxT };
  });

  const data = useSharedValue<LiveChartPoint[]>(seed.points);
  const value = useSharedValue(seed.points[seed.points.length - 1].value);

  return (
    <DemoScreen
      description="nowOverride + windowBuffer — fill a fixed historical span edge-to-edge"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme="dark"
          timeWindow={SPAN}
          nowOverride={seed.maxT}
          windowBuffer={buffer}
          scrub={false}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>Window buffer</Text>
      <Text style={[demoStyles.chipText, { opacity: 0.6, marginBottom: 8 }]}>
        nowOverride pins the latest sample as &quot;now&quot;. buffer=0 fills the
        canvas; larger buffers pull the data left, off the right edge.
      </Text>
      <View style={demoStyles.buttonRow}>
        {[
          { label: "0 (fill)", value: 0 },
          { label: "0.1", value: 0.1 },
          { label: "0.3", value: 0.3 },
          { label: "0.5", value: 0.5 },
        ].map((b) => (
          <Pressable
            key={b.label}
            style={[demoStyles.chip, buffer === b.value && demoStyles.chipActive]}
            onPress={() => setBuffer(b.value)}
          >
            <Text
              style={[
                demoStyles.chipText,
                buffer === b.value && demoStyles.chipTextActive,
              ]}
            >
              {b.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </DemoScreen>
  );
}
