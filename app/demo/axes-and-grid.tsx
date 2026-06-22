import { useState } from "react";
import { Text } from "react-native";
import {
  LiveChart,
  LiveChartSeries,
  type AxisLabelConfig,
  type GridStyleConfig,
  type YAxisConfig,
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
type YCountPreset = "auto" | "3" | "5" | "7";
type GridLineStyle = "default" | "dotted" | "solid" | "blue";

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

const Y_COUNT_OPTIONS: { value: YCountPreset; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "3", label: "3 prices" },
  { value: "5", label: "5 prices" },
  { value: "7", label: "7 prices" },
];

const GRID_OPTIONS: { value: GridLineStyle; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "dotted", label: "Dotted" },
  { value: "solid", label: "Solid" },
  { value: "blue", label: "Blue solid" },
];

// `gridStyle` is a GridStyleConfig: `intervals: [1, 3]` dashes the lines,
// `intervals: []` forces solid; `color` / `opacity` recolor them. `undefined`
// keeps the chart's built-in dotted default.
const GRID_STYLES: Record<GridLineStyle, GridStyleConfig | undefined> = {
  default: undefined,
  dotted: { intervals: [1, 3], opacity: 0.8 },
  solid: { intervals: [], opacity: 0.6 },
  blue: { intervals: [], color: "rgba(96,165,250,0.5)", opacity: 1 },
};

export default function AxesGridScreen() {
  const [vis, setVis] = useState<AxisVis>("both");
  const [gap, setGap] = useState<GapPreset>("default");
  const [yCount, setYCount] = useState<YCountPreset>("auto");
  const [which, setWhich] = useState<ChartKind>("single");
  const [highLow, setHighLow] = useState(false);
  const [customLabel, setCustomLabel] = useState(false);
  const [flushBottom, setFlushBottom] = useState(false);
  const [gridLine, setGridLine] = useState<GridLineStyle>("default");
  const [edgeFade, setEdgeFade] = useState(false);

  const gridStyle = GRID_STYLES[gridLine];
  // A wider-than-default fade band (default is 40px) makes the soft left erase
  // obvious. `undefined` keeps the chart's built-in fade.
  const leftEdgeFade = edgeFade ? { width: 64 } : undefined;

  const yOn = vis !== "noY" && vis !== "none";
  const xOn = vis !== "noX" && vis !== "none";

  // `count` shows a fixed number of evenly-spaced prices (high→low) instead of
  // the dynamic nice-interval grid; `minGap` still acts as a floor on spacing.
  const yCountVal = yCount === "auto" ? 0 : Number(yCount);
  const yAxisCfg: YAxisConfig = {};
  if (gap === "wide") yAxisCfg.minGap = 72;
  if (yCountVal > 0) yAxisCfg.count = yCountVal;
  const yAxis = !yOn
    ? false
    : Object.keys(yAxisCfg).length > 0
      ? yAxisCfg
      : true;
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
      docs="guides/axes-and-grid"
      description="Hide Y, X, or both; axis minGap; a fixed Y-axis price count; explicit insets (bottom 0 fills the plot to the edge). Toggle single vs multi chart, and Robinhood-style high/low edge labels (built-in or a custom render)."
      chart={
        which === "single" ? (
          <LiveChart
            data={data}
            value={value}
            accentColor={ACCENT}
            theme={APP_THEME}
            yAxis={yAxis}
            xAxis={xAxis}
            gridStyle={gridStyle}
            leftEdgeFade={leftEdgeFade}
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
            gridStyle={gridStyle}
            leftEdgeFade={leftEdgeFade}
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
      <ChipRow
        label="Fixed Y price count"
        options={Y_COUNT_OPTIONS}
        value={yCount}
        onChange={setYCount}
      />
      <ChipRow
        label="Grid lines (gridStyle)"
        options={GRID_OPTIONS}
        value={gridLine}
        onChange={setGridLine}
      />
      <ControlRow label="Left edge fade">
        {/* `leftEdgeFade={{ width }}` softens the left edge so the line blends
            into the gutter. Off here = the chart's built-in default fade. */}
        <ToggleChip
          label="Wide fade band"
          value={edgeFade}
          onChange={setEdgeFade}
        />
      </ControlRow>
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
