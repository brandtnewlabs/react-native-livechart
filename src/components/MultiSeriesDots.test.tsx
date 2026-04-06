import { render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue } from "react-native-reanimated";
import type { MultiEngineState } from "../useLiveChartEngine";
import { MultiSeriesDots } from "./MultiSeriesDots";

describe("MultiSeriesDots", () => {
  it("renders dot slots for the engine", () => {
    function Fixture() {
      const series = useSharedValue([
        {
          id: "a",
          data: [
            { time: 1_700_000_000, value: 10 },
            { time: 1_700_000_030, value: 15 },
          ],
          value: 15,
          color: "#3b82f6",
        },
      ]);
      const displaySeriesValues = useSharedValue([15]);
      const seriesOpacities = useSharedValue([1]);
      const engine = {
        data: useSharedValue([]),
        value: useSharedValue(0),
        displayValue: useSharedValue(0),
        displayWindow: useSharedValue(30),
        timestamp: useSharedValue(0),
        series,
        displaySeriesValues,
        seriesOpacities,
        canvasWidth: useSharedValue(400),
        canvasHeight: useSharedValue(300),
        displayMin: useSharedValue(0),
        displayMax: useSharedValue(20),
      } as unknown as MultiEngineState;
      const padding = { top: 12, right: 44, bottom: 28, left: 12 };
      return (
        <MultiSeriesDots
          engine={engine}
          padding={padding}
          colors={["#3b82f6"]}
          radius={3.5}
          pulse={null}
        />
      );
    }
    render(<Fixture />);
  });

  it("centers dot Y when value range is zero", () => {
    function Fixture() {
      const series = useSharedValue([
        {
          id: "a",
          data: [{ time: 1_700_000_000, value: 10 }],
          value: 10,
          color: "#3b82f6",
        },
      ]);
      const displaySeriesValues = useSharedValue([10]);
      const seriesOpacities = useSharedValue([1]);
      const engine = {
        data: useSharedValue([]),
        value: useSharedValue(0),
        displayValue: useSharedValue(0),
        displayWindow: useSharedValue(30),
        timestamp: useSharedValue(0),
        series,
        displaySeriesValues,
        seriesOpacities,
        canvasWidth: useSharedValue(400),
        canvasHeight: useSharedValue(300),
        displayMin: useSharedValue(10),
        displayMax: useSharedValue(10),
      } as unknown as MultiEngineState;
      const padding = { top: 12, right: 44, bottom: 28, left: 12 };
      return (
        <MultiSeriesDots
          engine={engine}
          padding={padding}
          colors={["#3b82f6"]}
          radius={3.5}
          pulse={null}
        />
      );
    }
    render(<Fixture />);
  });

  it("treats missing opacity slot as zero", () => {
    function Fixture() {
      const series = useSharedValue([
        {
          id: "a",
          data: [{ time: 1_700_000_000, value: 10 }],
          value: 10,
          color: "#3b82f6",
        },
      ]);
      const displaySeriesValues = useSharedValue([10]);
      const seriesOpacities = useSharedValue([undefined as unknown as number]);
      const engine = {
        data: useSharedValue([]),
        value: useSharedValue(0),
        displayValue: useSharedValue(0),
        displayWindow: useSharedValue(30),
        timestamp: useSharedValue(0),
        series,
        displaySeriesValues,
        seriesOpacities,
        canvasWidth: useSharedValue(400),
        canvasHeight: useSharedValue(300),
        displayMin: useSharedValue(0),
        displayMax: useSharedValue(20),
      } as unknown as MultiEngineState;
      const padding = { top: 12, right: 44, bottom: 28, left: 12 };
      return (
        <MultiSeriesDots
          engine={engine}
          padding={padding}
          colors={["#3b82f6"]}
          radius={3.5}
          pulse={null}
        />
      );
    }
    render(<Fixture />);
  });
});
