import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import type { SeriesConfig } from "./types";
import {
  applyLiveChartSeriesEngineFrame,
  type MultiEngineFrameRefs,
  useLiveChartSeriesEngine,
} from "./useLiveChartSeriesEngine";

describe("applyLiveChartSeriesEngineFrame", () => {
  it("runs multi tick and writes shared values", () => {
    const sv = {
      series: {
        value: [
          {
            id: "a",
            data: [{ time: 1000, value: 10 }],
            value: 10,
            color: "#00f",
          },
        ],
      },
      displaySeriesValues: { value: [] as number[] },
      seriesOpacities: { value: [] as number[] },
      displayMin: { value: 0 },
      displayMax: { value: 100 },
      displayWindow: { value: 30 },
      timestamp: { value: 1000 },
      canvasWidth: { value: 200 },
      canvasHeight: { value: 100 },
      timeWindow: { value: 30 },
      smoothing: { value: 0.5 },
      exaggerateSV: { value: false },
      referenceValue: { value: undefined as number | undefined },
      pausedSV: { value: false },
    };
    applyLiveChartSeriesEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as MultiEngineFrameRefs,
    );
    expect(sv.displaySeriesValues.value.length).toBe(1);
  });
});

describe("useLiveChartSeriesEngine", () => {
  it("returns engine state with series arrays", () => {
    const { result } = renderHook(() => {
      const series = useSharedValue<SeriesConfig[]>([
        {
          id: "a",
          data: [{ time: 1_700_000_000, value: 1 }],
          value: 1,
          color: "#3b82f6",
        },
      ]);
      return useLiveChartSeriesEngine({
        series,
        timeWindow: 30,
        smoothing: 0.08,
      });
    });
    expect(result.current.displaySeriesValues).toBeDefined();
    expect(result.current.seriesOpacities).toBeDefined();
    expect(result.current.series).toBeDefined();
  });
});
