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
import { ACCENT, formatWholeValue } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

type ChartKind = "single" | "multi";
type AxisVis = "both" | "noY" | "noX" | "none";
type GapPreset = "default" | "wide";
type YCountPreset = "auto" | "3" | "5" | "7";
type GridLineStyle = "default" | "dotted" | "solid" | "blue";
type YAxisColumnPreset = "off" | "tight" | "wide";

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

const Y_AXIS_COLUMN_OPTIONS: {
  value: YAxisColumnPreset;
  label: string;
}[] = [
  { value: "off", label: "Legacy" },
  { value: "tight", label: "8 / 4 px" },
  { value: "wide", label: "24 / 12 px" },
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

function resolveYAxis(
  visible: boolean,
  gap: GapPreset,
  count: YCountPreset,
  column: YAxisColumnPreset,
): YAxisConfig | boolean {
  if (!visible) return false;

  const config: YAxisConfig = {};
  if (gap === "wide") config.minGap = 72;
  if (count !== "auto") config.count = Number(count);
  if (column !== "off") {
    config.labelRightMargin = column === "tight" ? 8 : 24;
    config.gridEndGap = column === "tight" ? 4 : 12;
  }
  return Object.keys(config).length > 0 ? config : true;
}

function axisLabel(
  custom: boolean,
  enabled: boolean,
  label: "HIGH" | "LOW",
): AxisLabelConfig | boolean | undefined {
  if (custom) {
    return {
      render: () => (
        <Text style={[demoStyles.scrubReadout, { marginBottom: 0 }]}>
          {label}
        </Text>
      ),
    };
  }
  return enabled || undefined;
}

type AxesChartProps = {
  which: ChartKind;
  data: ReturnType<typeof useSimulatedChartData>["data"];
  value: ReturnType<typeof useSimulatedChartData>["value"];
  series: ReturnType<typeof useSimulatedChartData>["series"];
  yAxis: YAxisConfig | boolean;
  xAxis: boolean | { minGap: number };
  gridStyle: GridStyleConfig | undefined;
  leftEdgeFade: { width: number } | undefined;
  insets: { bottom: number } | undefined;
  topLabel: AxisLabelConfig | boolean | undefined;
  bottomLabel: AxisLabelConfig | boolean | undefined;
};

function AxesChart({
  which,
  data,
  value,
  series,
  yAxis,
  xAxis,
  gridStyle,
  leftEdgeFade,
  insets,
  topLabel,
  bottomLabel,
}: AxesChartProps) {
  const common = {
    accentColor: ACCENT,
    theme: APP_THEME,
    yAxis,
    xAxis,
    gridStyle,
    leftEdgeFade,
    insets,
    scrub: true,
    topLabel,
    bottomLabel,
    formatValue: formatWholeValue,
  };
  return which === "single" ? (
    <LiveChart data={data} value={value} {...common} />
  ) : (
    <LiveChartSeries series={series} {...common} />
  );
}

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
  const [yAxisColumn, setYAxisColumn] = useState<YAxisColumnPreset>("wide");

  const gridStyle = GRID_STYLES[gridLine];
  // A wider-than-default fade band (default is 40px) makes the soft left erase
  // obvious. `undefined` keeps the chart's built-in fade.
  const leftEdgeFade = edgeFade ? { width: 64 } : undefined;

  const yAxis = resolveYAxis(
    vis !== "noY" && vis !== "none",
    gap,
    yCount,
    yAxisColumn,
  );
  const xAxis =
    vis === "noX" || vis === "none"
      ? false
      : gap === "wide"
        ? { minGap: 100 }
        : true;

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

  const topLabel = axisLabel(customLabel, highLow, "HIGH");
  const bottomLabel = axisLabel(customLabel, highLow, "LOW");

  return (
    <DemoScreen
      title="Axes & grid"
      docs="guides/axes-and-grid"
      description="Hide Y, X, or both; axis minGap; a fixed Y-axis price count; explicit insets (bottom 0 fills the plot to the edge). Toggle single vs multi chart, and Robinhood-style high/low edge labels (built-in or a custom render)."
      chart={
        <AxesChart
          which={which}
          data={data}
          value={value}
          series={series}
          yAxis={yAxis}
          xAxis={xAxis}
          gridStyle={gridStyle}
          leftEdgeFade={leftEdgeFade}
          insets={insets}
          topLabel={topLabel}
          bottomLabel={bottomLabel}
        />
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
        label="Y label column (right margin / grid gap)"
        options={Y_AXIS_COLUMN_OPTIONS}
        value={yAxisColumn}
        onChange={setYAxisColumn}
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
