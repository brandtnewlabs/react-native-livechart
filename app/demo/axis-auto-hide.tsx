import { useState } from "react";
import { LiveChart, type AxisAutoHideConfig } from "react-native-livechart";

import { ChipRow, ToggleChip, ControlRow } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Axis auto-hide" };

type IdleOpacity = "hidden" | "dim";
type HideDelay = 1000 | 3000 | 5000;

const IDLE_OPACITY: Record<IdleOpacity, number> = {
  hidden: 0,
  dim: 0.2,
};

const IDLE_OPACITY_OPTIONS: { value: IdleOpacity; label: string }[] = [
  { value: "hidden", label: "Hidden (0%)" },
  { value: "dim", label: "Dim (20%)" },
];

const HIDE_DELAY_OPTIONS: { value: HideDelay; label: string }[] = [
  { value: 1000, label: "1 second" },
  { value: 3000, label: "3 seconds" },
  { value: 5000, label: "5 seconds" },
];

export default function AxisAutoHideScreen() {
  const [enabled, setEnabled] = useState(true);
  const [idleOpacity, setIdleOpacity] = useState<IdleOpacity>("hidden");
  const [hideAfterMs, setHideAfterMs] = useState<HideDelay>(3000);

  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    historySpanSeconds: 90,
    historyRange: "1m",
  });

  const axisAutoHide: boolean | AxisAutoHideConfig = enabled
    ? {
        fadeInMs: 60,
        fadeOutMs: 250,
        idleOpacity: IDLE_OPACITY[idleOpacity],
        hideAfterMs,
      }
    : false;

  return (
    <DemoScreen
      title="Axis auto-hide"
      docs="guides/axis-auto-hide"
      description="A minimal chart at rest: the X and Y axes return as soon as you scrub, drag through history, fling, or pinch to zoom. Release it and watch them fade back after the selected delay."
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          axisAutoHide={axisAutoHide}
          timeScroll
          zoom
          scrub
        />
      }
    >
      <ControlRow label="Auto-hide">
        <ToggleChip
          label="Enabled"
          value={enabled}
          onChange={setEnabled}
        />
      </ControlRow>
      <ChipRow
        label="Idle opacity"
        options={IDLE_OPACITY_OPTIONS}
        value={idleOpacity}
        onChange={setIdleOpacity}
      />
      <ChipRow
        label="Hide after"
        options={HIDE_DELAY_OPTIONS}
        value={hideAfterMs}
        onChange={setHideAfterMs}
      />
    </DemoScreen>
  );
}
