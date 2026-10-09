import { renderHook } from "@testing-library/react-native";
import { useFrameCallback, type FrameInfo, type SharedValue } from "react-native-reanimated";

import { resolveDegen } from "../../src/core/resolveConfig";
import type { MultiEngineState, SingleEngineState } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { useDegen } from "../../src/hooks/useDegen";
import { useMultiSeriesDegen } from "../../src/hooks/useMultiSeriesDegen";
import type { Momentum } from "../../src/types";

// Run the real particle/shake frame worklets against mutable SharedValue doubles.
// Jest's normal Reanimated shim does not execute the UI frame loop.
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    useFrameCallback: jest.fn(),
    useSharedValue: <T,>(initial: T) => {
      const ref = React.useRef({
        value: initial,
        get() { return this.value; },
        set(next: T) { this.value = next; },
      });
      return ref.current;
    },
    useDerivedValue: <T,>(calculate: () => T) => ({
      get: calculate,
      get value() { return calculate(); },
    }),
  };
});

function shared<T>(value: T): SharedValue<T> {
  return { value, get() { return this.value; }, set(next: T) { this.value = next; } } as SharedValue<T>;
}

function frame(timestamp: number): void {
  const calls = jest.mocked(useFrameCallback).mock.calls;
  const callback = calls[calls.length - 1][0];
  callback({ timestamp, timeSincePreviousFrame: 1000 / 60, timeSinceFirstFrame: timestamp - 1000 } as FrameInfo);
}

const cfg = resolveDegen({
  particleSlotCount: 4,
  burstParticleCount: 1,
  particleBurstDurationSec: 1,
  speedMin: 120,
  speedMax: 120,
  spreadAngle: 0,
  positionJitterX: 0,
  positionJitterY: 0,
  drag: 1,
});

beforeEach(() => jest.mocked(useFrameCallback).mockClear());

it.each(["single", "multi"] as const)("keeps %s-series particles and shake moving while the viewport clock is pinned", async (kind) => {
  const timestamp = shared(1_700_000_000);
  const layout = { timestamp, canvasWidth: shared(400), canvasHeight: shared(300) };
  const { result } = await renderHook(() => {
    if (kind === "single") {
      return useDegen(layout as SingleEngineState, shared(100), shared(80), shared<Momentum>("up"), cfg);
    }
    const engine = {
      ...layout,
      displayMin: shared(0),
      displayMax: shared(100),
      displayWindow: shared(100),
      displaySeriesValues: shared([50]),
      seriesOpacities: shared([1]),
      series: shared([{
        id: "a", color: "#3b82f6", value: 50,
        data: Array.from({ length: 5 }, (_, i) => ({ time: i, value: i * 10 })),
      }]),
    } as MultiEngineState;
    return useMultiSeriesDegen(engine, DEFAULT_PADDING, cfg);
  });

  frame(1000);
  const firstY = result.current.pack.get()[1];
  const firstShake = result.current.shakeTransform.get();
  const firstRevision = result.current.packRevision.get();
  frame(1000 + 1000 / 60);

  expect(result.current.pack.get()[1]).toBeCloseTo(firstY - 2);
  expect(result.current.shakeTransform.get()).not.toEqual(firstShake);
  expect(result.current.packRevision.get()).toBe(firstRevision + 1);
  expect(result.current.particleTimestamp.get()).toBeCloseTo(1 + 1 / 60);
  expect(timestamp.get()).toBe(1_700_000_000);

  // A pan or nowOverride jump must not expire or rewind the effect.
  timestamp.set(1_700_010_000);
  frame(1000 + 2000 / 60);
  expect(result.current.pack.get()[5]).toBe(1);
  expect(result.current.pack.get()[1]).toBeCloseTo(firstY - 4);

  frame(2100);
  expect(result.current.pack.get()[5]).toBe(0);
  expect(result.current.shakeTransform.get()).toEqual([{ translateX: 0 }, { translateY: 0 }]);
  const clearedRevision = result.current.packRevision.get();
  frame(2200);
  expect(result.current.packRevision.get()).toBe(clearedRevision);
});

it("respects the single-series frame-loop gate", async () => {
  const active = shared(false);
  const layout = {
    timestamp: shared(1_700_000_000), canvasWidth: shared(400), canvasHeight: shared(300),
  } as SingleEngineState;
  const { result } = await renderHook(() =>
    useDegen(layout, shared(100), shared(80), shared<Momentum>("up"), cfg, undefined, active),
  );
  frame(1000);
  expect(result.current.packRevision.get()).toBe(0);
  active.set(true);
  frame(1100);
  expect(result.current.packRevision.get()).toBe(1);
  const y = result.current.pack.get()[1];
  active.set(false);
  frame(1100 + 1000 / 60);
  expect(result.current.pack.get()[1]).toBe(y);
});
