import { act, renderHook } from "@testing-library/react-native";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";

import { useLiveChartSeriesEngine } from "../src/core/useLiveChartSeriesEngine";
import type { SeriesConfig } from "../src/types";

// Keep the real hook and frame implementation, controlling only scheduling and
// SharedValue storage so writes between frames can be observed deterministically.
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  function mutable<T>(initial: T) {
    return {
      value: initial,
      get() { return this.value; },
      set(next: T) { this.value = next; },
    };
  }
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => {
      const ref = React.useRef<ReturnType<typeof mutable<T>> | null>(null);
      if (!ref.current) ref.current = mutable(initial);
      return ref.current;
    },
    useDerivedValue: <T,>(fn: () => T) => ({
      get value() { return fn(); },
      get: fn,
    }),
    useFrameCallback: jest.fn(),
    useAnimatedReaction: jest.fn(),
  };
});

function dataset(scale: number, count = 5): SeriesConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `series-${i}`,
    data: [{ time: 1000, value: scale }, { time: 1060, value: (5 + i) * scale }],
    value: (5 + i) * scale,
  }));
}

function frame() {
  const calls = jest.mocked(useFrameCallback).mock.calls;
  calls[calls.length - 1][0]({
    timestamp: 1060000,
    timeSinceFirstFrame: 0,
    timeSincePreviousFrame: 1000 / 60,
  });
}

async function mountEngine() {
  return renderHook(() => {
    const input = useSharedValue(dataset(1));
    const engine = useLiveChartSeriesEngine({
      series: input,
      timeWindow: 60,
      nowOverride: 1060,
      smoothing: 1,
      adaptiveSpeedBoost: 0,
    });
    return { input, engine };
  });
}

beforeEach(() => jest.mocked(useFrameCallback).mockClear());

it("holds histories and tips until the matching engine frame (#346)", async () => {
  const { result } = await mountEngine();
  const { input, engine } = result.current;
  engine.canvasWidth.set(320);
  engine.canvasHeight.set(280);
  await act(frame);
  expect(engine.series.get()[0].data[1].value).toBe(5);
  expect(engine.displayMax.get()).toBeLessThan(11);

  const priceFrame = engine.series.get();
  input.set(dataset(1000));
  expect(engine.series.get()[0].data[1].value).toBe(5);
  expect(engine.displaySeriesValues.get()[0]).toBe(5);
  expect(engine.displayMax.get()).toBeLessThan(11);

  await act(frame);
  expect(engine.series.get()[0].data[1].value).toBe(5000);
  expect(engine.displaySeriesValues.get()[0]).toBe(5000);
  expect(engine.displayMax.get()).toBeGreaterThanOrEqual(9000);
  expect(engine.displayMin.get()).toBeLessThanOrEqual(1000);
  expect(engine.series.get()).not.toBe(input.get());
  expect(engine.series.get()[0]).not.toBe(input.get()[0]);
  // Histories are shared, not copied every frame.
  expect(engine.series.get()[0].data).toBe(input.get()[0].data);
  expect(priceFrame[0].value).toBe(5);

  input.get()[0].value = 5100;
  expect(engine.series.get()[0].value).toBe(5000);
  await act(frame);
  expect(engine.series.get()[0].value).toBe(5100);
  expect(engine.displaySeriesValues.get()[0]).toBe(5100);

  input.set(dataset(1, 2));
  expect(engine.series.get()).toHaveLength(5);
  await act(frame);
  expect(engine.series.get()).toHaveLength(2);
  expect(engine.displaySeriesValues.get()).toEqual([5, 6]);
  expect(engine.displayMax.get()).toBeLessThan(10);

  input.set([]);
  expect(engine.series.get()).toHaveLength(2);
  await act(frame);
  expect(engine.series.get()).toEqual([]);
  expect(engine.displaySeriesValues.get()).toEqual([]);
});

it("does not publish incoming series before a measured frame", async () => {
  const { result } = await mountEngine();
  const { input, engine } = result.current;
  await act(frame);
  expect(engine.series.get()).toEqual([]);
  engine.canvasWidth.set(320);
  await act(frame);
  expect(engine.series.get()).toEqual([]);
  engine.canvasHeight.set(280);
  await act(frame);
  const measured = engine.series.get();
  engine.canvasHeight.set(0);
  input.set(dataset(1000));
  await act(frame);
  expect(engine.series.get()).toBe(measured);
  expect(engine.displayMax.get()).toBeLessThan(11);
  engine.canvasHeight.set(280);
  await act(frame);
  expect(engine.series.get()[0].value).toBe(5000);
});

it("publishes snapped replacements together, then resumes normal tip smoothing", async () => {
  const { result, rerender } = await renderHook(({ snapKey }: { snapKey: number }) => {
    const input = useSharedValue(dataset(1));
    const engine = useLiveChartSeriesEngine({
      series: input,
      timeWindow: 60,
      nowOverride: 1060,
      smoothing: 0.08,
      adaptiveSpeedBoost: 0,
      snapKey,
    });
    return { input, engine };
  }, { initialProps: { snapKey: 0 } });
  const { input, engine } = result.current;
  engine.canvasWidth.set(320);
  engine.canvasHeight.set(280);
  await act(frame);

  input.set(dataset(1000));
  await rerender({ snapKey: 1 });
  expect(engine.series.get()[0].value).toBe(5);
  await act(frame);
  expect(engine.series.get()[0].value).toBe(5000);
  expect(engine.displaySeriesValues.get()[0]).toBe(5000);
  expect(engine.displayMax.get()).toBeGreaterThanOrEqual(9000);

  input.get()[0].value = 6000;
  await act(frame);
  expect(engine.series.get()[0].value).toBe(6000);
  expect(engine.displaySeriesValues.get()[0]).toBeGreaterThan(5000);
  expect(engine.displaySeriesValues.get()[0]).toBeLessThan(6000);
});
