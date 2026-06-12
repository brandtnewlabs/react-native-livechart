import { useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import { LiveChart } from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Threshold split" };

const START = 100;

type EntryLevel = "start" | "high" | "low";
const ENTRY_LEVELS: Record<EntryLevel, number> = {
  start: START,
  high: START * 1.03,
  low: START * 0.97,
};

export default function ThresholdScreen() {
  const [fill, setFill] = useState(true);
  const [markerLine, setMarkerLine] = useState(true);
  const [label, setLabel] = useState(true);
  const [showValue, setShowValue] = useState(true);
  const [labelSide, setLabelSide] = useState<"left" | "right">("left");
  const [colorMode, setColorMode] = useState<"default" | "custom">("default");
  const [entry, setEntry] = useState<EntryLevel>("start");

  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    startValue: START,
    // Dense seed so the line weaves above/below the break-even from frame one.
    historySpanSeconds: 40,
    historyRange: "1m",
  });

  // The split value is ALWAYS a SharedValue — here a fixed break-even / entry
  // price. Updating it with `.set()` moves the split live on the UI thread with
  // no re-render; a real app would point this at average cost, VWAP, or the
  // previous close.
  const breakEven = useSharedValue(START);

  const setEntryLevel = (next: EntryLevel) => {
    setEntry(next);
    breakEven.set(ENTRY_LEVELS[next]);
  };

  const customColors =
    colorMode === "custom"
      ? { aboveColor: "#14b8a6", belowColor: "#f97316" }
      : {};

  return (
    <DemoScreen
      title="Threshold split"
      docs="api-reference/livechart"
      description="threshold — green above / red below a live break-even, with a P/L fill band + marker line"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          gradient={false}
          threshold={{
            value: breakEven,
            ...customColors,
            fill,
            // `true` → dashed line only (no text/badge); object → labelled badge.
            line: markerLine
              ? label
                ? { label: "Break-even", showValue, labelPosition: labelSide }
                : true
              : false,
          }}
          scrub={false}
        />
      }
    >
      <ControlRow label="Threshold">
        <ToggleChip label="Fill band" value={fill} onChange={setFill} />
        <ToggleChip
          label="Marker line"
          value={markerLine}
          onChange={setMarkerLine}
        />
        <ToggleChip label="Label" value={label} onChange={setLabel} />
        <ToggleChip
          label="Show value"
          value={showValue}
          onChange={setShowValue}
        />
      </ControlRow>

      <ChipRow
        label="Label side"
        options={[
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ]}
        value={labelSide}
        onChange={setLabelSide}
      />

      <ChipRow
        label="Colors"
        options={[
          { value: "default", label: "Green / Red" },
          { value: "custom", label: "Teal / Orange" },
        ]}
        value={colorMode}
        onChange={setColorMode}
      />

      <ChipRow
        label="Break-even level"
        options={[
          { value: "start", label: "At start" },
          { value: "high", label: "+3%" },
          { value: "low", label: "−3%" },
        ]}
        value={entry}
        onChange={setEntryLevel}
      />
    </DemoScreen>
  );
}
