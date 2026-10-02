import { DEFAULT_PADDING } from "../../src/draw/line";
import type { EngineState } from "../../src/core/useLiveChartEngine";
import { renderHook } from "@testing-library/react-native";
import { useYAxis } from "../../src/hooks/useYAxis";
import { withSharedValueAccessors } from "../support/sharedValueMock";
import { useSharedValue } from "react-native-reanimated";

// Jest has no UI scheduler. Execute the real derived callback on each read,
// and freeze published payloads to model the JS/UI serialization boundary.
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: jest.fn(<T,>(initial: T) => {
      const state = React.useRef(Object.freeze(initial));
      return React.useMemo(
        () => ({
          get: () => state.current,
          set: (next: T) => { state.current = Object.freeze(next); },
        }),
        [],
      );
    }),
    useDerivedValue: <T,>(updater: () => T) => ({
      get value() { return updater(); },
    }),
  };
});

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
  return withSharedValueAccessors({
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 1 },
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 1000 },
  }) as unknown as EngineState;
}

describe("useYAxis", () => {
  it("returns y-axis entries derived from engine", async () => {
    const { result } = await renderHook(() =>
      useYAxis(makeEngine(), DEFAULT_PADDING, (v) => v.toFixed(0), font),
    );
    expect(result.current.yAxisEntries.value.length).toBeGreaterThanOrEqual(0);
    expect(result.current.font).toBe(font);
  });

  it("adds, fades, and removes ticks without mutating frozen caches (#343)", async () => {
    jest.mocked(useSharedValue).mockClear();
    const engine = makeEngine();
    const { result } = await renderHook(() =>
      useYAxis(engine, DEFAULT_PADDING, (v) => v.toFixed(0), font),
    );
    const cache = jest.mocked(useSharedValue).mock.results[1].value;
    const empty = cache.get();
    expect(Object.isFrozen(empty)).toBe(true);

    const firstEntries = result.current.yAxisEntries.value;
    const firstCache = cache.get();
    expect(firstEntries.length).toBeGreaterThan(0);
    expect(firstCache).not.toBe(empty);
    expect(empty).toEqual({});

    const firstSnapshot = { ...firstCache };
    const nextEntries = result.current.yAxisEntries.value;
    expect(cache.get()).not.toBe(firstCache);
    expect(firstCache).toEqual(firstSnapshot);
    // Existing labels keep fading in instead of restarting at the initial alpha.
    expect(nextEntries.find((e) => e.label === firstEntries[0].label)!.alpha)
      .toBeGreaterThan(firstEntries[0].alpha);

    engine.displayMin.set(1000);
    engine.displayMax.set(1100);
    let entries = result.current.yAxisEntries.value;
    for (let frame = 0; frame < 120; frame++) {
      entries = result.current.yAxisEntries.value;
    }
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => Number(entry.label) >= 1000)).toBe(true);
    expect(Object.keys(cache.get()).every((key) => Number(key) >= 1000)).toBe(true);
    expect(firstCache).toEqual(firstSnapshot);

    const settledCache = cache.get();
    expect(result.current.yAxisEntries.value).toEqual(entries);
    expect(cache.get()).toBe(settledCache);
  });
});
