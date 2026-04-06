import { DEFAULT_PADDING } from "../../src/draw/line";
import type { SingleEngineState } from "../../src/core/useLiveChartEngine";
import { renderHook } from "@testing-library/react-native";
import { useChartPaths } from "../../src/hooks/useChartPaths";
import { useSharedValue } from "react-native-reanimated";

function makeEngine(
  overrides: Partial<SingleEngineState> = {},
): SingleEngineState {
  const base = {
    data: { value: [{ time: 1000, value: 1 }] },
    value: { value: 1 },
    displayValue: { value: 1 },
    displayMin: { value: 0 },
    displayMax: { value: 2 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 200 },
    canvasHeight: { value: 120 },
    timestamp: { value: 1000 },
  };
  return { ...base, ...overrides } as unknown as SingleEngineState;
}

describe("useChartPaths", () => {
  it("returns paths for chart data", () => {
    const { result } = renderHook(() =>
      useChartPaths(makeEngine(), DEFAULT_PADDING),
    );
    expect(result.current.linePath.value).toBeDefined();
    expect(result.current.fillPath.value).toBeDefined();
  });

  it("handles too few points for spline", () => {
    const { result } = renderHook(() =>
      useChartPaths(
        makeEngine({
          data: { value: [{ time: 1000, value: 1 }] },
          displayMin: { value: 0 },
          displayMax: { value: 0 },
        } as unknown as Partial<SingleEngineState>),
        DEFAULT_PADDING,
      ),
    );
    expect(result.current.linePath.value).toBeDefined();
  });

  it("blends toward squiggly when morphT < 1", () => {
    const { result } = renderHook(() => {
      const morphT = useSharedValue(0.5);
      return useChartPaths(
        makeEngine({
          data: {
            value: [
              { time: 980, value: 1 },
              { time: 990, value: 1.5 },
              { time: 1000, value: 2 },
            ],
          },
        } as unknown as Partial<SingleEngineState>),
        DEFAULT_PADDING,
        morphT,
      );
    });
    expect(result.current.linePath.value).toBeDefined();
    expect(result.current.fillPath.value).toBeDefined();
  });
});
