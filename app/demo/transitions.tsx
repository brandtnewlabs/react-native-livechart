import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LiveChart, LiveChartTransition } from "react-native-livechart";

import { useSimulatedChartData } from "../../sim/useSimulatedChartData";
import { DemoScreen } from "./lib/DemoScreen";
import { ACCENT } from "./lib/shared";
import { demoStyles } from "./lib/styles";

export const options = { title: "Transitions" };

const WINDOW = 300;
const CANDLE_WIDTH = 15;

type Example = "mode" | "crossfade";

export default function TransitionsScreen() {
  const [example, setExample] = useState<Example>("mode");
  const [mode, setMode] = useState<"line" | "candle">("line");
  const [accent, setAccent] = useState<"blue" | "violet">("blue");

  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: true,
    tradeStream: false,
    candleWidth: CANDLE_WIDTH,
  });

  return (
    <DemoScreen
      description="Line↔candle uses one chart's mode prop (shared y-axis morph); LiveChartTransition cross-fades two instances"
      chart={
        example === "mode" ? (
          // Built-in line↔candle morph — ONE engine, so the y-axis eases
          // smoothly between the line and candle ranges (no re-reveal).
          <LiveChart
            data={data}
            value={value}
            mode={mode}
            candles={candles}
            liveCandle={liveCandle}
            candleWidth={CANDLE_WIDTH}
            accentColor={ACCENT}
            theme="dark"
            timeWindow={WINDOW}
            accessibilityLabel={`Price ${mode} chart`}
            scrub={false}
          />
        ) : (
          // Cross-fade between two instances. keepMounted lets both settle their
          // y-range up front, so switching is a pure opacity fade. Same data +
          // scale, so the two layers line up.
          <LiveChartTransition active={accent} duration={350} keepMounted>
            <LiveChart
              key="blue"
              data={data}
              value={value}
              accentColor="#3b82f6"
              theme="dark"
              timeWindow={WINDOW}
              scrub={false}
            />
            <LiveChart
              key="violet"
              data={data}
              value={value}
              accentColor="#a855f7"
              theme="dark"
              timeWindow={WINDOW}
              scrub={false}
            />
          </LiveChartTransition>
        )
      }
    >
      <Text style={demoStyles.sectionLabel}>Example</Text>
      <View style={demoStyles.buttonRow}>
        {(
          [
            ["mode", "Line ↔ Candle (mode)"],
            ["crossfade", "Cross-fade (transition)"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[demoStyles.chip, example === k && demoStyles.chipActive]}
            onPress={() => setExample(k)}
          >
            <Text
              style={[
                demoStyles.chipText,
                example === k && demoStyles.chipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {example === "mode" ? (
        <>
          <Text style={demoStyles.sectionLabel}>Mode</Text>
          <View style={demoStyles.buttonRow}>
            {(["line", "candle"] as const).map((m) => (
              <Pressable
                key={m}
                style={[demoStyles.chip, mode === m && demoStyles.chipActive]}
                onPress={() => setMode(m)}
              >
                <Text
                  style={[
                    demoStyles.chipText,
                    mode === m && demoStyles.chipTextActive,
                  ]}
                >
                  {m}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
            One LiveChart with a toggled mode — the engine morphs line↔candle and
            the y-axis eases between the two ranges (no re-reveal).
          </Text>
        </>
      ) : (
        <>
          <Text style={demoStyles.sectionLabel}>Active layer</Text>
          <View style={demoStyles.buttonRow}>
            {(["blue", "violet"] as const).map((a) => (
              <Pressable
                key={a}
                style={[demoStyles.chip, accent === a && demoStyles.chipActive]}
                onPress={() => setAccent(a)}
              >
                <Text
                  style={[
                    demoStyles.chipText,
                    accent === a && demoStyles.chipTextActive,
                  ]}
                >
                  {a}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
            LiveChartTransition cross-fades two chart instances (here: accent
            color). keepMounted pre-settles both so there is no re-reveal.
          </Text>
        </>
      )}
    </DemoScreen>
  );
}
