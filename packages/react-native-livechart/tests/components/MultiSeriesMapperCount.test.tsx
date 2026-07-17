import { Skia } from "@shopify/react-native-skia";
import { render } from "@testing-library/react-native";
import React from "react";

const mockUseDerivedValue = jest.fn();

jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return {
    ...actual,
    useDerivedValue: (...args: unknown[]) => {
      mockUseDerivedValue();
      return actual.useDerivedValue(...args);
    },
  };
});

import { MultiSeriesDots } from "../../src/components/MultiSeriesDots";
import { MultiSeriesStroke } from "../../src/components/MultiSeriesStroke";
import { MultiSeriesTooltipStack } from "../../src/components/MultiSeriesTooltipStack";
import { MultiSeriesValueLabels } from "../../src/components/MultiSeriesValueLabels";
import type { MultiEngineState } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { resolveTheme } from "../../src/theme";
import type { SeriesConfig } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

const font = {
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;

function shared<T>(value: T) {
  return withSharedValueAccessors({ value }) as never;
}

function makeEngine(seriesCount: number): MultiEngineState {
  const series: SeriesConfig[] = Array.from({ length: seriesCount }, (_, i) => ({
    id: `series-${i}`,
    label: `Series ${i}`,
    data: [],
    value: i + 1,
    color: "#3b82f6",
  }));
  return {
    data: shared([]),
    value: shared(0),
    displayValue: shared(0),
    series: shared(series),
    displaySeriesValues: shared(series.map((item) => item.value)),
    seriesOpacities: shared(series.map(() => 1)),
    displayMin: shared(0),
    displayMax: shared(seriesCount + 1),
    displayWindow: shared(30),
    timeWindow: shared(30),
    canvasWidth: shared(400),
    canvasHeight: shared(300),
    timestamp: shared(1_700_000_000),
    extremaMinValue: shared(NaN),
    extremaMaxValue: shared(NaN),
    extremaMinTime: shared(NaN),
    extremaMaxTime: shared(NaN),
  };
}

describe("multi-series mapper count", () => {
  it("mounts 36 default per-series mappers for three active series", () => {
    mockUseDerivedValue.mockClear();
    const seriesCount = 3;
    const engine = makeEngine(seriesCount);
    const paths = shared(Array.from({ length: seriesCount }, () => Skia.Path.Make()));

    render(
      <>
        {Array.from({ length: seriesCount }, (_, index) => (
          <MultiSeriesStroke
            key={index}
            index={index}
            paths={paths}
            opacities={engine.seriesOpacities}
            series={engine.series}
            strokeWidth={2}
          />
        ))}
        <MultiSeriesDots
          engine={engine}
          padding={DEFAULT_PADDING}
          colors={["#3b82f6", "#3b82f6", "#3b82f6"]}
          radius={3.5}
          ring={null}
          ringColor="#ffffff"
          color={undefined}
          pulse={null}
          seriesCount={seriesCount}
        />
        <MultiSeriesValueLabels
          engine={engine}
          padding={DEFAULT_PADDING}
          colors={["#3b82f6", "#3b82f6", "#3b82f6"]}
          font={font}
          dotRadius={3.5}
          seriesCount={seriesCount}
        />
      </>,
    );

    // 3 stroke + 5 dot + 4 value-label mappers per active series.
    expect(mockUseDerivedValue).toHaveBeenCalledTimes(seriesCount * 12);
  });

  it("mounts only the five fixed candle-tooltip rows", () => {
    mockUseDerivedValue.mockClear();
    render(
      <MultiSeriesTooltipStack
        tooltipLayout={shared({ stackedLines: [] })}
        font={font}
        palette={resolveTheme("#3b82f6", "dark")}
      />,
    );

    expect(mockUseDerivedValue).toHaveBeenCalledTimes(5 * 5);
  });
});
