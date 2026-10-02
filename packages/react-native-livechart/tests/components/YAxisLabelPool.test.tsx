import { act, render } from "@testing-library/react-native";
import React from "react";
import { useAnimatedReaction, type SharedValue } from "react-native-reanimated";

import { YAxisOverlay } from "../../src/components/YAxisOverlay";
import { MAX_Y_LABELS } from "../../src/constants";
import type { EngineState } from "../../src/core/useLiveChartEngine";
import { computeGridEntries, type YAxisEntry } from "../../src/draw/grid";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { resolveTheme } from "../../src/theme";
import { withSharedValueAccessors } from "../support/sharedValueMock";

// Count the label slots the axis renders, and run its pool reaction explicitly:
// Jest does not run Reanimated's UI scheduler. Derived values are read through
// their latest updater, so the reaction sees the entry count as it changes.
const mockSlots = new Set<number>();
jest.mock("../../src/components/AnimatedLabel", () => ({
  AnimatedLabel: ({ index }: { index: number }) => {
    mockSlots.add(index);
    return null;
  },
}));
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useDerivedValue: <T,>(fn: () => T) => {
      const latest = React.useRef(fn);
      latest.current = fn;
      return React.useMemo(
        () => ({
          get value() {
            return latest.current();
          },
          get() {
            return latest.current();
          },
        }),
        [],
      );
    },
    useAnimatedReaction: jest.fn(),
  };
});

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;
const palette = resolveTheme("#3b82f6", "dark");

function engine(): EngineState {
  return withSharedValueAccessors({
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 1 },
    displayMin: { value: 0 },
    displayMax: { value: 10 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 900 },
    timestamp: { value: 1700000000 },
  }) as unknown as EngineState;
}

// Read-only double over plain state, so the test can change the entry count.
function entriesOf(state: { count: number }): SharedValue<YAxisEntry[]> {
  const read = () =>
    Array.from({ length: state.count }, (_, i) => ({
      y: 20 + i * 20,
      label: String(i),
      alpha: 1,
    }));
  return { get: read, get value() { return read(); } } as unknown as SharedValue<YAxisEntry[]>;
}

async function mountAxis(state: { count: number }) {
  const entries = entriesOf(state);
  const axis = () => (
    <YAxisOverlay
      entries={entries}
      engine={engine()}
      padding={DEFAULT_PADDING}
      palette={palette}
      font={font}
    />
  );
  const screen = await render(axis());
  // One UI-thread pass of the pool reaction (its latest registration; its
  // `scheduleOnRN` is a microtask in Jest), then a render to see which slots
  // exist.
  const settle = async () => {
    const calls = jest.mocked(useAnimatedReaction).mock.calls;
    const [prepare, react] = calls[calls.length - 1];
    await act(async () => {
      react(prepare(), null);
    });
    mockSlots.clear();
    await screen.rerender(axis());
  };
  return { settle };
}

beforeEach(() => {
  mockSlots.clear();
  jest.mocked(useAnimatedReaction).mockClear();
});

describe("YAxisOverlay label pool", () => {
  // The premise, with the real grid: a step is kept while its spacing stays
  // within 0.5-4x `minGap` (hysteresis), so a 0.20 step picked on a shorter range
  // survives on a ~660 pt plot at ~30 pt spacing: 22 labelled lines.
  it("a tall plot's grid labels more lines than the initial pool", () => {
    const { entries } = computeGridEntries(
      228.4, // displayMin
      232.8, // displayMax
      700, // canvasHeight
      12, // padTop
      28, // padBottom
      0.2, // prevInterval
      {}, // labelAlphas
      (v) => v.toFixed(2),
      16.67,
    );
    expect(entries.length).toBeGreaterThan(MAX_Y_LABELS);
  });

  it(`starts with ${MAX_Y_LABELS} slots and keeps them for a chart that fits`, async () => {
    const state = { count: 8 };
    const { settle } = await mountAxis(state);
    await settle();
    expect(mockSlots.size).toBe(MAX_Y_LABELS);
  });

  it("grows to every label a tall grid produces, and never shrinks", async () => {
    const state = { count: 32 };
    const { settle } = await mountAxis(state);
    expect(mockSlots.size).toBe(MAX_Y_LABELS);

    await settle();
    expect(mockSlots.size).toBe(32);
    expect(Math.max(...mockSlots)).toBe(31);

    state.count = 5;
    await settle();
    expect(mockSlots.size).toBe(32);
  });

  it("grows no further than a settled grid can need", async () => {
    // Lines still fading out after a zoom can outnumber the settled grid.
    const state = { count: 200 };
    const { settle } = await mountAxis(state);
    await settle();
    const plotHeight = 900 - DEFAULT_PADDING.top - DEFAULT_PADDING.bottom;
    expect(mockSlots.size).toBe(Math.floor(plotHeight / (36 / 2)) + 1);
  });
});
