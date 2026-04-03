import { renderHook } from "@testing-library/react-native";
import { DEFAULT_PADDING } from "../draw/line";
import type { EngineState } from "../useLivelineEngine";
import { useGrid } from "./useGrid";

const font = {
  getSize: () => 12,
  getTextWidth: (s: string) => s.length * 7,
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

describe("useGrid", () => {
  it("returns grid entries derived from engine", () => {
    const { result } = renderHook(() =>
      useGrid(makeEngine(), DEFAULT_PADDING, (v) => v.toFixed(0), font),
    );
    expect(result.current.gridEntries.value.length).toBeGreaterThanOrEqual(0);
    expect(result.current.font).toBe(font);
  });
});
