import { Text } from "react-native";

import { useState } from "react";
import { formatTime, LiveChart, type ScrubPoint } from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { demoStyles } from "../../demo-lib/styles";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Scrubbing" };

type ScrubMode = "off" | "on" | "noTooltip";

const SCRUB_OPTIONS: { value: ScrubMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "on", label: "On + tooltip" },
  { value: "noTooltip", label: "On, no tooltip" },
];

type DisplayMode = "line" | "candle";

const DISPLAY_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "candle", label: "Candle (OHLC in readout)" },
];

export default function ScrubbingScreen() {
  const [scrubMode, setScrubMode] = useState<ScrubMode>("on");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("line");
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
      docs="guides/scrubbing"
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

      <ChipRow
        label="Scrub"
        options={SCRUB_OPTIONS}
        value={scrubMode}
        onChange={setScrubMode}
      />
      <ControlRow>
        <ToggleChip
          label="Styled tooltip"
          value={styledTooltip}
          onChange={setStyledTooltip}
        />
      </ControlRow>

      <ChipRow
        label="Display"
        options={DISPLAY_OPTIONS}
        value={displayMode}
        onChange={setDisplayMode}
      />
    </DemoScreen>
  );
}
