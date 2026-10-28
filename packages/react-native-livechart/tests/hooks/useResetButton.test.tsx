import { renderHook } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";

import { resolveResetButton } from "../../src/core/resolveConfig";
import { useResetButton } from "../../src/hooks/useResetButton";

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const shared = <T,>(initial: T) => ({
    value: initial,
    get() {
      return this.value;
    },
    set(next: T) {
      this.value = next;
    },
  });
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => React.useRef(shared(initial)).current,
    // Derived values recompute on every read, standing in for the UI mapper.
    useDerivedValue: <T,>(compute: () => T) =>
      React.useRef({ get: compute, value: undefined }).current,
    withTiming: (value: number) => value,
    cancelAnimation: jest.fn(),
  };
});

jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets"),
  // No second runtime under Jest: run scheduled work inline.
  scheduleOnUI: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));

function shared<T>(value: T) {
  return {
    value,
    get() {
      return this.value;
    },
    set(next: T) {
      this.value = next;
    },
  } as SharedValue<T>;
}

type TapHandlers = {
  onTouchesDown: (
    event: { allTouches: { x: number; y: number }[]; numberOfTouches: number },
    manager: { fail: () => void },
  ) => void;
  onEnd: (event: object, success: boolean) => void;
};

const padding = { left: 12, right: 68, top: 10, bottom: 60 };

async function setup(config = resolveResetButton(true)) {
  const engine = {
    canvasWidth: shared(400),
    canvasHeight: shared(300),
    viewEnd: shared<number | null>(null),
    viewWindow: shared<number | null>(null),
    liveEdge: shared(1000),
    displayWindow: shared(60),
    viewRange: shared<{ min: number; max: number } | null>(null),
    viewRangeGestureOwned: shared(false),
    fitMin: shared(0),
    fitMax: shared(100),
    returnT: shared(1),
    returnFrom: shared(0),
    wake: jest.fn(),
  };
  const yRangeScale = shared(1);
  const scrubActive = shared(false);
  const onResetView = jest.fn();
  const hook = await renderHook(() =>
    useResetButton({
      config,
      engine: engine as unknown as Parameters<typeof useResetButton>[0]["engine"],
      padding,
      yRangeScale,
      scrubActive,
      returnToLiveMs: 450,
      onResetView,
    }),
  );
  return { ...hook, engine, yRangeScale, scrubActive, onResetView };
}

const down = (x: number, y: number, numberOfTouches = 1) => ({
  allTouches: [{ x, y }],
  numberOfTouches,
});

describe("useResetButton", () => {
  it("shows the button while any enabled manual state is off the fitted view", async () => {
    const { result, engine, yRangeScale, scrubActive } = await setup();
    const visible = result.current.visible;
    expect(visible.get()).toBe(false);
    engine.viewEnd.set(900);
    expect(visible.get()).toBe(true);
    scrubActive.set(true);
    expect(visible.get()).toBe(false);
    scrubActive.set(false);
    engine.viewEnd.set(null);
    yRangeScale.set(2);
    expect(visible.get()).toBe(true);
    yRangeScale.set(1);
    engine.viewRange.set({ min: 1, max: 2 });
    expect(visible.get()).toBe(false);
    engine.viewRangeGestureOwned.set(true);
    expect(visible.get()).toBe(true);
  });

  it("honors showFor and stays hidden when the button is off", async () => {
    const filtered = await setup(resolveResetButton({ showFor: { timeScroll: false } }));
    filtered.engine.viewEnd.set(900);
    expect(filtered.result.current.visible.get()).toBe(false);
    filtered.engine.viewWindow.set(45);
    expect(filtered.result.current.visible.get()).toBe(true);

    const off = await setup(null);
    off.engine.viewEnd.set(900);
    expect(off.result.current.visible.get()).toBe(false);
    expect(off.result.current.tapGesture).toBeNull();
  });

  it("places the rect from the measured size", async () => {
    const { result } = await setup(resolveResetButton({ placement: "bottom-right", margin: 8 }));
    result.current.measuredWidth.set(40);
    result.current.measuredHeight.set(30);
    expect(result.current.rect.get()).toEqual({ x: 284, y: 202, width: 40, height: 30 });
  });

  it("claims only single touches on the visible button and resets on a completed tap", async () => {
    const { result, engine, onResetView } = await setup();
    result.current.measuredWidth.set(36);
    result.current.measuredHeight.set(36);
    const handlers = result.current.tapGesture!.handlers as unknown as TapHandlers;

    const hidden = { fail: jest.fn() };
    handlers.onTouchesDown(down(160, 200), hidden);
    expect(hidden.fail).toHaveBeenCalledTimes(1);

    engine.viewEnd.set(900);
    for (const event of [down(10, 200), down(160, 200, 2)]) {
      const manager = { fail: jest.fn() };
      handlers.onTouchesDown(event, manager);
      expect(manager.fail).toHaveBeenCalledTimes(1);
    }
    const onButton = { fail: jest.fn() };
    handlers.onTouchesDown(down(160, 200), onButton);
    expect(onButton.fail).not.toHaveBeenCalled();

    handlers.onEnd({}, false);
    expect(engine.viewEnd.get()).toBe(900);
    expect(onResetView).not.toHaveBeenCalled();

    handlers.onEnd({}, true);
    expect(engine.wake).toHaveBeenCalledTimes(1);
    expect(engine.viewEnd.get()).toBeNull();
    expect(engine.returnFrom.get()).toBe(900);
    expect(onResetView).toHaveBeenCalledTimes(1);
  });

  it("exposes a JS-thread reset for the handle and accessibility", async () => {
    const { result, engine, yRangeScale, onResetView } = await setup();
    engine.viewWindow.set(45);
    engine.viewRange.set({ min: 1, max: 2 });
    engine.viewRangeGestureOwned.set(true);
    yRangeScale.set(2);
    result.current.reset();
    expect(engine.viewWindow.get()).toBeNull();
    expect(engine.viewRange.get()).toBeNull();
    expect(engine.viewRangeGestureOwned.get()).toBe(false);
    expect(yRangeScale.get()).toBe(1);
    expect(onResetView).toHaveBeenCalledTimes(1);
    expect(result.current.visible.get()).toBe(false);
  });
});
