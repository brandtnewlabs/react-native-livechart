import { renderHook } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";
import type { LiveChartPoint } from "../src/types";
import { withSharedValueAccessors } from "./support/sharedValueMock";
let mockSleepPrepare: () => unknown[];
let mockSleepTick: (dt: number) => boolean;
jest.mock("../src/hooks/useDemandFrameLoop", () => ({
  useDemandFrameLoop: (_enabled: boolean, prepare: typeof mockSleepPrepare, tick: typeof mockSleepTick) => {
    mockSleepPrepare = prepare;
    mockSleepTick = tick;
    return () => {};
  },
}));
jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets"),
  scheduleOnUI: (fn: () => void) => fn(),
}));
function feed<T>(initial: T) {
  const listeners = new Map<number, (value: T) => void>();
  return {
    value: initial,
    get() {
      return this.value;
    },
    set(next: T) {
      this.value = next;
      listeners.forEach((fn) => fn(next));
    },
    modify(fn: (value: T) => T) {
      this.set(fn(this.value));
    },
    addListener: jest.fn((id: number, fn: (value: T) => void) =>
      listeners.set(id, fn),
    ),
    removeListener: jest.fn((id: number) => listeners.delete(id)),
    listeners,
  };
}

const mockDerived: { updater: () => unknown; output: SharedValue<unknown> }[] =
  [];
let mockFrame: (info: { timeSincePreviousFrame: number }) => void;
const mockReactions: {
  prepare: () => unknown;
  react: (curr: unknown, prev: unknown) => void;
}[] = [];
// Execute the engine/revision worklets explicitly; Jest has no native mapper
// scheduler. Real notification ordering is additionally checked on the simulator.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  const React = jest.requireActual("react");
  const shared = (initial: unknown) => {
    const ref = React.useRef(null);
    if (ref.current === null)
      ref.current = {
        value: initial,
        get() {
          return this.value;
        },
        set(next: unknown) {
          this.value = next;
        },
      };
    return ref.current;
  };
  return {
    ...actual,
    useSharedValue: shared,
    useDerivedValue: (updater: () => unknown) => {
      const output = shared(updater());
      mockDerived.push({ updater, output });
      return output;
    },
    useFrameCallback: (callback: typeof mockFrame) => {
      mockFrame = callback;
      return { setActive: () => {} };
    },
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (curr: unknown, prev: unknown) => void,
    ) => {
      mockReactions.push({ prepare, react });
    },
  };
});
import { useHistoryRevision } from "../src/core/useHistoryRevision";
import { useLiveChartEngine } from "../src/core/useLiveChartEngine";

beforeEach(() => {
  mockDerived.length = 0;
  mockReactions.length = 0;
});

it.each([false, true])(
  "revises same-array history without a React render (static=%s)",
  async (isStatic) => {
    const points = [
      { time: 1, value: 10 },
      { time: 2, value: 20 },
      { time: 3, value: 10 },
    ];
    const raw = feed(points);
    const bridged = feed(points);
    const value = withSharedValueAccessors({ sv: { value: 10 } })
      .sv as unknown as SharedValue<number>;
    const { result, unmount } = await renderHook(() =>
      useLiveChartEngine({
        data: bridged as unknown as SharedValue<LiveChartPoint[]>,
        dataChangeSource: raw as unknown as SharedValue<LiveChartPoint[]>,
        value,
        timeWindow: 3,
        nowOverride: 3,
        smoothing: 1,
        static: isStatic,
      }),
    );
    result.current.canvasWidth.set(300);
    result.current.canvasHeight.set(200);
    expect(raw.addListener).toHaveBeenCalledTimes(1);
    expect(bridged.addListener).toHaveBeenCalledTimes(1);
    const settle = mockReactions[1];
    let previous: unknown = null;
    const tick = () => {
      if (isStatic) {
        const current = settle.prepare();
        settle.react(current, previous);
        previous = current;
      } else mockFrame({ timeSincePreviousFrame: 16.67 });
    };
    tick();
    expect(result.current.extremaMaxValue.get()).toBe(20);
    // Mutate and immediately tick, deliberately without flushing any derived
    // mapper. The reveal bridge has the same array and does not notify listeners.
    raw.modify((points) => {
      points[1].value = 200;
      return points;
    });
    tick();
    expect(result.current.extremaMaxValue.get()).toBe(200);
    expect(result.current.extremaMaxTime.get()).toBe(2);
    await unmount();
    expect(raw.listeners.size).toBe(0);
    expect(bridged.listeners.size).toBe(0);
  },
);

it("keeps subscriptions separate across charts and removes them on source changes", async () => {
  const first = feed([{ time: 1, value: 10 }]);
  const second = feed([{ time: 1, value: 30 }]);
  const hook = await renderHook(
    ({ data }: { data: ReturnType<typeof feed<LiveChartPoint[]>> }) => ({
      a: useHistoryRevision(data as unknown as SharedValue<LiveChartPoint[]>),
      b: useHistoryRevision(data as unknown as SharedValue<LiveChartPoint[]>),
    }),
    { initialProps: { data: first } },
  );
  expect(first.listeners.size).toBe(2); // data === source is subscribed once per chart
  const previous = hook.result.current.a.get();
  first.modify((points) => {
    points[0].value = 20;
    return points;
  });
  expect(hook.result.current.a.get()).not.toBe(previous);
  expect(hook.result.current.b.get()!.data[0].value).toBe(20);
  await hook.rerender({ data: second });
  expect(first.listeners.size).toBe(0);
  expect(second.listeners.size).toBe(2);
  expect(hook.result.current.a.get()!.data[0].value).toBe(30);
  await hook.unmount();
  expect(second.listeners.size).toBe(0);
});

it.each(["line", "candle"] as const)(
  "wakes sleeping %s charts for source edits suppressed by the reveal bridge",
  async (mode) => {
    const points = [{ time: 1, value: 10 }, { time: 2, value: 20 }, { time: 3, value: 10 }];
    const bars = points.map((p) => ({ time: p.time, open: p.value, close: p.value, high: p.value, low: p.value }));
    const raw = feed(points);
    const bridged = feed(points);
    const rawCandles = feed(bars);
    const bridgedCandles = feed(bars);
    const { result } = await renderHook(() => useLiveChartEngine({
      data: bridged as unknown as SharedValue<typeof points>,
      dataChangeSource: raw as unknown as SharedValue<typeof points>,
      candles: bridgedCandles as unknown as SharedValue<typeof bars>,
      candlesChangeSource: rawCandles as unknown as SharedValue<typeof bars>,
      value: feed(10) as unknown as SharedValue<number>,
      mode,
      autoSleep: true,
      timeWindow: 3,
      nowOverride: 3,
      smoothing: 1,
    }));
    result.current.canvasWidth.set(300);
    result.current.canvasHeight.set(200);
    mockSleepTick(16.67);
    expect(mockSleepTick(16.67)).toBe(false);
    const before = mockSleepPrepare();
    if (mode === "line") raw.modify((items) => { items[1].value = 200; return items; });
    else rawCandles.modify((items) => { items[1].high = 200; return items; });
    // Neither bridged array changes identity or emits a notification. The
    // revision must nevertheless be an input to the demand-loop wake mapper.
    expect(mockSleepPrepare().some((input, i) => input !== before[i])).toBe(true);
    expect(mockSleepTick(16.67)).toBe(true);
    expect(result.current.extremaMaxValue.get()).toBe(200);
    expect(mockSleepTick(16.67)).toBe(false);
  },
);
