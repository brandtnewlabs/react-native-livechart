import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import type { MultiEngineState } from "../../src/core/useLiveChartEngine";
import { useMultiSeriesLinePaths } from "../../src/hooks/useMultiSeriesLinePaths";
import { withSharedValueAccessors } from "../support/sharedValueMock";

describe("useMultiSeriesLinePaths", () => {
  it("returns path array derived value", () => {
    const { result } = renderHook(() => {
      const series = useSharedValue([
        {
          id: "a",
          data: [
            { time: 1_700_000_000, value: 10 },
            { time: 1_700_000_030, value: 12 },
          ],
          value: 12,
          color: "#3b82f6",
        },
      ]);
      const displaySeriesValues = useSharedValue([12]);
      const seriesOpacities = useSharedValue([1]);
      const engine = withSharedValueAccessors({
        data: { value: [] },
        value: { value: 0 },
        displayValue: { value: 0 },
        series,
        displaySeriesValues,
        seriesOpacities,
        timestamp: { value: 1_700_000_030 },
        displayWindow: { value: 30 },
        displayMin: { value: 0 },
        displayMax: { value: 20 },
        canvasWidth: { value: 400 },
        canvasHeight: { value: 300 },
      }) as unknown as MultiEngineState;
      const padding = { top: 12, right: 44, bottom: 28, left: 12 };
      return useMultiSeriesLinePaths(engine, padding);
    });
    expect(result.current.value.length).toBeGreaterThan(0);
  });

  it("builds a straight-polyline path for a series with curve: \"linear\"", () => {
    const { result } = renderHook(() => {
      const series = useSharedValue([
        {
          id: "a",
          data: [
            { time: 1_700_000_000, value: 10 },
            { time: 1_700_000_015, value: 18 },
            { time: 1_700_000_030, value: 12 },
          ],
          value: 12,
          color: "#3b82f6",
          curve: "linear" as const,
        },
      ]);
      const displaySeriesValues = useSharedValue([12]);
      const seriesOpacities = useSharedValue([1]);
      const engine = withSharedValueAccessors({
        data: { value: [] },
        value: { value: 0 },
        displayValue: { value: 0 },
        series,
        displaySeriesValues,
        seriesOpacities,
        timestamp: { value: 1_700_000_030 },
        displayWindow: { value: 30 },
        displayMin: { value: 0 },
        displayMax: { value: 20 },
        canvasWidth: { value: 400 },
        canvasHeight: { value: 300 },
      }) as unknown as MultiEngineState;
      const padding = { top: 12, right: 44, bottom: 28, left: 12 };
      return useMultiSeriesLinePaths(engine, padding);
    });
    expect(result.current.value.length).toBeGreaterThan(0);
  });
});
