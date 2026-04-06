import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import type { LivelineSeries } from "./types";
import {
  applyLivelineEngineMultiFrame,
  type MultiEngineFrameRefs,
  useLivelineMultiSeriesEngine,
} from "./useLivelineMultiSeriesEngine";

describe("applyLivelineEngineMultiFrame", () => {
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
    applyLivelineEngineMultiFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as MultiEngineFrameRefs,
    );
    expect(sv.displaySeriesValues.value.length).toBe(1);
  });
});

describe("useLivelineMultiSeriesEngine", () => {
  it("returns engine state with series arrays", () => {
    const { result } = renderHook(() => {
      const series = useSharedValue<LivelineSeries[]>([
        {
          id: "a",
          data: [{ time: 1_700_000_000, value: 1 }],
          value: 1,
          color: "#3b82f6",
        },
      ]);
      return useLivelineMultiSeriesEngine({
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
