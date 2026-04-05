import { DEFAULT_PADDING } from "../draw/line";
import type { SingleEngineState } from "../useLivelineEngine";
import { renderHook } from "@testing-library/react-native";
import { useLiveDot } from "./useLiveDot";

function engine(
  partial: Partial<{
    canvasWidth: number;
    canvasHeight: number;
    displayMin: number;
    displayMax: number;
    displayValue: number;
  }>,
): SingleEngineState {
  return {
    data: { value: [] },
    value: { value: 0 },
    displayValue: { value: partial.displayValue ?? 5 },
    displayMin: { value: partial.displayMin ?? 0 },
    displayMax: { value: partial.displayMax ?? 10 },
    displayWindow: { value: 30 },
    canvasWidth: { value: partial.canvasWidth ?? 200 },
    canvasHeight: { value: partial.canvasHeight ?? 100 },
    timestamp: { value: 0 },
  } as unknown as SingleEngineState;
}

describe("useLiveDot", () => {
  it("offsets dot when width is zero", () => {
    const { result } = renderHook(() =>
      useLiveDot(engine({ canvasWidth: 0 }), DEFAULT_PADDING),
    );
    expect(result.current.dotX.value).toBe(-100);
  });

  it("centers vertically when val range is zero", () => {
    const { result } = renderHook(() =>
      useLiveDot(
        engine({
          displayMin: 5,
          displayMax: 5,
          displayValue: 5,
        }),
        DEFAULT_PADDING,
      ),
    );
    expect(result.current.dotY.value).toBeGreaterThan(0);
  });

  it("maps dot to chart coordinates", () => {
    const { result } = renderHook(() =>
      useLiveDot(engine({ displayValue: 5 }), DEFAULT_PADDING),
    );
    expect(result.current.dotX.value).toBeGreaterThan(0);
    expect(result.current.dotY.value).toBeGreaterThan(0);
  });
});
