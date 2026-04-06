import { act, renderHook } from "@testing-library/react-native";
import type { EngineState } from "../useLivelineEngine";
import { useCanvasLayout } from "./useCanvasLayout";

function makeEngine(): EngineState {
  return {
    data: { value: [] },
    value: { value: 0 },
    displayValue: { value: 0 },
    displayMin: { value: 0 },
    displayMax: { value: 1 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 0 },
    canvasHeight: { value: 0 },
    timestamp: { value: 0 },
  } as unknown as EngineState;
}

describe("useCanvasLayout", () => {
  it("writes layout dimensions to engine and state", () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useCanvasLayout(engine));

    act(() => {
      result.current.onLayout({
        nativeEvent: { layout: { width: 320, height: 240 } },
      } as never);
    });

    expect(result.current.layoutHeight).toBe(240);
    expect(engine.canvasWidth.value).toBe(320);
    expect(engine.canvasHeight.value).toBe(240);
  });
});
