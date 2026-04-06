import { DEFAULT_PADDING } from "../../src/draw/line";
import type { EngineState } from "../../src/core/useLiveChartEngine";
import { renderHook } from "@testing-library/react-native";
import { useYAxis } from "../../src/hooks/useYAxis";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({
    x: 0,
    y: 0,
    width: s.length * 7,
    height: 12,
  }),
} as never;

function makeEngine(): EngineState {
  return {
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 1 },
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 1000 },
  } as unknown as EngineState;
}

describe("useYAxis", () => {
  it("returns y-axis entries derived from engine", () => {
    const { result } = renderHook(() =>
      useYAxis(makeEngine(), DEFAULT_PADDING, (v) => v.toFixed(0), font),
    );
    expect(result.current.yAxisEntries.value.length).toBeGreaterThanOrEqual(0);
    expect(result.current.font).toBe(font);
  });
});
