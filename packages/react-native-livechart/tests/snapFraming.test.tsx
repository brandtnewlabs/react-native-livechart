import { renderHook } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";
import { useLiveChartEngine, type EngineConfig } from "../src/core/useLiveChartEngine";

type Worklet<Args extends unknown[], Result> = ((...args: Args) => Result) & {
  __closure?: Record<string, unknown>;
  __workletHash?: number;
};
type Mapper = {
  id: number;
  run: () => void;
  inputs: SharedValue<unknown>[];
  outputs: SharedValue<unknown>[];
  dirty: boolean;
};

let mockNextMapperId = 0;
const mockMappers = new Map<number, Mapper>();
let mockTick: (dt: number) => boolean;

function mockShared<T>(initial: T): SharedValue<T> {
  let value = initial;
  const listeners = new Map<number, (next: T) => void>();
  const set = (next: T) => {
    if (Object.is(value, next)) return;
    value = next;
    listeners.forEach((listener) => listener(next));
  };
  return {
    __mockShared: true,
    get value() { return value; },
    set value(next: T) { set(next); },
    get: () => value,
    set,
    addListener(id: number, listener: (next: T) => void) { listeners.set(id, listener); },
    removeListener(id: number) { listeners.delete(id); },
  } as unknown as SharedValue<T>;
}

function mockExtractInputs(values: unknown[], result: SharedValue<unknown>[] = []) {
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    if ("__mockShared" in value) result.push(value as unknown as SharedValue<unknown>);
    else if (Array.isArray(value)) mockExtractInputs(value, result);
    else if (Object.getPrototypeOf(value) === Object.prototype) {
      mockExtractInputs(Object.values(value), result);
    }
  }
  return result;
}

function mockRegister(run: () => void, inputs: unknown[], outputs: SharedValue<unknown>[] = []) {
  const id = ++mockNextMapperId;
  const mapper: Mapper = { id, run, inputs: mockExtractInputs(inputs), outputs, dirty: true };
  mockMappers.set(id, mapper);
  mapper.inputs.forEach((input) => input.addListener(id, () => { mapper.dirty = true; }));
  return () => {
    mockMappers.delete(id);
    mapper.inputs.forEach((input) => input.removeListener(id));
  };
}

// Model Reanimated's producer-before-consumer ordering and registration lifetime.
// Eager derived getters conceal the race when changed config mappers move behind
// the existing snap reaction. These tests flush the actual worklet closures.
function flushMappers() {
  const producers = new Map<SharedValue<unknown>, Mapper[]>();
  mockMappers.forEach((mapper) => mapper.outputs.forEach((output) => {
    producers.set(output, [...(producers.get(output) ?? []), mapper]);
  }));
  const visited = new Set<Mapper>();
  const ordered: Mapper[] = [];
  function visit(mapper: Mapper) {
    if (visited.has(mapper)) return;
    visited.add(mapper);
    mapper.inputs.forEach((input) => producers.get(input)?.forEach(visit));
    ordered.push(mapper);
  }
  mockMappers.forEach(visit);
  ordered.forEach((mapper) => {
    if (!mapper.dirty) return;
    mapper.dirty = false;
    mapper.run();
  });
}

jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets"),
  scheduleOnUI: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));
jest.mock("../src/hooks/useDemandFrameLoop", () => ({
  useDemandFrameLoop: (_enabled: boolean, _prepare: () => unknown, tick: typeof mockTick) => {
    mockTick = tick;
    return () => {};
  },
}));
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => React.useRef(mockShared(initial)).current,
    useDerivedValue: <T,>(updater: Worklet<[], T>) => {
      const output = React.useRef(mockShared(updater())).current;
      const inputs = Object.values(updater.__closure ?? {});
      React.useEffect(() => mockRegister(() => {
        output.value = updater();
      }, inputs, [output as SharedValue<unknown>]), [...inputs, updater.__workletHash]);
      return output;
    },
    useAnimatedReaction: <T,>(
      prepare: Worklet<[], T>,
      react: Worklet<[T, T | null], void>,
      dependencies?: unknown[],
    ) => {
      const previous = React.useRef<T | null>(null);
      const inputs = Object.values(prepare.__closure ?? {});
      const deps = dependencies ?? [...inputs, ...Object.values(react.__closure ?? {})];
      React.useEffect(() => mockRegister(() => {
        const next = prepare();
        react(next, previous.current);
        previous.current = next;
      }, inputs), [...deps, prepare.__workletHash, react.__workletHash]);
    },
    useFrameCallback: () => React.useMemo(() => ({ setActive() {} }), []),
  };
});

type Selection = Pick<EngineConfig, "snapKey" | "exaggerate" | "thresholdRangePoints"
  | "thresholdRangeExtendToStart" | "thresholdRangeExtendToNow">;

async function setup(initial: Selection) {
  const data = mockShared([{ time: 0, value: 10 }, { time: 100, value: 30 }]);
  const value = mockShared(30);
  const hook = await renderHook((props: Selection) => useLiveChartEngine({
    data, value, timeWindow: 100, nowOverride: 100, smoothing: 0.08, ...props,
  }), { initialProps: initial });
  hook.result.current.canvasWidth.set(300);
  hook.result.current.canvasHeight.set(200);
  flushMappers();
  mockTick(16.67);
  return { ...hook, value };
}

beforeEach(() => mockMappers.clear());

it("snaps with a same-render exaggerate change, then resumes ordinary live easing", async () => {
  const hook = await setup({ snapKey: 0, exaggerate: false });
  await hook.rerender({ snapKey: 1, exaggerate: true });
  flushMappers();
  expect(hook.result.current.displayMin.get()).toBeCloseTo(9.8);
  expect(hook.result.current.displayMax.get()).toBeCloseTo(30.2);
  expect(hook.result.current.displayValue.get()).toBe(30);

  hook.value.set(40);
  flushMappers();
  mockTick(16.67);
  expect(hook.result.current.displayValue.get()).toBeGreaterThan(30);
  expect(hook.result.current.displayValue.get()).toBeLessThan(40);
});

it("snaps with the new includeInRange threshold rather than easing from the old fit", async () => {
  const hook = await setup({
    snapKey: 0,
    thresholdRangePoints: [{ time: 0, value: 1000 }, { time: 100, value: 1000 }],
  });
  await hook.rerender({
    snapKey: 1,
    thresholdRangePoints: [{ time: 0, value: 100 }, { time: 100, value: 100 }],
  });
  flushMappers();
  expect(hook.result.current.displayMin.get()).toBeCloseTo(-0.8);
  expect(hook.result.current.displayMax.get()).toBeCloseTo(110.8);
});

it.each([
  { flag: "thresholdRangeExtendToStart" as const, from: 200, to: 250 },
  { flag: "thresholdRangeExtendToNow" as const, from: -200, to: -100 },
])("snaps with a same-render $flag change", async ({ flag, from, to }) => {
  const thresholdRangePoints = [{ time: from, value: 1000 }, { time: to, value: 1000 }];
  const hook = await setup({ snapKey: 0, thresholdRangePoints, [flag]: true });
  await hook.rerender({ snapKey: 1, thresholdRangePoints, [flag]: false });
  flushMappers();
  expect(hook.result.current.displayMin.get()).toBeCloseTo(7.6);
  expect(hook.result.current.displayMax.get()).toBeCloseTo(32.4);
});
