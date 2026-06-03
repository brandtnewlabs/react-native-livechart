import { useState } from "react";
import type { ChartInsets } from "react-native-livechart";
import { LiveChart, LiveChartSeries } from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Axes & grid" };

type ChartKind = "single" | "multi";
type AxisVis = "both" | "noY" | "noX" | "none";
type InsetPreset = "default" | "tight" | "loose";
type GapPreset = "default" | "wide";

const INSETS: Record<InsetPreset, ChartInsets | undefined> = {
  default: undefined,
  tight: { top: 6, bottom: 16, left: 6, right: 6 },
  loose: { top: 20, bottom: 40, left: 20, right: 20 },
};

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

const INSET_OPTIONS: { value: InsetPreset; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "tight", label: "Tight" },
  { value: "loose", label: "Loose" },
];

export default function AxesGridScreen() {
  const [vis, setVis] = useState<AxisVis>("both");
  const [insets, setInsets] = useState<InsetPreset>("default");
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
  });

  const insetCfg = INSETS[insets];

  return (
    <DemoScreen
      docs="guides/theming"
      description="Hide Y, X, or both; minGap; insets. Toggle single vs multi chart."
      chart={
        which === "single" ? (
          <LiveChart
            data={data}
            value={value}
            accentColor={ACCENT}
            theme={APP_THEME}
            yAxis={yAxis}
            xAxis={xAxis}
            insets={insetCfg}
            scrub
          />
        ) : (
          <LiveChartSeries
            series={series}
            accentColor={ACCENT}
            theme={APP_THEME}
            yAxis={yAxis}
            xAxis={xAxis}
            insets={insetCfg}
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
      <ChipRow
        label="Insets"
        options={INSET_OPTIONS}
        value={insets}
        onChange={setInsets}
      />
    </DemoScreen>
  );
}
