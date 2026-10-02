import { render, renderHook } from "@testing-library/react-native";
import React from "react";
import {
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { LoadingOverlay } from "../../src/components/LoadingOverlay";
import type {
  ChartEngineEdge,
  ChartEngineScroll,
  EngineState,
  SingleEngineState,
} from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { useChartPaths } from "../../src/hooks/useChartPaths";
import { squiggleClockSeconds } from "../../src/math/squiggly";
import { resolveTheme } from "../../src/theme";
import { withSharedValueAccessors } from "../support/sharedValueMock";

// Record the phase each squiggle is built with; the math itself is the real module.
jest.mock("../../src/math/squiggly", () => {
  const actual = jest.requireActual("../../src/math/squiggly");
  return {
    ...actual,
    buildSquigglyPts: jest.fn(actual.buildSquigglyPts),
    squigglifyPts: jest.fn(actual.squigglifyPts),
  };
});
const squiggly = jest.requireMock("../../src/math/squiggly") as {
  buildSquigglyPts: jest.Mock;
  squigglifyPts: jest.Mock;
};

// Jest does not run Reanimated's UI scheduler: capture the squiggle clock's
// reaction and frame callback, and run them explicitly.
type MockFrameHandle = { isActive: boolean; setActive: jest.Mock<void, [boolean]> };
const mockFrameHandles: MockFrameHandle[] = [];
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const actual = jest.requireActual("react-native-reanimated");
  return {
    ...actual,
    useAnimatedReaction: jest.fn(),
    useFrameCallback: jest.fn((_callback: unknown, autostart = true) => {
      const ref = React.useRef<MockFrameHandle | null>(null);
      if (ref.current === null) {
        const handle: MockFrameHandle = { isActive: autostart, setActive: jest.fn() };
        handle.setActive.mockImplementation((active) => {
          handle.isActive = active;
        });
        ref.current = handle;
        mockFrameHandles.push(handle);
      }
      return ref.current;
    }),
  };
});
jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets"),
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
    fn(...args),
}));

// A `nowOverride` pins the engine clock; the wall clock is elsewhere entirely.
const PINNED_ENGINE_SECONDS = 1_700_000_000;
const WALL_CLOCK_MS = 1_800_000_123_000;

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;
const palette = resolveTheme("#3b82f6", "dark");

function loadingEngine(): EngineState {
  return withSharedValueAccessors({
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 1 },
    displayMin: { value: 0 },
    displayMax: { value: 10 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: PINNED_ENGINE_SECONDS },
  }) as unknown as EngineState;
}

// Read-only doubles over plain state: under Jest a mutable handed to a worklet
// can no longer be written, so the tests move `state` instead.
function readOnly<T>(read: () => T): SharedValue<T> {
  return {
    get: read,
    get value() {
      return read();
    },
  } as unknown as SharedValue<T>;
}

type Shell = {
  state: { loading: boolean; morph: number };
  morphT: SharedValue<number>;
  isLoading: SharedValue<boolean>;
  isEmpty: { value: boolean };
};

async function renderShell(
  shell: Shell,
  props: Partial<React.ComponentProps<typeof LoadingOverlay>> = {},
) {
  await render(
    <LoadingOverlay
      engine={loadingEngine()}
      padding={DEFAULT_PADDING}
      palette={palette}
      font={font}
      morphT={shell.morphT}
      isLoading={shell.isLoading}
      isEmpty={shell.isEmpty}
      emptyText="No data"
      strokeWidth={2}
      {...props}
    />,
  );
  const calls = jest.mocked(useAnimatedReaction).mock.calls;
  const [prepare, react] = calls[calls.length - 1];
  let previous: unknown = null;
  // One UI-thread pass of the reaction: its value, and the reaction when it changed.
  const settle = () => {
    const current = prepare();
    if (current !== previous) react(current, previous);
    previous = current;
    return current;
  };
  return { handle: mockFrameHandles[mockFrameHandles.length - 1], settle };
}

function loadingShell(): Shell {
  const state = { loading: true, morph: 0 };
  return {
    state,
    morphT: readOnly(() => state.morph),
    isLoading: readOnly(() => state.loading),
    isEmpty: { value: false },
  };
}

describe("loading squiggle clock", () => {
  let now: jest.SpyInstance;
  beforeEach(() => {
    mockFrameHandles.length = 0;
    jest.mocked(useAnimatedReaction).mockClear();
    squiggly.buildSquigglyPts.mockClear();
    squiggly.squigglifyPts.mockClear();
    now = jest.spyOn(Date, "now").mockReturnValue(WALL_CLOCK_MS);
  });
  afterEach(() => now.mockRestore());

  it("is wall time in seconds", () => {
    expect(squiggleClockSeconds()).toBe(WALL_CLOCK_MS / 1000);
  });

  it("phases the loading shell's squiggle on the wall clock, not the pinned engine clock", async () => {
    await renderShell(loadingShell());
    expect(squiggly.buildSquigglyPts).toHaveBeenCalled();
    for (const call of squiggly.buildSquigglyPts.mock.calls) {
      expect(call[3]).toBe(WALL_CLOCK_MS / 1000);
    }
  });

  it("phases the reveal's morph on the same wall clock", async () => {
    const engine = withSharedValueAccessors({
      data: {
        value: [
          { time: 980, value: 1 },
          { time: 990, value: 1.5 },
          { time: 1000, value: 2 },
        ],
      },
      value: { value: 1 },
      displayValue: { value: 1 },
      edgeValue: { value: 1 },
      viewEnd: { value: null },
      displayMin: { value: 0 },
      displayMax: { value: 2 },
      displayWindow: { value: 30 },
      canvasWidth: { value: 200 },
      canvasHeight: { value: 120 },
      timestamp: { value: PINNED_ENGINE_SECONDS },
    }) as unknown as SingleEngineState & ChartEngineScroll & ChartEngineEdge;
    await renderHook(() => {
      const morphT = useSharedValue(0.5);
      return useChartPaths(engine, DEFAULT_PADDING, morphT);
    });
    expect(squiggly.squigglifyPts).toHaveBeenCalled();
    for (const call of squiggly.squigglifyPts.mock.calls) {
      expect(call[1]).toBe(WALL_CLOCK_MS / 1000);
    }
  });

  it("ticks while the shell shows and stops once the reveal is over", async () => {
    const shell = loadingShell();
    const { handle, settle } = await renderShell(shell);
    expect(handle.isActive).toBe(false);

    expect(settle()).toBe(true);
    expect(handle.isActive).toBe(true);

    shell.state.loading = false;
    shell.state.morph = 0.5; // revealing
    expect(settle()).toBe(true);
    expect(handle.isActive).toBe(true);

    shell.state.morph = 1; // revealed
    expect(settle()).toBe(false);
    expect(handle.isActive).toBe(false);
  });

  it("never ticks on a static chart, while the frame-loop gate is off, or at wave speed 0", async () => {
    const cases: Partial<React.ComponentProps<typeof LoadingOverlay>>[] = [
      { isStatic: true },
      { isFrameLoopActive: readOnly(() => false) },
      { waveSpeed: 0 },
    ];
    for (const props of cases) {
      const { handle, settle } = await renderShell(loadingShell(), props);
      expect(settle()).toBe(false);
      expect(handle.setActive).not.toHaveBeenCalledWith(true);
    }
  });
});
