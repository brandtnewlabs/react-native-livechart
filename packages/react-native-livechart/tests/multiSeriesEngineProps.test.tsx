import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import { useLiveChartSeriesEngine, type MultiSeriesEngineConfig } from "../src/core/useLiveChartSeriesEngine";
import type { SeriesConfig } from "../src/types";

let mockFrame: (frame: { timeSincePreviousFrame: number }) => void;
let mockScrollPrepare: () => boolean;
let mockScrollReact: (enabled: boolean, previous: boolean | null) => void;
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => React.useRef({
      value: initial,
      get() { return this.value; },
      set(next: T) { this.value = next; },
    }).current,
    useDerivedValue: <T,>(fn: () => T) => {
      const latest = React.useRef(fn);
      latest.current = fn;
      return React.useMemo(() => ({ get value() { return latest.current(); }, get() { return latest.current(); } }), []);
    },
    useFrameCallback: (callback: typeof mockFrame) => { mockFrame = callback; return { setActive() {} }; },
    useAnimatedReaction: (prepare: typeof mockScrollPrepare, react: typeof mockScrollReact) => {
      mockScrollPrepare = prepare;
      mockScrollReact = react;
    },
  };
});

type Props = Omit<MultiSeriesEngineConfig, "series" | "yRangeScale">;
async function setup() {
  return renderHook(({ props }: { props: Props }) => {
    const series = useSharedValue<SeriesConfig[]>([{
      id: "a", value: 20, data: [{ time: 970, value: 10 }, { time: 1000, value: 20 }],
    }]);
    const yRangeScale = useSharedValue(1);
    const engine = useLiveChartSeriesEngine({ ...props, series, yRangeScale });
    return { engine, series, yRangeScale };
  }, { initialProps: { props: { timeWindow: 30, smoothing: 1, nowOverride: 1000 } } });
}
function tick() { mockFrame({ timeSincePreviousFrame: 16.67 }); }

it("applies clock, window, buffer, and transform prop changes to the next engine frame", async () => {
  const { result, rerender } = await setup();
  const engine = result.current.engine;
  engine.canvasWidth.set(320); engine.canvasHeight.set(200);
  tick();
  expect(engine.timestamp.get()).toBe(1000);
  expect(engine.displayWindow.get()).toBe(30);
  const firstRange = engine.displayMax.get() - engine.displayMin.get();
  result.current.yRangeScale.set(2);
  tick();
  expect(engine.displayMax.get() - engine.displayMin.get()).toBeCloseTo(firstRange * 2);
  await rerender({ props: {
    timeWindow: 60, smoothing: 1, nowOverride: 1030, windowBuffer: 0.1,
    rangeAnimation: { transform: ({ min, max }) => ({ min: min + 100, max: max + 100 }) },
  } });
  tick();
  expect(engine.timestamp.get()).toBe(1036);
  expect(engine.currentTime.get()).toBe(1030);
  expect(engine.displayWindow.get()).toBe(60);
  expect(engine.displayMin.get()).toBeGreaterThan(90);
  await rerender({ props: { timeWindow: 60, smoothing: 1, nowOverride: 1030, windowBuffer: 0 } });
  tick();
  expect(engine.timestamp.get()).toBe(1030);
  expect(engine.displayMin.get()).toBeLessThan(20);
});

it("uses current scroll props when returning from history, preserving the chart state", async () => {
  const { result, rerender } = await setup();
  const engine = result.current.engine;
  engine.viewEnd.set(900);
  expect(mockScrollPrepare()).toBe(true);
  await rerender({ props: { timeWindow: 30, smoothing: 1, nowOverride: 1000, scrollEnabled: false, returnToLiveMs: 0 } });
  mockScrollReact(mockScrollPrepare(), true);
  expect(engine.viewEnd.get()).toBeNull();
  expect(result.current.engine.viewEnd).toBe(engine.viewEnd);
});

it("fits the first measured data immediately, then eases live changes and resizing", async () => {
  const { result, rerender } = await setup();
  await rerender({ props: { timeWindow: 30, smoothing: 0.03, nowOverride: 1000, rangeAnimation: { animateExpansion: true } } });
  const engine = result.current.engine;
  tick(); // Unmeasured ticks must not consume the initial fit.
  expect(engine.displayMax.get()).toBe(1);
  engine.canvasWidth.set(320); engine.canvasHeight.set(200);
  tick();
  expect(engine.displayMin.get()).toBeLessThan(10);
  expect(engine.displayMax.get()).toBeGreaterThan(20);
  result.current.series.set([{ ...result.current.series.get()[0], value: 80 }]);
  engine.canvasWidth.set(640);
  tick();
  expect(engine.displaySeriesValues.get()[0]).toBeGreaterThan(20);
  expect(engine.displaySeriesValues.get()[0]).toBeLessThan(80);
  expect(engine.displayMax.get()).toBeLessThan(80);
});

it("waits for visible history before consuming the initial fit, including zero-valued data", async () => {
  const { result, rerender } = await setup();
  await rerender({ props: { timeWindow: 30, smoothing: 0.03, nowOverride: 1000, paused: true, rangeAnimation: { animateExpansion: true } } });
  const engine = result.current.engine;
  engine.canvasWidth.set(320); engine.canvasHeight.set(200);
  result.current.series.set([]);
  tick();
  result.current.series.set([{ id: "a", value: 20, data: [] }]);
  tick();
  result.current.series.set([{ id: "a", value: 20, visible: false, data: [{ time: 1000, value: 20 }] }]);
  tick();
  result.current.series.set([{ id: "a", value: 0, data: [{ time: 1000, value: 0 }] }]);
  tick();
  expect(engine.displaySeriesValues.get()).toEqual([0]);
  expect(engine.displayMin.get()).toBeCloseTo(-0.2);
  expect(engine.displayMax.get()).toBeCloseTo(0.2);
});
