import { Pressable, Text, View } from "react-native";

import { useState } from "react";
import { formatTime, LiveChart, type ScrubPoint } from "react-native-livechart";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";

export const options = { title: "Scrub" };

export default function ScrubScreen() {
  const [scrubMode, setScrubMode] = useState<"off" | "on" | "noTooltip">("on");
  const [displayMode, setDisplayMode] = useState<"line" | "candle">("line");
  const [styledTooltip, setStyledTooltip] = useState(false);
  const [readout, setReadout] = useState("—");

  const windowSecs = 300;
  const candleWidthSecs = Math.max(5, Math.round(windowSecs / 20));

  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: displayMode === "candle",
    tradeStream: false,
    candleWidth: candleWidthSecs,
  });

  const scrub =
    scrubMode === "off"
      ? false
      : scrubMode === "noTooltip"
        ? { tooltip: false }
        : styledTooltip
          ? {
              tooltip: true,
              tooltipBackground: "#1e293b",
              tooltipColor: "#fbbf24",
              tooltipBorderColor: "#fbbf24",
              crosshairLineColor: "#fbbf24",
            }
          : true;

  return (
    <DemoScreen
      description="Scrub modes; candle mode shows ScrubPoint.candle in readout"
      chart={
        <LiveChart
          data={data}
          value={value}
          mode={displayMode}
          candles={displayMode === "candle" ? candles : undefined}
          liveCandle={displayMode === "candle" ? liveCandle : undefined}
          candleWidth={candleWidthSecs}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={windowSecs}
          scrub={scrub}
          onScrub={(point) => {
            if (point === null) {
              setReadout("— (live)");
              return;
            }
            const sp = point as ScrubPoint;
            let extra = "";
            if (sp.candle) {
              extra = ` | O:${sp.candle.open.toFixed(2)} H:${sp.candle.high.toFixed(2)} L:${sp.candle.low.toFixed(2)} C:${sp.candle.close.toFixed(2)}`;
            }
            setReadout(
              `${sp.value.toFixed(4)} @ ${formatTime(sp.time)}${extra}`,
            );
          }}
        />
      }
    >
      <Text style={demoStyles.scrubReadout} numberOfLines={3}>
        {readout}
      </Text>

      <Text style={demoStyles.sectionLabel}>Scrub</Text>
      <View style={demoStyles.buttonRow}>
        {(
          [
            ["off", "Off"],
            ["on", "On + tooltip"],
            ["noTooltip", "On, no tooltip"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[demoStyles.chip, scrubMode === k && demoStyles.chipActive]}
            onPress={() => setScrubMode(k)}
          >
            <Text
              style={[
                demoStyles.chipText,
                scrubMode === k && demoStyles.chipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[demoStyles.chip, styledTooltip && demoStyles.chipActive]}
          onPress={() => setStyledTooltip((v) => !v)}
        >
          <Text
            style={[
              demoStyles.chipText,
              styledTooltip && demoStyles.chipTextActive,
            ]}
          >
            Styled tooltip
          </Text>
        </Pressable>
      </View>

      <Text style={demoStyles.sectionLabel}>Display</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[
            demoStyles.chip,
            displayMode === "line" && demoStyles.chipActive,
          ]}
          onPress={() => setDisplayMode("line")}
        >
          <Text
            style={[
              demoStyles.chipText,
              displayMode === "line" && demoStyles.chipTextActive,
            ]}
          >
            Line
          </Text>
        </Pressable>
        <Pressable
          style={[
            demoStyles.chip,
            displayMode === "candle" && demoStyles.chipActive,
          ]}
          onPress={() => setDisplayMode("candle")}
        >
          <Text
            style={[
              demoStyles.chipText,
              displayMode === "candle" && demoStyles.chipTextActive,
            ]}
          >
            Candle (OHLC in readout)
          </Text>
        </Pressable>
      </View>
    </DemoScreen>
  );
}
