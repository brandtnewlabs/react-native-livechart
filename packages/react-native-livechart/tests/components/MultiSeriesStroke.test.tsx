import { Skia } from "@shopify/react-native-skia";
import { render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue } from "react-native-reanimated";
import { MultiSeriesStroke } from "../../src/components/MultiSeriesStroke";
import type { SeriesLineStyle } from "../../src/core/multiSeriesLayout";
import type { SeriesConfig } from "../../src/types";

function StrokeFixture({ lineStyle }: { lineStyle?: SeriesLineStyle }) {
  const paths = useSharedValue([Skia.Path.Make()]);
  const opacities = useSharedValue([1]);
  const series = useSharedValue<SeriesConfig[]>([
    { id: "a", data: [], value: 1, color: "#3b82f6" },
  ]);
  return (
    <MultiSeriesStroke
      index={0}
      paths={paths}
      opacities={opacities}
      series={series}
      strokeWidth={2}
      lineStyle={lineStyle}
    />
  );
}

describe("MultiSeriesStroke", () => {
  it("renders a plain solid stroke with no lineStyle", () => {
    render(<StrokeFixture />);
  });

  it("renders a dashed stroke with a per-series width", () => {
    render(
      <StrokeFixture
        lineStyle={{
          strokeWidth: 4,
          dashed: true,
          intervals: [6, 4],
          glow: false,
        }}
      />,
    );
  });

  it("renders a glowing stroke", () => {
    render(
      <StrokeFixture
        lineStyle={{
          strokeWidth: undefined,
          dashed: false,
          intervals: [6, 4],
          glow: true,
        }}
      />,
    );
  });
});
