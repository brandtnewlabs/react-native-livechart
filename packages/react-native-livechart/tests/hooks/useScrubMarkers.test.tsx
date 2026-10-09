import { act, renderHook } from "@testing-library/react-native";
import { useAnimatedReaction, type SharedValue } from "react-native-reanimated";
import { useScrubMarkers } from "../../src/hooks/useScrubMarkers";
import { useCrosshairSeries } from "../../src/hooks/useCrosshairSeries";
import type { MultiEngineState } from "../../src/core/useLiveChartEngine";
import type { CandlePoint, ChartGap, Marker } from "../../src/types";

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => React.useRef({
      value: initial,
      get() { return this.value; },
      set(next: T) { this.value = next; },
    }).current,
    useAnimatedReaction: jest.fn(),
    useDerivedValue: <T,>(compute: () => T) => ({ get: compute }),
  };
});

function shared<T>(value: T) {
  return { value, get() { return this.value; }, set(next: T) { this.value = next; } } as SharedValue<T>;
}

async function setup(candleMode = false) {
  const markers = shared<Marker[]>([
    { id: "a", kind: "trade", time: 145, data: { quantity: 1 } },
    { id: "b", kind: "trade", time: 155, data: { quantity: 2 } },
  ]);
  const active = shared(true);
  const time = shared(150);
  const now = shared(200);
  const window = shared(100);
  const width = shared(220);
  const candle = shared<CandlePoint | null>(null);
  const gap = shared<ChartGap | null>(null);
  jest.mocked(useAnimatedReaction).mockClear();
  const { result, rerender } = await renderHook(({ enabled }: { enabled: boolean }) =>
    useScrubMarkers(enabled ? { markers, radius: 16 } : undefined,
      active, time, now, window, width, 20, candleMode, candle, 60, gap),
    { initialProps: { enabled: true } });
  const previous: unknown[] = [null, null];
  const step = async (sourceChanged = false) => {
    const calls = jest.mocked(useAnimatedReaction).mock.calls.slice(-2);
    await act(async () => {
      for (const index of sourceChanged ? [0, 1] : [1]) {
        const [prepare, react] = calls[index];
        const input = prepare();
        react(input, previous[index]);
        previous[index] = input;
      }
    });
    return result.current.get();
  };
  return { markers, active, time, now, window, width, candle, gap, step, rerender };
}

describe("useScrubMarkers", () => {
  it("keeps a stable selection while scrubbing within the same matches", async () => {
    const { time, step } = await setup();
    const first = await step(true);
    expect(first.map((m) => m.id)).toEqual(["a", "b"]);
    time.set(151);
    expect(await step()).toBe(first);
    time.set(160);
    expect((await step()).map((m) => m.id)).toEqual(["b"]);
    time.set(180);
    expect(await step()).toEqual([]);
  });

  it("refreshes .modify-style metadata changes and marker removal under a still finger", async () => {
    const { markers, step } = await setup();
    const original = await step(true);
    const input = markers.get();
    input[0].data = { quantity: 42 };
    const updated = await step(true);
    expect(updated).not.toBe(original);
    expect(updated[0].data).toEqual({ quantity: 42 });
    input.splice(0, 1);
    expect((await step(true)).map((m) => m.id)).toEqual(["b"]);
    markers.set([]);
    expect(await step(true)).toEqual([]);
  });

  it("re-evaluates matches when the drawn scale changes", async () => {
    const { window, width, step } = await setup();
    await step(true);
    window.set(50);
    expect(await step()).toEqual([]);
    width.set(120);
    expect((await step()).map((m) => m.id)).toEqual(["b"]); // window now starts at 150
  });

  it("clears matches for gaps, scrub end, and disabled matching", async () => {
    const { active, gap, rerender, step } = await setup();
    await step(true);
    gap.set({ from: 140, to: 160, kind: "unknown" });
    const empty = await step();
    expect(empty).toEqual([]);
    expect(await step()).toBe(empty);
    gap.set(null);
    expect(await step()).toHaveLength(2);
    active.set(false);
    expect(await step()).toEqual([]);
    active.set(true);
    await step();
    await rerender({ enabled: false });
    expect(await step(true)).toEqual([]);
    await rerender({ enabled: true });
    expect(await step(true)).toHaveLength(2);
  });

  it("selects the entire candle and stays stable through live OHLC ticks", async () => {
    const { candle, step } = await setup(true);
    expect(await step(true)).toEqual([]);
    const first = { time: 120, open: 1, high: 3, low: 0, close: 2 };
    candle.set(first);
    const matches = await step();
    expect(matches).toHaveLength(2);
    candle.set({ ...first, close: 3 });
    expect(await step()).toBe(matches);
    candle.set({ ...first, time: 180 });
    expect(await step()).toEqual([]);
    candle.set(first);
    expect(await step()).toHaveLength(2);
    candle.set(null);
    expect(await step()).toEqual([]);
  });
});

describe("multi-series scrub marker payload", () => {
  it.each([true, false])("includes markers only when enabled (%s) and clears on exit", async (enabled) => {
    const series = shared([{ id: "s", data: [{ time: 100, value: 10 }, { time: 200, value: 20 }] }]);
    const engine = {
      timestamp: shared(200), displayWindow: shared(100),
      canvasWidth: shared(220), canvasHeight: shared(200),
      displayMin: shared(0), displayMax: shared(30), displaySeriesValues: shared([20]), series,
    } as unknown as MultiEngineState;
    const markers = shared<Marker[]>([{ id: "trade", time: 150, kind: "trade", data: { quantity: 2 } }]);
    const onScrub = jest.fn();
    jest.mocked(useAnimatedReaction).mockClear();
    const { result } = await renderHook(() => useCrosshairSeries(
      engine, { left: 10, right: 10, top: 10, bottom: 10 }, true, onScrub,
      0, undefined, undefined, undefined, undefined, false,
      enabled ? { markers, radius: 16 } : undefined,
    ));
    const previous: unknown[] = [null, null, null];
    const step = () => {
      for (const [index, [prepare, react]] of jest.mocked(useAnimatedReaction).mock.calls.entries()) {
        const input = prepare();
        react(input, previous[index]);
        previous[index] = input;
      }
    };
    const start = result.current.gesture.handlers.onStart as (event: { x: number }) => void;
    start({ x: 110 });
    step();
    if (enabled) expect(onScrub.mock.calls[0][0].markers).toEqual(markers.get());
    else expect(onScrub.mock.calls[0][0]).not.toHaveProperty("markers");
    expect(onScrub.mock.calls[0][0].seriesValues).toEqual([{ id: "s", label: undefined, value: 15 }]);
    series.set([]);
    step();
    if (enabled) expect(onScrub).toHaveBeenLastCalledWith(null);
    result.current.scrubActive.set(false);
    step();
    expect(onScrub).toHaveBeenLastCalledWith(null);
    const count = onScrub.mock.calls.length;
    step();
    expect(onScrub).toHaveBeenCalledTimes(count);
  });
});
