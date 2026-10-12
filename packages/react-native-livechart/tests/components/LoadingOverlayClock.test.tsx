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

// Record the phase each squiggle is built with, and each read of the clock (a
// frame that advances the squiggle reads it); the math itself is the real module.
jest.mock("../../src/math/squiggly", () => {
  const actual = jest.requireActual("../../src/math/squiggly");
  return {
    ...actual,
    buildSquigglyPts: jest.fn(actual.buildSquigglyPts),
    squigglifyPts: jest.fn(actual.squigglifyPts),
    squiggleClockSeconds: jest.fn(actual.squiggleClockSeconds),
  };
});
const squiggly = jest.requireMock("../../src/math/squiggly") as {
  buildSquigglyPts: jest.Mock;
  squigglifyPts: jest.Mock;
  squiggleClockSeconds: jest.Mock;
};

// Jest does not run Reanimated's UI scheduler: capture the squiggle clock's
// reactions and frame callback, and run them explicitly.
type MockFrame = { timeSincePreviousFrame: number | null };
type MockFrameHandle = {
  isActive: boolean;
  setActive: jest.Mock<void, [boolean]>;
  /** The latest render's frame callback. */
  callback: (frame: MockFrame) => void;
};
const mockFrameHandles: MockFrameHandle[] = [];
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const actual = jest.requireActual("react-native-reanimated");
  return {
    ...actual,
    useAnimatedReaction: jest.fn(),
    useFrameCallback: jest.fn(
      (callback: MockFrameHandle["callback"], autostart = true) => {
        const [handle] = React.useState(() => {
          const created: MockFrameHandle = {
            isActive: autostart,
            setActive: jest.fn(),
            callback,
          };
          created.setActive.mockImplementation((active) => {
            created.isActive = active;
          });
          mockFrameHandles.push(created);
          return created;
        });
        handle.callback = callback;
        return handle;
      },
    ),
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
  state: { loading: boolean; empty: boolean; morph: number };
  morphT: SharedValue<number>;
  isLoading: SharedValue<boolean>;
  isEmpty: { value: boolean };
};

async function renderShell(
  shell: Shell,
  props: Partial<React.ComponentProps<typeof LoadingOverlay>> = {},
) {
  const engine = loadingEngine();
  const element = (
    overrides: Partial<React.ComponentProps<typeof LoadingOverlay>>,
  ) => (
    <LoadingOverlay
      engine={engine}
      padding={DEFAULT_PADDING}
      palette={palette}
      font={font}
      morphT={shell.morphT}
      isLoading={shell.isLoading}
      isEmpty={shell.isEmpty}
      emptyText="No data"
      strokeWidth={2}
      {...overrides}
    />
  );
  const reactions = jest.mocked(useAnimatedReaction).mock.calls;
  const before = reactions.length;
  const screen = await render(element(props));
  // The reactions one render registers, in hook (= mapper) order; the last is the
  // ticking switch. Each keeps its previous value across re-renders, as
  // Reanimated's do, and a re-render's calls replace the worklets.
  const count = reactions.length - before;
  const previous: unknown[] = Array.from({ length: count }, () => null);
  // One UI-thread pass of the reactions: the ticking switch's value, and each
  // reaction run when its value changed.
  const settle = () => {
    let current: unknown;
    reactions.slice(-count).forEach(([prepare, react], i) => {
      current = prepare();
      if (current !== previous[i]) react(current, previous[i]);
      previous[i] = current;
    });
    return current;
  };
  const handle = mockFrameHandles[mockFrameHandles.length - 1];
  // One frame of the squiggle's frame callback, which only runs while active;
  // whether it advanced the squiggle (read the clock).
  const frame = (timeSincePreviousFrame: number | null = 16) => {
    if (!handle.isActive) return false;
    squiggly.squiggleClockSeconds.mockClear();
    handle.callback({ timeSincePreviousFrame });
    return squiggly.squiggleClockSeconds.mock.calls.length > 0;
  };
  const rerender = (
    overrides: Partial<React.ComponentProps<typeof LoadingOverlay>>,
  ) => screen.rerender(element(overrides));
  return { handle, settle, frame, rerender };
}

function loadingShell(): Shell {
  const state = { loading: true, empty: false, morph: 0 };
  return {
    state,
    morphT: readOnly(() => state.morph),
    isLoading: readOnly(() => state.loading),
    // Non-configurable, so the worklets' dev freeze (which swaps a configurable
    // property for a snapshot once a worklet captures it) keeps this getter live.
    isEmpty: Object.defineProperty({} as { value: boolean }, "value", {
      get: () => state.empty,
      enumerable: true,
    }),
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

describe("loading squiggle freezeAfterMs", () => {
  let now: jest.SpyInstance;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    mockFrameHandles.length = 0;
    jest.mocked(useAnimatedReaction).mockClear();
    now = jest.spyOn(Date, "now").mockReturnValue(WALL_CLOCK_MS);
    // A frame writes the squiggle clock, which the squiggle's derived value has
    // captured; under Jest the worklets' dev freeze warns on every such write.
    // These tests read the clock calls, not the shared value: keep the log quiet.
    const log = console.warn;
    warn = jest.spyOn(console, "warn").mockImplementation((...args) => {
      if (String(args[0]).includes("already passed to a worklet")) return;
      log(...args);
    });
  });
  afterEach(() => {
    now.mockRestore();
    warn.mockRestore();
  });

  /** Run frames of `ms` each while they advance the squiggle; how many did. */
  function framesUntilFrozen(
    frame: (ms?: number | null) => boolean,
    ms = 16,
    limit = 1_000,
  ) {
    let moved = 0;
    while (moved < limit && frame(ms)) moved++;
    return moved;
  }

  it("freezes the squiggle once the shell has animated for freezeAfterMs", async () => {
    const { handle, settle, frame } = await renderShell(loadingShell(), {
      waveFreezeAfterMs: 100,
    });
    expect(settle()).toBe(true);
    expect(handle.isActive).toBe(true);

    // 6 × 16 ms = 96 ms still animates; the 7th frame reaches 100 ms and freezes.
    expect(framesUntilFrozen(frame)).toBe(6);
    expect(settle()).toBe(false);
    expect(handle.isActive).toBe(false);
  });

  it("animates for as long as the shell shows without it", async () => {
    const { handle, settle, frame } = await renderShell(loadingShell());
    expect(settle()).toBe(true);
    // 34 s of the longest frames counted, far past the limits used here.
    expect(framesUntilFrozen(frame, 34, 1_000)).toBe(1_000);
    expect(settle()).toBe(true);
    expect(handle.isActive).toBe(true);
  });

  it("counts a frame as at most 34 ms, so time in the background doesn't use it up", async () => {
    const { settle, frame } = await renderShell(loadingShell(), {
      waveFreezeAfterMs: 100,
    });
    settle();
    expect(frame(60_000)).toBe(true); // back from a minute away: 34
    expect(frame(null)).toBe(true); // a first frame, no delta: 16.67 → 50.67
    expect(frame(34)).toBe(true); // 84.67
    expect(frame(34)).toBe(false); // 118.67: frozen
  });

  it("doesn't count frames while the frame-loop gate is off", async () => {
    const shell = loadingShell();
    const gate = { on: true };
    const { handle, settle, frame } = await renderShell(shell, {
      waveFreezeAfterMs: 100,
      isFrameLoopActive: readOnly(() => gate.on),
    });
    settle();
    expect(framesUntilFrozen(frame, 16, 3)).toBe(3); // 48 ms

    gate.on = false;
    // Frames that still run before the switch reaches the callback are skipped.
    for (let i = 0; i < 100; i++) expect(frame()).toBe(false);
    expect(settle()).toBe(false);
    expect(handle.isActive).toBe(false);

    gate.on = true;
    expect(settle()).toBe(true);
    // 48 + 3 × 16 = 96 ms; the next frame reaches 100 ms.
    expect(framesUntilFrozen(frame)).toBe(3);
  });

  it("starts over each time the shell appears, and never freezes the reveal", async () => {
    const shell = loadingShell();
    const { handle, settle, frame } = await renderShell(shell, {
      waveFreezeAfterMs: 50,
    });
    settle();
    expect(framesUntilFrozen(frame)).toBe(3); // 48 ms; the 4th frame freezes
    expect(settle()).toBe(false);

    // Data arrives: the reveal animates whatever the shell had used.
    shell.state.loading = false;
    shell.state.morph = 0.5;
    expect(settle()).toBe(true);
    expect(framesUntilFrozen(frame, 16, 100)).toBe(100);

    // The data is cleared mid-reveal (the reveal snaps back): the whole budget again.
    shell.state.loading = true;
    shell.state.morph = 0;
    expect(settle()).toBe(true);
    expect(framesUntilFrozen(frame)).toBe(3);
    expect(settle()).toBe(false);

    // Data arrives and the reveal completes.
    shell.state.loading = false;
    shell.state.morph = 0.5;
    expect(settle()).toBe(true);
    shell.state.morph = 1;
    expect(settle()).toBe(false);
    expect(handle.isActive).toBe(false);

    // Loading again over the live chart: the whole budget again.
    shell.state.loading = true;
    shell.state.morph = 0;
    expect(settle()).toBe(true);
    expect(framesUntilFrozen(frame)).toBe(3);
    expect(settle()).toBe(false);
  });

  it("shares one budget between loading and the empty state that follows it", async () => {
    const shell = loadingShell();
    const { settle, frame } = await renderShell(shell, {
      waveFreezeAfterMs: 50,
    });
    settle();
    expect(framesUntilFrozen(frame, 16, 2)).toBe(2); // 32 ms loading

    // The load ends with no data: the shell stays up, showing "No data".
    shell.state.loading = false;
    shell.state.empty = true;
    expect(settle()).toBe(true);
    expect(framesUntilFrozen(frame)).toBe(1); // 48 ms; the next frame freezes
    expect(settle()).toBe(false);
  });

  it("freezes the squiggle from the start at 0 or less", async () => {
    for (const waveFreezeAfterMs of [0, -1]) {
      const { handle, settle } = await renderShell(loadingShell(), {
        waveFreezeAfterMs,
      });
      expect(settle()).toBe(false);
      expect(handle.setActive).not.toHaveBeenCalledWith(true);
    }
  });

  it("applies a new limit at once, even to a squiggle already frozen", async () => {
    const { settle, frame, rerender } = await renderShell(loadingShell(), {
      waveFreezeAfterMs: 50,
    });
    settle();
    expect(framesUntilFrozen(frame)).toBe(3); // frozen at 64 ms
    expect(settle()).toBe(false);

    await rerender({ waveFreezeAfterMs: 100 });
    expect(settle()).toBe(true);
    expect(framesUntilFrozen(frame)).toBe(2); // 96 ms; the next frame freezes at 112

    await rerender({});
    expect(settle()).toBe(true);
    expect(framesUntilFrozen(frame, 16, 1_000)).toBe(1_000);
  });
});
