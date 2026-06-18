import { DEFAULT_PADDING } from "../../src/draw/line";
import type { SingleEngineState } from "../../src/core/useLiveChartEngine";
import { renderHook } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";
import { useLiveDot } from "../../src/hooks/useLiveDot";

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

  it("tracks the edge value when followViewEdge is set", () => {
    const edgeValue = { value: 9 } as unknown as SharedValue<number>;
    const { result } = renderHook(() =>
      useLiveDot(
        engine({ displayValue: 5, displayMin: 0, displayMax: 10 }),
        DEFAULT_PADDING,
        edgeValue,
        true,
      ),
    );
    // dotY tracks edgeValue (9) — high in [0,10] → near the top, not the live
    // value (5) which would sit mid-range. chartH = 100-12-28 = 60.
    expect(result.current.dotY.value).toBeCloseTo(12 + ((10 - 9) / 10) * 60);
  });
});
