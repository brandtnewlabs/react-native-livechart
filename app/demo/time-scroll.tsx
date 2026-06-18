import { useState } from "react";
import { LiveChart } from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Time scroll" };

// 5-minute window of 15s candles (20 visible), but seed ~5 windows of history so
// there's somewhere to scroll back into. `maxPoints` (tick buffer) stays well
// longer than the seed so the oldest committed candles don't re-bucket as you
// scroll into them. (Prototype — see the `timeScroll` prop.)
const WINDOW_SECS = 300;
const CANDLE_WIDTH_SECS = 15;
const HISTORY_SPAN_SECS = WINDOW_SECS * 5;

const MODE_OPTIONS: { value: "candle" | "line"; label: string }[] = [
  { value: "candle", label: "Candles" },
  { value: "line", label: "Line" },
];

export default function TimeScrollScreen() {
  const [mode, setMode] = useState<"candle" | "line">("candle");
  const [timeScroll, setTimeScroll] = useState(true);
  const [scrub, setScrub] = useState(true);

  // candleAggregation gives us both the line `data` and `candles`; the toggle
  // just switches which the chart renders. Time-scroll is mode-agnostic — it
  // pans the window regardless of line vs candle.
  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: true,
    tradeStream: false,
    candleWidth: CANDLE_WIDTH_SECS,
    historySpanSeconds: HISTORY_SPAN_SECS,
    historyRange: "1m",
    volatilityMode: "volatile",
    tradesPerSecond: 2,
    maxPoints: 10000,
  });

  const isCandle = mode === "candle";

  return (
    <DemoScreen
      title="Time scroll"
      description="Drag with TWO fingers to pan back through history — the chart stops auto-scrolling. Release (or fling) back to the live edge to resume. Works for both line and candle; one-finger scrub is unchanged."
      chart={
        <LiveChart
          data={data}
          value={value}
          mode={mode}
          candles={isCandle ? candles : undefined}
          liveCandle={isCandle ? liveCandle : undefined}
          candleWidth={CANDLE_WIDTH_SECS}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={WINDOW_SECS}
          timeScroll={timeScroll}
          scrub={scrub ? { tooltip: true } : false}
        />
      }
    >
      <ChipRow
        label="Chart type"
        options={MODE_OPTIONS}
        value={mode}
        onChange={setMode}
      />

      <ControlRow label="Two-finger pan">
        <ToggleChip
          label="timeScroll"
          value={timeScroll}
          onChange={setTimeScroll}
        />
      </ControlRow>

      <ControlRow label="One-finger scrub">
        <ToggleChip label="scrub" value={scrub} onChange={setScrub} />
      </ControlRow>
    </DemoScreen>
  );
}
