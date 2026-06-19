import { useState } from "react";
import { Alert } from "react-native";
import { LiveChart, type ScrubActionPoint } from "react-native-livechart";

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

type Gesture = "holdToScrub" | "axisDrag";

const GESTURE_OPTIONS: { value: Gesture; label: string }[] = [
  { value: "holdToScrub", label: "Drag / hold" },
  { value: "axisDrag", label: "Drag axis" },
];

const GESTURE_HINT: Record<Gesture, string> = {
  holdToScrub:
    "Drag with ONE finger to pan back through history; press and hold to scrub.",
  axisDrag:
    "Drag the bottom time-axis strip with ONE finger to pan back through history.",
};

const HOLD_OPTIONS: { value: number; label: string }[] = [
  { value: 350, label: "350ms" },
  { value: 500, label: "500ms" },
  { value: 750, label: "750ms" },
];

export default function TimeScrollScreen() {
  const [mode, setMode] = useState<"candle" | "line">("candle");
  const [gesture, setGesture] = useState<Gesture>("holdToScrub");
  const [holdMs, setHoldMs] = useState(500);
  const [enabled, setEnabled] = useState(true);
  const [scrub, setScrub] = useState(true);
  const [orderTicket, setOrderTicket] = useState(true);
  const [floatAxis, setFloatAxis] = useState(true);

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
  const hint = GESTURE_HINT[gesture];

  // Default "order ticket" (scrubAction): tap to drop a price reticle, drag to
  // adjust, press the gutter badge to fire this. Here it just echoes the chosen
  // price — enough to confirm the reticle/badge coexist with time-scroll + scrub.
  const onScrubAction = (point: ScrubActionPoint) => {
    Alert.alert("Order ticket", `Price level: ${point.price.toFixed(2)}`);
  };

  return (
    <DemoScreen
      title="Time scroll"
      description={`${hint} The chart stops auto-scrolling while panned; release (or fling) back to the live edge to resume. Works for line and candle; one-finger plot scrub is unchanged.`}
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
          yAxis={{ float: floatAxis }}
          // Pill tracks the last visible price as you scroll back.
          badge={{ followViewEdge: true }}
          timeScroll={enabled ? { gesture, scrubHoldMs: holdMs } : false}
          scrub={scrub ? { tooltip: true } : false}
          scrubAction={orderTicket}
          onScrubAction={onScrubAction}
        />
      }
    >
      <ChipRow
        label="Chart type"
        options={MODE_OPTIONS}
        value={mode}
        onChange={setMode}
      />

      <ChipRow
        label="Scroll gesture (A/B)"
        options={GESTURE_OPTIONS}
        value={gesture}
        onChange={setGesture}
      />

      {gesture === "holdToScrub" ? (
        <ChipRow
          label="Hold to scrub"
          options={HOLD_OPTIONS}
          value={holdMs}
          onChange={setHoldMs}
        />
      ) : null}

      <ControlRow label="Pan to scroll">
        <ToggleChip label="timeScroll" value={enabled} onChange={setEnabled} />
      </ControlRow>

      <ControlRow label="One-finger scrub">
        <ToggleChip label="scrub" value={scrub} onChange={setScrub} />
      </ControlRow>

      <ControlRow label="Order ticket">
        <ToggleChip
          label="scrubAction"
          value={orderTicket}
          onChange={setOrderTicket}
        />
      </ControlRow>

      <ControlRow label="Full-width plot">
        <ToggleChip
          label="yAxis.float"
          value={floatAxis}
          onChange={setFloatAxis}
        />
      </ControlRow>
    </DemoScreen>
  );
}
