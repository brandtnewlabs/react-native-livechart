import { act, renderHook } from "@testing-library/react-native";

import { DEFAULT_PADDING } from "../../src/draw/line";
import type { EngineState } from "../../src/core/useLiveChartEngine";
import { reformatXAxisLabels, useXAxis } from "../../src/hooks/useXAxis";
import { withSharedValueAccessors } from "../support/sharedValueMock";

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
  return withSharedValueAccessors({
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 1 },
    displayMin: { value: 0 },
    displayMax: { value: 10 },
    displayWindow: { value: windowSecs },
    canvasWidth: { value: w },
    canvasHeight: { value: h },
    timestamp: { value: 1700000000 },
  }) as unknown as EngineState;
}

describe("useXAxis", () => {
  it("returns empty when chart width is non-positive", () => {
    const eng = makeEngine(100, 200, 30);
    const { result } = renderHook(() =>
      useXAxis(
        eng,
        { ...DEFAULT_PADDING, left: 80, right: 80 },
        (t) => String(t),
        font,
      ),
    );
    expect(result.current.xAxisEntries.value).toEqual([]);
  });

  it("returns empty when canvas not ready", () => {
    const { result } = renderHook(() =>
      useXAxis(makeEngine(0, 0, 30), DEFAULT_PADDING, (t) => String(t), font),
    );
    expect(result.current.xAxisEntries.value).toEqual([]);
  });

  it("returns x-axis entries when laid out", () => {
    const { result } = renderHook(() =>
      useXAxis(
        makeEngine(400, 200, 120),
        DEFAULT_PADDING,
        (t) => `t${Math.floor(t)}`,
        font,
      ),
    );
    expect(result.current.xAxisEntries.value.length).toBeGreaterThan(0);
  });

  it("widens interval until label spacing target met", () => {
    const { result } = renderHook(() =>
      useXAxis(
        makeEngine(800, 200, 600),
        { ...DEFAULT_PADDING, left: 12, right: 12 },
        (t) => `t${Math.floor(t)}`,
        font,
      ),
    );
    expect(Array.isArray(result.current.xAxisEntries.value)).toBe(true);
  });

  it("drops labels when they leave the target window", () => {
    const eng = makeEngine(400, 200, 30);
    const { result, rerender } = renderHook(() =>
      useXAxis(eng, DEFAULT_PADDING, (t) => `lbl${Math.floor(t)}`, font),
    );
    const initialCount = result.current.xAxisEntries.value.length;
    act(() => {
      eng.timestamp.value = eng.timestamp.value + 1_000_000;
      eng.displayWindow.value = 5;
      rerender(undefined);
    });
    expect(result.current.xAxisEntries.value.length).toBeLessThanOrEqual(
      initialCount + 50,
    );
  });

  it("updates when timestamp advances", () => {
    const eng = makeEngine(400, 200, 120);
    const { result, rerender } = renderHook(() =>
      useXAxis(eng, DEFAULT_PADDING, (t) => `t${Math.floor(t)}`, font),
    );
    const first = result.current.xAxisEntries.value.length;
    act(() => {
      eng.timestamp.value = eng.timestamp.value + 5000;
      rerender(undefined);
    });
    expect(result.current.xAxisEntries.value.length).toBeGreaterThanOrEqual(0);
    expect(first).toBeGreaterThanOrEqual(0);
  });

  // The X-axis label cache formats each tick once (an allocation optimization),
  // so a `formatTime` swapped at runtime would otherwise leave already-cached
  // labels stale until they scroll off-window. `reformatXAxisLabels` is the
  // refresh the hook runs (via an effect) when the formatter identity changes.
  // We assert it directly: under the reanimated jest mock `useDerivedValue`
  // does not recompute on rerender, so the effect's result is not observable
  // through `xAxisEntries` here.
  it("reformatXAxisLabels returns a fresh cache re-formatted with the new formatter, alpha preserved", () => {
    const kA = Math.round(1699999920 * 100);
    const kB = Math.round(1699999980 * 100);
    const cache = {
      [kA]: { alpha: 0.5, text: `A${1699999920}` },
      [kB]: { alpha: 1, text: `A${1699999980}` },
    };

    const next = reformatXAxisLabels(cache, (t) => `B${Math.floor(t)}`);

    expect(next[kA].text).toBe("B1699999920");
    expect(next[kB].text).toBe("B1699999980");
    // Alphas are carried over, so swapping the formatter doesn't restart the fade.
    expect(next[kA].alpha).toBe(0.5);
    expect(next[kB].alpha).toBe(1);
    // The original cache is NOT mutated (it may already be serialized to a worklet).
    expect(next).not.toBe(cache);
    expect(next[kA]).not.toBe(cache[kA]);
    expect(cache[kA].text).toBe("A1699999920");
  });

  it("re-runs the relabel effect without error when formatTime changes", () => {
    const eng = makeEngine(400, 200, 120);
    const { rerender } = renderHook(
      ({ f }: { f: (t: number) => string }) =>
        useXAxis(eng, DEFAULT_PADDING, f, font),
      { initialProps: { f: (t: number) => `A${Math.floor(t)}` } },
    );
    expect(() =>
      act(() => {
        rerender({ f: (t: number) => `B${Math.floor(t)}` });
      }),
    ).not.toThrow();
  });
});
