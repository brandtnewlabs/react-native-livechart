import { renderHook } from "@testing-library/react-native";

import { DEFAULT_PADDING } from "../../src/draw/line";
import type { EngineState } from "../../src/core/useLiveChartEngine";
import { useXAxis } from "../../src/hooks/useXAxis";
import { withSharedValueAccessors } from "../support/sharedValueMock";

type LabelCache = Record<number, { alpha: number; text: string }>;

// Jest runs a derived value once, so hand the test the axis mapper to run as
// often as a display link would, and count writes to the hook's one shared
// value: its label cache.
const mockCache = { value: {} as LabelCache, writes: 0 };
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const actual = jest.requireActual("react-native-reanimated");
  return {
    ...actual,
    useSharedValue: (initial: LabelCache) => {
      const ref = React.useRef<unknown>(null);
      if (ref.current === null) {
        mockCache.value = initial;
        ref.current = {
          get: () => mockCache.value,
          set: (next: LabelCache) => {
            mockCache.writes++;
            mockCache.value = next;
          },
        };
      }
      return ref.current;
    },
    useDerivedValue: (updater: () => unknown) => ({ get: updater }),
  };
});

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 8, height: 12 }),
} as never;

function makeEngine(windowSecs: number): EngineState {
  return withSharedValueAccessors({
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 1 },
    displayMin: { value: 0 },
    displayMax: { value: 10 },
    displayWindow: { value: windowSecs },
    timeWindow: { value: windowSecs },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 200 },
    timestamp: { value: 1700000000 },
  }) as unknown as EngineState;
}

async function mountAxis(engine: EngineState) {
  const { result } = await renderHook(() =>
    useXAxis(engine, DEFAULT_PADDING, (t) => `t${Math.round(t)}`, font),
  );
  const frames = (count: number) => {
    for (let i = 0; i < count; i++) result.current.xAxisEntries.get();
  };
  return frames;
}

beforeEach(() => {
  mockCache.value = {};
  mockCache.writes = 0;
});

describe("useXAxis label cache", () => {
  // The target key set spans one interval past each edge, so its outermost keys
  // sit outside the plot at alpha 0. They used to be deleted and re-created on
  // alternate runs, so every run rewrote the cache the mapper reads, and an idle
  // chart repainted every frame.
  it("stops writing its label cache once settled, while nothing moves", async () => {
    const frames = await mountAxis(makeEngine(60));
    frames(100); // fade-ins settle
    const settledWrites = mockCache.writes;
    frames(50);
    expect(mockCache.writes).toBe(settledWrites);
    // What stays cached includes the off-plot target keys, at alpha 0 (never drawn).
    expect(Object.values(mockCache.value).some((label) => label.alpha === 0)).toBe(true);
  });

  it("still deletes labels that leave the target set", async () => {
    const engine = makeEngine(60);
    const frames = await mountAxis(engine);
    frames(100);
    const wideKeys = Object.keys(mockCache.value).map(Number);

    engine.displayWindow.value = 5; // zoom in
    engine.timeWindow.value = 5;
    frames(100);

    const now = engine.timestamp.value;
    const kept = Object.keys(mockCache.value).map(Number);
    const farOutside = wideKeys.filter((key) => key / 100 < now - 30);
    expect(kept.length).toBeGreaterThan(0);
    expect(farOutside.length).toBeGreaterThan(0);
    for (const key of farOutside) expect(kept).not.toContain(key);
  });
});
