import { Pressable, Text, View } from "react-native";
import {
  ACCENT,
  HISTORY_RANGE_PRESETS,
  TIME_WINDOWS,
  viewportSecsForHistoryPreset,
} from "../../demo-lib/shared";

import { useState } from "react";
import type { CandlePoint } from "react-native-livechart";
import { APP_THEME } from "../../demo-lib/theme";
import { LiveChart } from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";
import {
  useSimulatedChartData,
  type HistoryRange,
} from "../../sim/useSimulatedChartData";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { demoStyles } from "../../demo-lib/styles";

export const options = { title: "Candlestick" };

export default function CandlestickScreen() {
  const [historyRange, setHistoryRange] = useState<HistoryRange>("1d");
  const [windowSecs, setWindowSecs] = useState(300);
  const [stripCandles, setStripCandles] = useState(false);
  const candleWidthSecs = Math.max(5, Math.round(windowSecs / 20));

  const emptyCandles = useSharedValue<CandlePoint[]>([]);
  const nullLive = useSharedValue<CandlePoint | null>(null);

  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: true,
    tradeStream: false,
    candleWidth: candleWidthSecs,
    historyRange,
    tradesPerSecond: 5,
  });

  return (
    <DemoScreen
      description={`mode=candle, candleWidth=${candleWidthSecs}s. Needs ≥2 committed candles for the chart (live bar alone is not enough).`}
      chart={
        <LiveChart
          data={data}
          value={value}
          mode="candle"
          candles={stripCandles ? emptyCandles : candles}
          liveCandle={stripCandles ? nullLive : liveCandle}
          candleWidth={candleWidthSecs}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={windowSecs}
          scrub={{ tooltip: true }}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>History span</Text>
      <View style={demoStyles.buttonRow}>
        {HISTORY_RANGE_PRESETS.map((r) => (
          <Pressable
            key={r.preset}
            style={[
              demoStyles.chip,
              historyRange === r.preset && demoStyles.chipActive,
            ]}
            onPress={() => {
              setHistoryRange(r.preset);
              setWindowSecs(viewportSecsForHistoryPreset(r.preset));
            }}
          >
            <Text
              style={[
                demoStyles.chipText,
                historyRange === r.preset && demoStyles.chipTextActive,
              ]}
            >
              {r.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={demoStyles.sectionLabel}>Data</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, stripCandles && demoStyles.chipActive]}
          onPress={() => setStripCandles((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              stripCandles && demoStyles.chipTextActive,
            ]}
          >
            No committed candles
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Time window</Text>
      <View style={demoStyles.buttonRow}>
        {TIME_WINDOWS.map((w) => (
          <Pressable
            key={w.label}
            style={[
              demoStyles.chip,
              windowSecs === w.secs && demoStyles.chipActive,
            ]}
            onPress={() => setWindowSecs(w.secs)}
          >
            <Text
              style={[
                demoStyles.chipText,
                windowSecs === w.secs && demoStyles.chipTextActive,
              ]}
            >
              {w.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </DemoScreen>
  );
}
