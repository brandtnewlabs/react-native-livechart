import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import { useLiveChartEngine } from "../src/core/useLiveChartEngine";

let mockTick: (dt: number) => boolean;
let mockPrepare: () => unknown[];
let mockEnabled: boolean;
jest.mock("../src/hooks/useDemandFrameLoop", () => ({
  useDemandFrameLoop: (enabled: boolean, prepare: () => unknown[], tick: (dt: number) => boolean) => {
    mockEnabled = enabled;
    mockPrepare = prepare;
    mockTick = tick;
    return () => {};
  },
}));
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => {
      const ref = React.useRef({ value: initial, get() { return this.value; }, set(next: T) { this.value = next; } });
      return ref.current;
    },
    useDerivedValue: <T,>(fn: () => T) => {
      const latest = React.useRef(fn);
      latest.current = fn;
      return React.useMemo(() => ({ get value() { return latest.current(); }, get() { return latest.current(); } }), []);
    },
    useAnimatedReaction: jest.fn(),
    useFrameCallback: () => ({ setActive: () => {} }),
  };
});

async function setup(props: { nowOverride?: number; paused?: boolean; static?: boolean; autoSleep?: boolean } = { nowOverride: 100 }) {
  const hook = await renderHook(() => {
    const data = useSharedValue([{ time: 0, value: 10 }, { time: 50, value: 20 }, { time: 100, value: 30 }]);
    const value = useSharedValue(30);
    const keepAwake = useSharedValue(false);
    const isFrameLoopActive = useSharedValue(true);
    const engine = useLiveChartEngine({ data, value, keepAwake, isFrameLoopActive, timeWindow: 100, smoothing: 1, autoSleep: true, ...props });
    return { engine, data, value, keepAwake, isFrameLoopActive };
  });
  hook.result.current.engine.canvasWidth.set(300);
  hook.result.current.engine.canvasHeight.set(200);
  return hook.result.current;
}

it("lets fixed time settle, then recomputes an interior data edit with unchanged endpoints", async () => {
  const view = await setup();
  mockTick(16.67);
  expect(mockTick(16.67)).toBe(false);
  const before = view.engine.displayMax.get();
  view.data.get()[1].value = 500;
  // The wake subscription reads the actual data, including same-array edits.
  expect(mockPrepare()).toContain(view.data.get());
  expect(mockTick(16.67)).toBe(true);
  expect(view.engine.displayMax.get()).toBeGreaterThan(before);
  expect(mockTick(16.67)).toBe(false);
});

it("keeps the live clock awake, but allows paused and valid parked windows to sleep", async () => {
  const live = await setup({});
  mockTick(16.67);
  expect(mockTick(16.67)).toBe(true);
  live.engine.viewEnd.set(80);
  mockTick(16.67);
  expect(mockTick(16.67)).toBe(false);
  live.engine.viewEnd.set(-1); // invalid history must resume the live clock
  expect(mockTick(16.67)).toBe(true);
});

it("allows a paused wall-clock chart to sleep", async () => {
  await setup({ paused: true });
  mockTick(16.67);
  expect(mockTick(16.67)).toBe(false);
});

it("keeps active effects awake and respects the manual gate", async () => {
  const view = await setup();
  mockTick(16.67);
  view.keepAwake.set(true);
  expect(mockTick(16.67)).toBe(true);
  view.isFrameLoopActive.set(false);
  view.value.set(123);
  expect(mockTick(16.67)).toBe(false);
  expect(view.engine.displayValue.get()).toBe(30);
  view.isFrameLoopActive.set(true);
  expect(mockTick(16.67)).toBe(true);
  expect(view.engine.displayValue.get()).toBe(123);
});

it("keeps static mode and the default on their existing scheduling paths", async () => {
  await setup({ static: true });
  expect(mockEnabled).toBe(false);
  await setup({ autoSleep: false });
  expect(mockEnabled).toBe(false);
});
