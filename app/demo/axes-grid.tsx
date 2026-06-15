import { useState } from "react";
import { Text } from "react-native";
import {
  LiveChart,
  LiveChartSeries,
  type AxisLabelConfig,
} from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";
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
  const [highLow, setHighLow] = useState(false);
  const [customLabel, setCustomLabel] = useState(false);
  const [flushBottom, setFlushBottom] = useState(false);

  const yOn = vis !== "noY" && vis !== "none";
  const xOn = vis !== "noX" && vis !== "none";

  const yAxis = !yOn ? false : gap === "wide" ? { minGap: 72 } : true;
  const xAxis = !xOn ? false : gap === "wide" ? { minGap: 100 } : true;

  // An explicit inset overrides the auto-padding — including the live-dot pulse's
  // reserved room — so the plot fills to the edge (the pulse ring may clip there).
  // Pair with "Hide X" to see the bottom space fully reclaimed (#128).
  const insets = flushBottom ? { bottom: 0 } : undefined;

  const { data, value, series } = useSimulatedChartData({
    multiSeries: which === "multi",
    candleAggregation: false,
    tradeStream: false,
    // Dense seed so the single-series line fills the default 30s window on first
    // frame instead of sitting flat until live ticks arrive.
    historySpanSeconds: 40,
    historyRange: "1m",
  });

  // Built-in high/low labels: the chart floats its current top / bottom Y-axis
  // bound at each edge, formatted and updated on the UI thread — no hand-rolled
  // animated text needed. A `render` escape hatch demos a fully custom element.
  const customTop: AxisLabelConfig = {
    render: () => <Text style={[demoStyles.scrubReadout, { marginBottom: 0 }]}>HIGH</Text>,
  };
  const customBottom: AxisLabelConfig = {
    render: () => <Text style={[demoStyles.scrubReadout, { marginBottom: 0 }]}>LOW</Text>,
  };

  const topLabel = customLabel ? customTop : highLow ? true : undefined;
  const bottomLabel = customLabel ? customBottom : highLow ? true : undefined;

  return (
    <DemoScreen
      title="Axes & grid"
      docs="guides/theming"
      description="Hide Y, X, or both; axis minGap; explicit insets (bottom 0 fills the plot to the edge). Toggle single vs multi chart, and Robinhood-style high/low edge labels (built-in or a custom render)."
      chart={
        which === "single" ? (
          <LiveChart
            data={data}
            value={value}
            accentColor={ACCENT}
            theme={APP_THEME}
            yAxis={yAxis}
            xAxis={xAxis}
            insets={insets}
            scrub
            topLabel={topLabel}
            bottomLabel={bottomLabel}
          />
        ) : (
          <LiveChartSeries
            series={series}
            accentColor={ACCENT}
            theme={APP_THEME}
            yAxis={yAxis}
            xAxis={xAxis}
            insets={insets}
            scrub
            topLabel={topLabel}
            bottomLabel={bottomLabel}
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
      <ControlRow label="Axis labels">
        <ToggleChip
          label="Built-in high / low"
          value={highLow}
          onChange={setHighLow}
        />
        <ToggleChip
          label="Custom render"
          value={customLabel}
          onChange={setCustomLabel}
        />
      </ControlRow>
      <ControlRow label="Insets">
        <ToggleChip
          label="Bottom inset 0"
          value={flushBottom}
          onChange={setFlushBottom}
        />
      </ControlRow>
    </DemoScreen>
  );
}
