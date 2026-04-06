import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import {
  applyLiveChartEngineFrame,
  type EngineFrameRefs,
  useLiveChartEngine,
} from "../src/core/useLiveChartEngine";

describe("applyLiveChartEngineFrame", () => {
  it("runs tick and writes shared values", () => {
    const sv = {
      data: { value: [{ time: 1700000000, value: 10 }] },
      value: { value: 10 },
      displayValue: { value: 0 },
      displayMin: { value: 0 },
      displayMax: { value: 1 },
      displayWindow: { value: 30 },
      timestamp: { value: 1700000000 },
      canvasWidth: { value: 200 },
      canvasHeight: { value: 100 },
      timeWindow: { value: 30 },
      smoothing: { value: 0.5 },
      exaggerateSV: { value: false },
      referenceValue: { value: undefined as number | undefined },
      pausedSV: { value: false },
      modeSV: { value: "line" as const },
    };
    applyLiveChartEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as EngineFrameRefs,
    );
    expect(sv.displayValue.value).not.toBe(0);
  });
});

describe("useLiveChartEngine", () => {
  it("returns shared engine state", () => {
    const { result } = renderHook(() => {
      const data = useSharedValue([{ time: 1700000000, value: 1 }]);
      const value = useSharedValue(1);
      return useLiveChartEngine({
        data,
        value,
        timeWindow: 30,
        smoothing: 0.08,
        exaggerate: true,
        referenceValue: 0.5,
      });
    });

    expect(result.current.displayValue.value).toBeDefined();
    expect(result.current.canvasWidth.value).toBe(0);
  });

  it("treats optional exaggerate and reference as undefined", () => {
    const { result } = renderHook(() => {
      const data = useSharedValue([{ time: 1700000000, value: 1 }]);
      const value = useSharedValue(1);
      return useLiveChartEngine({
        data,
        value,
        timeWindow: 30,
        smoothing: 0.08,
      });
    });
    expect(result.current.displayMin.value).toBeDefined();
  });
});
