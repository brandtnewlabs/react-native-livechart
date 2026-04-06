import { fireEvent, render } from "@testing-library/react-native";
import { SeriesToggleChips, seriesMetaSig } from "./SeriesToggleChips";

import React from "react";
import { useSharedValue } from "react-native-reanimated";
import type { ResolvedLegendConfig } from "../resolveConfig";
import type { SeriesConfig } from "../types";

const DEFAULT_LEGEND: ResolvedLegendConfig = {
  visible: true,
  compact: false,
  position: "top",
};

function ChipsHarness({
  onToggle,
  compact,
}: {
  onToggle: (id: string, visible: boolean) => void;
  compact?: boolean;
}) {
  const series = useSharedValue<SeriesConfig[]>([
    {
      id: "a",
      label: "Alpha",
      data: [],
      value: 1,
      color: "#3b82f6",
    },
  ]);
  return (
    <SeriesToggleChips
      series={series}
      onSeriesToggle={onToggle}
      legend={{ ...DEFAULT_LEGEND, compact: compact ?? false }}
    />
  );
}

describe("seriesMetaSig", () => {
  it("encodes id, label, color, and visibility", () => {
    expect(
      seriesMetaSig([
        {
          id: "x",
          label: undefined,
          data: [],
          value: 1,
          visible: false,
        },
        {
          id: "y",
          label: "Y",
          data: [],
          value: 2,
          color: "#fff",
        },
      ]),
    ).toContain("x\x1f\x1f\x1f0");
    expect(
      seriesMetaSig([
        {
          id: "y",
          label: "Y",
          data: [],
          value: 2,
          color: "#fff",
        },
      ]),
    ).toContain("#fff\x1f1");
  });
});

describe("SeriesToggleChips", () => {
  it("renders a chip per series and toggles visibility", () => {
    const onToggle = jest.fn();
    const screen = render(<ChipsHarness onToggle={onToggle} />);
    expect(screen.getByText("Alpha")).toBeTruthy();
    fireEvent.press(screen.getByText("Alpha"));
    expect(onToggle).toHaveBeenCalledWith("a", false);
    fireEvent.press(screen.getByText("Alpha"));
    expect(onToggle).toHaveBeenCalledWith("a", true);
  });

  it("uses id as chip text when label is omitted", () => {
    function IdOnlyHarness() {
      const series = useSharedValue<SeriesConfig[]>([
        { id: "idOnly", data: [], value: 1, color: "#333" },
      ]);
      return <SeriesToggleChips series={series} legend={DEFAULT_LEGEND} />;
    }
    expect(render(<IdOnlyHarness />).getByText("idOnly")).toBeTruthy();
  });

  it("accepts compact layout", () => {
    const onToggle = jest.fn();
    render(<ChipsHarness onToggle={onToggle} compact />);
  });

  it("maps multiple series so only the toggled index updates", () => {
    const onToggle = jest.fn();
    function TwoHarness() {
      const series = useSharedValue<SeriesConfig[]>([
        {
          id: "a",
          label: "A",
          data: [],
          value: 1,
          color: "#3b82f6",
        },
        {
          id: "b",
          label: "B",
          data: [],
          value: 2,
          color: "#ef4444",
        },
      ]);
      return (
        <SeriesToggleChips
          series={series}
          onSeriesToggle={onToggle}
          legend={DEFAULT_LEGEND}
        />
      );
    }
    const screen = render(<TwoHarness />);
    fireEvent.press(screen.getByText("B"));
    expect(onToggle).toHaveBeenCalledWith("b", false);
  });

  it("uses neutral swatch when color is missing", () => {
    function NoColorHarness() {
      const series = useSharedValue<SeriesConfig[]>([
        {
          id: "plain",
          label: "Plain",
          data: [],
          value: 1,
        },
      ]);
      return <SeriesToggleChips series={series} legend={DEFAULT_LEGEND} />;
    }
    const screen = render(<NoColorHarness />);
    expect(screen.getByText("Plain")).toBeTruthy();
  });
});
