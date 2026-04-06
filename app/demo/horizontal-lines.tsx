import { Pressable, Text, View } from "react-native";

import { useState } from "react";
import { useSimulatedData } from "../../sim/useSimulatedData";
import { LiveChart } from "../../src";
import { DemoScreen } from "./_lib/DemoScreen";
import { ACCENT } from "./_lib/shared";
import { demoStyles } from "./_lib/styles";

export const options = { title: "Reference & value lines" };

export default function HorizontalLinesScreen() {
  const [refOn, setRefOn] = useState(true);
  const [refStyled, setRefStyled] = useState(false);
  const [valOn, setValOn] = useState(true);
  const [valStyled, setValStyled] = useState(false);

  const startValue = 100;
  const { data, value } = useSimulatedData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    startValue,
  });

  return (
    <DemoScreen
      description="referenceLine and valueLine (+ config objects)"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme="dark"
          referenceLine={
            refOn
              ? refStyled
                ? {
                    value: startValue * 1.05,
                    label: "+5%",
                    strokeWidth: 2,
                    intervals: [6, 4],
                    color: "#fbbf24",
                  }
                : { value: startValue * 1.05, label: "+5%" }
              : undefined
          }
          valueLine={
            valOn
              ? valStyled
                ? {
                    strokeWidth: 2,
                    intervals: [4, 6],
                    color: "#34d399",
                  }
                : true
              : false
          }
          scrub={false}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>Reference line</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, refOn && demoStyles.chipActive]}
          onPress={() => setRefOn((v) => !v)}
        >
          <Text
            style={[demoStyles.chipText, refOn && demoStyles.chipTextActive]}
          >
            {refOn ? "On" : "Off"}
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, refStyled && demoStyles.chipActive]}
          onPress={() => setRefStyled((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              refStyled && demoStyles.chipTextActive,
            ]}
          >
            Dashed + color
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Value line</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, valOn && demoStyles.chipActive]}
          onPress={() => setValOn((v) => !v)}
        >
          <Text
            style={[demoStyles.chipText, valOn && demoStyles.chipTextActive]}
          >
            {valOn ? "On" : "Off"}
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, valStyled && demoStyles.chipActive]}
          onPress={() => setValStyled((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              valStyled && demoStyles.chipTextActive,
            ]}
          >
            Styled dash
          </Text>
        </Pressable>
      </View>
    </DemoScreen>
  );
}
