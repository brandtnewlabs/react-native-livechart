import { Pressable, Text, View } from "react-native";
import { ACCENT, TIME_WINDOWS } from "./_lib/shared";

import { useState } from "react";
import { useSimulatedData } from "../../sim/useSimulatedData";
import { LiveChart } from "../../src";
import { DemoScreen } from "./_lib/DemoScreen";
import { demoStyles } from "./_lib/styles";

export const options = { title: "Candlestick" };

export default function CandlestickScreen() {
  const [windowSecs, setWindowSecs] = useState(300);
  const candleWidthSecs = Math.max(5, Math.round(windowSecs / 20));

  const { data, value, candles, liveCandle } = useSimulatedData({
    multiSeries: false,
    candleAggregation: true,
    tradeStream: false,
    candleWidth: candleWidthSecs,
  });

  return (
    <DemoScreen
      description={`mode=candle, candleWidth=${candleWidthSecs}s (from window)`}
      chart={
        <LiveChart
          data={data}
          value={value}
          mode="candle"
          candles={candles}
          liveCandle={liveCandle}
          candleWidth={candleWidthSecs}
          accentColor={ACCENT}
          theme="dark"
          timeWindow={windowSecs}
          scrub={{ tooltip: true }}
        />
      }
    >
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
