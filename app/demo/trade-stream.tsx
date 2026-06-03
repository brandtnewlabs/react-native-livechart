import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LiveChart } from "react-native-livechart";

import { useSimulatedChartData } from "../../sim/useSimulatedChartData";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT, VOLATILITY_MODES } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";

export const options = { title: "Trade stream" };

export default function TradeStreamScreen() {
  const [streamOn, setStreamOn] = useState(true);
  const [vol, setVol] = useState<(typeof VOLATILITY_MODES)[number]>("normal");

  const { data, value, tradeStream } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: streamOn,
    volatilityMode: vol,
    tradesPerSecond: 5,
    tokenSymbol: "SIM",
  });

  return (
    <DemoScreen
      description="tradeStream SharedValue overlay"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme="dark"
          tradeStream={streamOn ? tradeStream : undefined}
          scrub={false}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>Stream</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, streamOn && demoStyles.chipActive]}
          onPress={() => setStreamOn(true)}
        >
          <Text
            style={[demoStyles.chipText, streamOn && demoStyles.chipTextActive]}
          >
            On
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, !streamOn && demoStyles.chipActive]}
          onPress={() => setStreamOn(false)}
        >
          <Text
            style={[
              demoStyles.chipText,
              !streamOn && demoStyles.chipTextActive,
            ]}
          >
            Off
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Volatility</Text>
      <View style={demoStyles.buttonRow}>
        {VOLATILITY_MODES.map((m) => (
          <Pressable
            key={m}
            style={[demoStyles.chip, vol === m && demoStyles.chipActive]}
            onPress={() => setVol(m)}
          >
            <Text
              style={[
                demoStyles.chipText,
                vol === m && demoStyles.chipTextActive,
              ]}
            >
              {m}
            </Text>
          </Pressable>
        ))}
      </View>
    </DemoScreen>
  );
}
