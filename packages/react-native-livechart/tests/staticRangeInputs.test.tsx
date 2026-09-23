import { renderHook } from "@testing-library/react-native";
import { useAnimatedReaction, type SharedValue } from "react-native-reanimated";
import { useLiveChartEngine } from "../src/core/useLiveChartEngine";
import type { LiveChartPoint } from "../src/types";

// Execute the real reaction prepare/settle functions explicitly: Jest does not
// run Reanimated's UI scheduler. Derived getters let us model range props landing
// after data without claiming to reproduce native mapper scheduling here.
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => {
      const ref = React.useRef({
        value: initial,
        get() {
          return this.value;
        },
        set(next: T) {
          this.value = next;
        },
      });
      return ref.current;
    },
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
    useFrameCallback: () => React.useMemo(() => ({ setActive: jest.fn() }), []),
  };
});

function shared<T>(value: T) {
  return {
    value,
    get() {
      return this.value;
    },
  } as SharedValue<T>;
}

type Bounds = {
  maxValue?: number;
  referenceValue?: number;
  referenceValues?: number[];
  static?: boolean;
};

async function setup(bounds: Bounds) {
  const data = shared<LiveChartPoint[]>([
    { time: 0, value: 10 },
    { time: 100, value: 30 },
  ]);
  const value = shared(30);
  const hook = await renderHook(
    (props: Bounds) =>
      useLiveChartEngine({
        data,
        value,
        timeWindow: 100,
        nowOverride: 100,
        windowBuffer: 0,
        smoothing: 1,
        nonNegative: true,
        static: true,
        ...props,
      }),
    { initialProps: bounds },
  );
  hook.result.current.canvasWidth.value = 300;
  hook.result.current.canvasHeight.value = 200;
  let previous: unknown = null;
  const settle = () => {
    const calls = jest.mocked(useAnimatedReaction).mock.calls;
    const [prepare, react] = calls[calls.length - 1];
    const current = prepare();
    if (current !== previous) react(current, previous);
    const changed = current !== previous;
    previous = current;
    return changed;
  };
  return { ...hook, data, settle };
}

beforeEach(() => jest.clearAllMocks());

it("settles when a ceiling arrives after replacement data, in both directions", async () => {
  const view = await setup({ maxValue: 60 });
  view.settle();
  view.data.value = [
    { time: 0, value: 1000 },
    { time: 100, value: 3000 },
  ];
  view.settle();
  expect(view.result.current.displayMax.value).toBe(60);
  await view.rerender({ maxValue: 6000 });
  expect(view.settle()).toBe(true);
  expect(view.result.current.displayMax.value).toBeGreaterThan(3000);
  await view.rerender({ maxValue: 60 });
  expect(view.settle()).toBe(true);
  expect(view.result.current.displayMax.value).toBe(60);
  expect(view.settle()).toBe(false);
});

it("settles scalar reference changes without replacing data", async () => {
  const view = await setup({ referenceValue: 60 });
  view.settle();
  await view.rerender({ referenceValue: 6000 });
  expect(view.settle()).toBe(true);
  expect(view.result.current.displayMax.value).toBeGreaterThan(6000);
  await view.rerender({ referenceValue: 60 });
  expect(view.settle()).toBe(true);
  expect(view.result.current.displayMax.value).toBeLessThan(100);
});

it("settles reference bound changes and removal, but ignores identical values", async () => {
  const view = await setup({ referenceValues: [0, 60], maxValue: 6000 });
  view.settle();
  await view.rerender({ referenceValues: [0, 6000], maxValue: 6000 });
  expect(view.settle()).toBe(true);
  expect(view.result.current.displayMax.value).toBe(6000);
  await view.rerender({ referenceValues: [0, 6000], maxValue: 6000 });
  expect(view.settle()).toBe(false);
  await view.rerender({ maxValue: 6000 });
  expect(view.settle()).toBe(true);
  expect(view.result.current.displayMax.value).toBeLessThan(100);
});

it("keeps the static reaction inert for live charts", async () => {
  const view = await setup({ static: false, maxValue: 60 });
  view.settle();
  await view.rerender({
    static: false,
    maxValue: 6000,
    referenceValues: [0, 6000],
  });
  expect(view.settle()).toBe(false);
});
