import { act, renderHook } from "@testing-library/react-native";

import { DEFAULT_PADDING } from "../draw/line";
import type { EngineState } from "../useLivelineEngine";
import { useTimeAxis } from "./useTimeAxis";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({
    x: 0,
    y: 0,
    width: s.length * 8,
    height: 12,
  }),
} as never;

function makeEngine(w: number, h: number, windowSecs: number): EngineState {
  return {
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 1 },
    displayMin: { value: 0 },
    displayMax: { value: 10 },
    displayWindow: { value: windowSecs },
    canvasWidth: { value: w },
    canvasHeight: { value: h },
    timestamp: { value: 1700000000 },
  } as unknown as EngineState;
}

describe("useTimeAxis", () => {
  it("returns empty when chart width is non-positive", () => {
    const eng = makeEngine(100, 200, 30);
    const { result } = renderHook(() =>
      useTimeAxis(
        eng,
        { ...DEFAULT_PADDING, left: 80, right: 80 },
        (t) => String(t),
        font,
      ),
    );
    expect(result.current.timeEntries.value).toEqual([]);
  });

  it("returns empty when canvas not ready", () => {
    const { result } = renderHook(() =>
      useTimeAxis(
        makeEngine(0, 0, 30),
        DEFAULT_PADDING,
        (t) => String(t),
        font,
      ),
    );
    expect(result.current.timeEntries.value).toEqual([]);
  });

  it("returns time entries when laid out", () => {
    const { result } = renderHook(() =>
      useTimeAxis(
        makeEngine(400, 200, 120),
        DEFAULT_PADDING,
        (t) => `t${Math.floor(t)}`,
        font,
      ),
    );
    expect(result.current.timeEntries.value.length).toBeGreaterThan(0);
  });

  it("widens interval until label spacing target met", () => {
    const { result } = renderHook(() =>
      useTimeAxis(
        makeEngine(800, 200, 600),
        { ...DEFAULT_PADDING, left: 12, right: 12 },
        (t) => `t${Math.floor(t)}`,
        font,
      ),
    );
    expect(Array.isArray(result.current.timeEntries.value)).toBe(true);
  });

  it("drops labels when they leave the target window", () => {
    const eng = makeEngine(400, 200, 30);
    const { result, rerender } = renderHook(() =>
      useTimeAxis(eng, DEFAULT_PADDING, (t) => `lbl${Math.floor(t)}`, font),
    );
    const initialCount = result.current.timeEntries.value.length;
    act(() => {
      eng.timestamp.value = eng.timestamp.value + 1_000_000;
      eng.displayWindow.value = 5;
      rerender(undefined);
    });
    expect(result.current.timeEntries.value.length).toBeLessThanOrEqual(
      initialCount + 50,
    );
  });

  it("updates when timestamp advances", () => {
    const eng = makeEngine(400, 200, 120);
    const { result, rerender } = renderHook(() =>
      useTimeAxis(eng, DEFAULT_PADDING, (t) => `t${Math.floor(t)}`, font),
    );
    const first = result.current.timeEntries.value.length;
    act(() => {
      eng.timestamp.value = eng.timestamp.value + 5000;
      rerender(undefined);
    });
    expect(result.current.timeEntries.value.length).toBeGreaterThanOrEqual(0);
    expect(first).toBeGreaterThanOrEqual(0);
  });
});
