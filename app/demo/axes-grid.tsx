import { useState } from "react";
import { LiveChart, LiveChartSeries } from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Axes & grid" };

type ChartKind = "single" | "multi";
type AxisVis = "both" | "noY" | "noX" | "none";
type GapPreset = "default" | "wide";

const CHART_OPTIONS: { value: ChartKind; label: string }[] = [
  { value: "single", label: "LiveChart" },
  { value: "multi", label: "LiveChartSeries" },
];

const VIS_OPTIONS: { value: AxisVis; label: string }[] = [
  { value: "both", label: "Both on" },
  { value: "noY", label: "Hide Y" },
  { value: "noX", label: "Hide X" },
  { value: "none", label: "Hide both" },
];

const GAP_OPTIONS: { value: GapPreset; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "wide", label: "Wide minGap" },
];

export default function AxesGridScreen() {
  const [vis, setVis] = useState<AxisVis>("both");
  const [gap, setGap] = useState<GapPreset>("default");
  const [which, setWhich] = useState<ChartKind>("single");

  const yOn = vis !== "noY" && vis !== "none";
  const xOn = vis !== "noX" && vis !== "none";

  const yAxis = !yOn ? false : gap === "wide" ? { minGap: 72 } : true;
  const xAxis = !xOn ? false : gap === "wide" ? { minGap: 100 } : true;

  const { data, value, series } = useSimulatedChartData({
    multiSeries: which === "multi",
    candleAggregation: false,
    tradeStream: false,
    // Dense seed so the single-series line fills the default 30s window on first
    // frame instead of sitting flat until live ticks arrive.
    historySpanSeconds: 40,
    historyRange: "1m",
  });

  return (
    <DemoScreen
      title="Axes & grid"
      docs="guides/theming"
      description="Hide Y, X, or both; axis minGap. Toggle single vs multi chart."
      chart={
        which === "single" ? (
          <LiveChart
            data={data}
            value={value}
            accentColor={ACCENT}
            theme={APP_THEME}
            yAxis={yAxis}
            xAxis={xAxis}
            scrub
          />
        ) : (
          <LiveChartSeries
            series={series}
            accentColor={ACCENT}
            theme={APP_THEME}
            yAxis={yAxis}
            xAxis={xAxis}
            scrub
          />
        )
      }
    >
      <ChipRow
        label="Chart"
        options={CHART_OPTIONS}
        value={which}
        onChange={setWhich}
      />
      <ChipRow
        label="Axis visibility"
        options={VIS_OPTIONS}
        value={vis}
        onChange={setVis}
      />
      <ChipRow
        label="Axis minGap (when shown)"
        options={GAP_OPTIONS}
        value={gap}
        onChange={setGap}
      />
    </DemoScreen>
  );
}
