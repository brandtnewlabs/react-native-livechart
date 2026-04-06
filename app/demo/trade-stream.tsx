import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSimulatedData, type TradeSource } from "../../sim/useSimulatedData";
import { LiveChart } from "../../src";
import { DemoScreen } from "./_lib/DemoScreen";
import { ACCENT, TRADE_SOURCES, VOLATILITY_MODES } from "./_lib/shared";
import { demoStyles } from "./_lib/styles";

export const options = { title: "Trade stream" };

export default function TradeStreamScreen() {
  const [source, setSource] = useState<TradeSource>("orderbook");
  const [streamOn, setStreamOn] = useState(true);
  const [vol, setVol] = useState<(typeof VOLATILITY_MODES)[number]>("normal");

  const { data, value, tradeStream } = useSimulatedData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: streamOn,
    tradeSource: source,
    volatilityMode: vol,
  });

  return (
    <DemoScreen
      description="tradeStream SharedValue; bonding-curve vs orderbook"
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

      <Text style={demoStyles.sectionLabel}>Trade source</Text>
      <View style={demoStyles.buttonRow}>
        {TRADE_SOURCES.map((s) => (
          <Pressable
            key={s}
            style={[demoStyles.chip, source === s && demoStyles.chipActive]}
            onPress={() => setSource(s)}
          >
            <Text
              style={[
                demoStyles.chipText,
                source === s && demoStyles.chipTextActive,
              ]}
            >
              {s}
            </Text>
          </Pressable>
        ))}
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
