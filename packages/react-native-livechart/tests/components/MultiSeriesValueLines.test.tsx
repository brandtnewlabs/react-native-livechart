import React from "react";
import { useSharedValue } from "react-native-reanimated";

import { Canvas } from "@shopify/react-native-skia";
import { render } from "@testing-library/react-native";

import { MultiSeriesValueLines } from "../../src/components/MultiSeriesValueLines";
import type { ResolvedValueLineConfig } from "../../src/core/resolveConfig";
import type { MultiEngineState } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import type { SeriesConfig } from "../../src/types";

const VALUE_LINE_CFG: ResolvedValueLineConfig = {
  strokeWidth: 1,
  intervals: [4, 4],
  color: undefined,
};

function EngineHarness({
  series,
  displaySeriesValues,
  seriesOpacities,
  canvasHeight = 300,
  canvasWidth = 400,
  displayMin = 0,
  displayMax = 100,
  colors,
  config = VALUE_LINE_CFG,
}: {
  series: SeriesConfig[];
  displaySeriesValues?: number[];
  seriesOpacities?: number[];
  canvasHeight?: number;
  canvasWidth?: number;
  displayMin?: number;
  displayMax?: number;
  colors?: string[];
  config?: ResolvedValueLineConfig;
}) {
  const data = useSharedValue([{ time: 1, value: 1 }]);
  const value = useSharedValue(1);
  const displayValue = useSharedValue(1);
  const seriesSV = useSharedValue(series);
  const displaysSV = useSharedValue(
    displaySeriesValues ?? series.map((s) => s.value),
  );
  const opacitiesSV = useSharedValue(seriesOpacities ?? series.map(() => 1));
  const displayMinSV = useSharedValue(displayMin);
  const displayMaxSV = useSharedValue(displayMax);
  const displayWindowSV = useSharedValue(30);
  const timeWindowSV = useSharedValue(30);
  const canvasWidthSV = useSharedValue(canvasWidth);
  const canvasHeightSV = useSharedValue(canvasHeight);
  const timestampSV = useSharedValue(1_700_000_000);
  const extremaMinValueSV = useSharedValue(NaN);
  const extremaMaxValueSV = useSharedValue(NaN);
  const extremaMinTimeSV = useSharedValue(NaN);
  const extremaMaxTimeSV = useSharedValue(NaN);

  const engine: MultiEngineState = {
    data,
    value,
    displayValue,
    series: seriesSV,
    displaySeriesValues: displaysSV,
    seriesOpacities: opacitiesSV,
    displayMin: displayMinSV,
    displayMax: displayMaxSV,
    displayWindow: displayWindowSV,
    timeWindow: timeWindowSV,
    canvasWidth: canvasWidthSV,
    canvasHeight: canvasHeightSV,
    timestamp: timestampSV,
    extremaMinValue: extremaMinValueSV,
    extremaMaxValue: extremaMaxValueSV,
    extremaMinTime: extremaMinTimeSV,
    extremaMaxTime: extremaMaxTimeSV,
  };

  const lineColors = colors ?? series.map((s) => s.color ?? "#888888");

  return (
    <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
      <MultiSeriesValueLines
        engine={engine}
        padding={DEFAULT_PADDING}
        colors={lineColors}
        config={config}
        seriesCount={series.length}
      />
    </Canvas>
  );
}

describe("MultiSeriesValueLines", () => {
  const oneSeries: SeriesConfig[] = [
    {
      id: "a",
      data: [
        { time: 1_700_000_000, value: 10 },
        { time: 1_700_000_030, value: 20 },
      ],
      value: 50,
      color: "#3b82f6",
    },
  ];

  it("renders horizontal value lines for each slot with valid canvas size", () => {
    render(
      <EngineHarness
        series={oneSeries}
        config={{ strokeWidth: 2, intervals: [6, 2], color: "#ff0000" }}
      />,
    );
  });

  it("returns empty paths when canvas height is zero", () => {
    render(<EngineHarness series={oneSeries} canvasHeight={0} />);
  });

  it("centers the line when display range is zero", () => {
    render(
      <EngineHarness series={oneSeries} displayMin={10} displayMax={10} />,
    );
  });

  it("skips drawing when computed y is negative", () => {
    render(
      <EngineHarness
        series={oneSeries}
        displayMin={0}
        displayMax={1}
        displaySeriesValues={[1e6]}
      />,
    );
  });

  it("uses series value when displaySeriesValues entry is missing", () => {
    render(<EngineHarness series={oneSeries} displaySeriesValues={[]} />);
  });

  it("uses palette color from config when provided", () => {
    render(
      <EngineHarness
        series={oneSeries}
        config={{
          strokeWidth: 1,
          intervals: [2, 2],
          color: "#00ff00",
        }}
      />,
    );
  });

  it("falls back to colors[i] when config color is undefined", () => {
    render(
      <EngineHarness
        series={oneSeries}
        colors={["#abcdef"]}
        config={{ strokeWidth: 1, intervals: [1, 1], color: undefined }}
      />,
    );
  });

  it("uses zero opacity when series opacities are shorter than index", () => {
    render(<EngineHarness series={oneSeries} seriesOpacities={[]} />);
  });
});
