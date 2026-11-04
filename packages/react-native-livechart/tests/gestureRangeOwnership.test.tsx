import { renderHook } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";

import { useGestureRangeOwnership, writeGestureRange } from "../src/core/gestureRangeOwnership";
import { clearGestureOwnedRange } from "../src/core/useLiveChartEngine";
import { resetChartView } from "../src/hooks/resetView";

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => React.useRef({
      value: initial,
      get() { return this.value; },
      set(next: T) { this.value = next; },
    }).current,
    cancelAnimation: jest.fn(),
    withTiming: (value: number) => value,
  };
});

jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets"),
  scheduleOnUI: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));

type Range = { min: number; max: number } | null;

/** Model Reanimated's synchronous listeners for both set() and modify(). */
function shared<T>(initial: T): SharedValue<T> {
  let current = initial;
  const listeners = new Map<number, (value: T) => void>();
  return {
    get value() { return current; },
    set value(next: T) {
      if (next === current) return;
      current = next;
      listeners.forEach((listener) => listener(current));
    },
    get() { return current; },
    set(next: T | ((value: T) => T)) {
      this.value = typeof next === "function" ? (next as (value: T) => T)(current) : next;
    },
    addListener(id: number, listener: (value: T) => void) { listeners.set(id, listener); },
    removeListener(id: number) { listeners.delete(id); },
    modify(modifier?: (value: T) => T) {
      current = modifier ? modifier(current) : current;
      listeners.forEach((listener) => listener(current));
    },
  };
}

async function setup() {
  const range = shared<Range>(null);
  const hook = await renderHook(
    ({ range }: { range: SharedValue<Range> }) => useGestureRangeOwnership(range),
    { initialProps: { range } },
  );
  return { ...hook, range, owned: hook.result.current };
}

it("releases ownership synchronously when the app replaces or modifies its bounds", async () => {
  const { range, owned } = await setup();
  writeGestureRange(range, owned, { min: 10, max: 20 });
  expect(owned.get()).toBe(true);
  range.set({ min: 10, max: 20 });
  expect(owned.get()).toBe(false);

  writeGestureRange(range, owned, { min: 20, max: 30 });
  expect(owned.get()).toBe(true);
  range.modify((bounds) => {
    bounds!.min = 15;
    return bounds;
  });
  expect(owned.get()).toBe(false);
});

it("preserves app-written bounds when reset or reframing follows in the same worklet", async () => {
  const { range, owned } = await setup();
  writeGestureRange(range, owned, { min: 10, max: 20 });
  const appRange = { min: -10, max: 10 };
  range.set(appRange);
  resetChartView({
    viewRange: range,
    viewRangeGestureOwned: owned,
    viewEnd: shared<number | null>(900),
    viewWindow: shared<number | null>(45),
    yRangeScale: shared(2),
    returnT: shared(1),
    returnFrom: shared(0),
    returnToLiveMs: 0,
  });
  expect(range.get()).toBe(appRange);
  clearGestureOwnedRange(range, owned);
  expect(range.get()).toBe(appRange);
});

it("resets ownership and moves the subscription when the viewport changes", async () => {
  const { range, owned, rerender, unmount } = await setup();
  const panned = { min: 10, max: 20 };
  writeGestureRange(range, owned, panned);
  // Even reusing the old object in a new SharedValue belongs to the new viewport.
  const replacement = shared<Range>(panned);
  await rerender({ range: replacement });
  expect(owned.get()).toBe(false);
  clearGestureOwnedRange(replacement, owned);
  expect(replacement.get()).toBe(panned);

  writeGestureRange(replacement, owned, { min: 30, max: 40 });
  range.set(null);
  expect(owned.get()).toBe(true);
  replacement.set(null);
  expect(owned.get()).toBe(false);

  await unmount();
  owned.set(true);
  replacement.set({ min: 1, max: 2 });
  expect(owned.get()).toBe(true);
});

it("clears gesture-written bounds after repeated writes", async () => {
  const { range, owned } = await setup();
  writeGestureRange(range, owned, { min: -10, max: 10 });
  writeGestureRange(range, owned, { min: 0, max: 20 });
  expect(owned.get()).toBe(true);
  clearGestureOwnedRange(range, owned);
  expect(range.get()).toBeNull();
  expect(owned.get()).toBe(false);
});
