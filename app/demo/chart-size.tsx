import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { LiveChartPoint } from "react-native-livechart";
import { APP_THEME } from "../../demo-lib/theme";
import { LiveChart } from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { useSimulatedChartData } from "../../sim/useSimulatedChartData";
import { ACCENT } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";

export const options = { title: "Chart size" };

const HEIGHTS = [120, 220, 300, 420] as const;

export default function ChartSizeScreen() {
  const [h, setH] = useState<(typeof HEIGHTS)[number]>(300);
  const [narrow, setNarrow] = useState(false);
  const [flexFill, setFlexFill] = useState(false);
  const [empty, setEmpty] = useState(false);

  const emptyData = useSharedValue<LiveChartPoint[]>([]);
  const emptyValue = useSharedValue(0);

  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
  });

  const chart = (
    <LiveChart
      data={empty ? emptyData : data}
      value={empty ? emptyValue : value}
      accentColor={ACCENT}
      theme={APP_THEME}
      scrub
      style={flexFill ? { flex: 1 } : undefined}
    />
  );

  return (
    <View style={demoStyles.demoRoot}>
      <Text style={demoStyles.demoDesc}>
        Fixed heights, narrow card width, or flex fill inside a fixed outer box.
        Toggle empty to check loading/empty shell and label at small sizes.
      </Text>

      {flexFill ? (
        <View
          style={{
            height: 360,
            marginHorizontal: narrow ? 40 : 12,
            marginBottom: 8,
          }}
        >
          {chart}
        </View>
      ) : (
        <View
          style={{
            height: h,
            marginHorizontal: narrow ? 40 : 12,
            marginBottom: 8,
          }}
        >
          {chart}
        </View>
      )}

      <Text style={[demoStyles.sectionLabel, { paddingHorizontal: 16 }]}>
        Height
      </Text>
      <View style={[demoStyles.buttonRow, { paddingHorizontal: 16 }]}>
        {HEIGHTS.map((px) => (
          <Pressable
            key={px}
            style={[
              demoStyles.chip,
              !flexFill && h === px && demoStyles.chipActive,
            ]}
            onPress={() => {
              setFlexFill(false);
              setH(px);
            }}
          >
            <Text
              style={[
                demoStyles.chipText,
                !flexFill && h === px && demoStyles.chipTextActive,
              ]}
            >
              {px}px
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[demoStyles.chip, flexFill && demoStyles.chipActive]}
          onPress={() => setFlexFill(true)}
        >
          <Text
            style={[demoStyles.chipText, flexFill && demoStyles.chipTextActive]}
          >
            Flex in 360px box
          </Text>
        </Pressable>
      </View>

      <Text style={[demoStyles.sectionLabel, { paddingHorizontal: 16 }]}>
        Width
      </Text>
      <View style={[demoStyles.buttonRow, { paddingHorizontal: 16 }]}>
        <Pressable
          style={[demoStyles.chip, !narrow && demoStyles.chipActive]}
          onPress={() => setNarrow(false)}
        >
          <Text
            style={[demoStyles.chipText, !narrow && demoStyles.chipTextActive]}
          >
            Full margin (12)
          </Text>
        </Pressable>
        <Pressable
          style={[demoStyles.chip, narrow && demoStyles.chipActive]}
          onPress={() => setNarrow(true)}
        >
          <Text
            style={[demoStyles.chipText, narrow && demoStyles.chipTextActive]}
          >
            Card (40+40 inset)
          </Text>
        </Pressable>
      </View>

      <Text style={[demoStyles.sectionLabel, { paddingHorizontal: 16 }]}>
        Empty shell
      </Text>
      <View style={[demoStyles.buttonRow, { paddingHorizontal: 16 }]}>
        <Pressable
          style={[demoStyles.chip, empty && demoStyles.chipActive]}
          onPress={() => setEmpty((v) => !v)}
        >
          <Text
            style={[demoStyles.chipText, empty && demoStyles.chipTextActive]}
          >
            No data
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
