import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import { useLiveChartEngine } from "../src/core/useLiveChartEngine";
import { usePanScroll } from "../src/hooks/usePanScroll";
import { resetPinchZoom, usePinchZoom } from "../src/hooks/usePinchZoom";
import type { ChartViewportControl } from "../src";

let mockTick: (dt: number) => boolean;
let mockPrepare: () => unknown[];
const mockReactions: {
  prepare: () => unknown;
  react: (next: unknown, prev: unknown) => void;
}[] = [];
jest.mock("../src/hooks/useDemandFrameLoop", () => ({
  useDemandFrameLoop: (
    _enabled: boolean,
    prepare: () => unknown[],
    tick: (dt: number) => boolean,
  ) => {
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
      const ref = React.useRef({
        value: initial,
        get() {
          return this.value;
        },
        set(next: T) {
          this.value = next;
        },
        addListener() {},
        removeListener() {},
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
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (next: unknown, prev: unknown) => void,
    ) => {
      mockReactions.push({ prepare, react });
    },
    useFrameCallback: () => ({ setActive() {} }),
  };
});
jest.mock("react-native-gesture-handler", () => {
  const makeGesture = () => {
    const handlers: Record<string, unknown> = {};
    const gesture = new Proxy(
      { handlers },
      {
        get(target, key: string) {
          if (key === "handlers") return target.handlers;
          return (arg: unknown) => {
            handlers[key] = arg;
            return gesture;
          };
        },
      },
    );
    return gesture;
  };
  return { Gesture: { Pan: makeGesture, Pinch: makeGesture } };
});

type GestureHandlers = {
  handlers: {
    onStart: () => void;
    onChange: (event: {
      changeX?: number;
      scale?: number;
      focalX?: number;
      numberOfPointers?: number;
    }) => void;
  };
};

beforeEach(() => {
  mockReactions.length = 0;
});

async function setup(
  initial: {
    mode?: "line" | "candle";
    controlled?: boolean;
    windowSmoothing?: boolean;
    smoothing?: number;
  } = {},
) {
  const hook = await renderHook(
    ({
      timeWindow,
      scrollEnabled,
    }: {
      timeWindow: number;
      scrollEnabled: boolean;
    }) => {
      const data = useSharedValue([
        { time: 0, value: 10 },
        { time: 50, value: 20 },
        { time: 100, value: 30 },
      ]);
      const value = useSharedValue(30);
      const candles = useSharedValue([
        { time: 0, open: 10, high: 30, low: 10, close: 30 },
      ]);
      const end = useSharedValue<number | null>(80);
      const window = useSharedValue<number | null>(40);
      const viewport: ChartViewportControl = {
        end,
        window,
        windowSmoothing: initial.windowSmoothing,
      };
      const engine = useLiveChartEngine({
        data,
        value,
        candles,
        mode: initial.mode,
        viewport: initial.controlled === false ? undefined : viewport,
        timeWindow,
        smoothing: initial.smoothing ?? 1,
        nowOverride: 100,
        autoSleep: true,
        scrollEnabled,
      });
      const minTime = useSharedValue(0);
      const padding = { left: 0, right: 0, top: 0, bottom: 0 };
      const pan = usePanScroll({
        engine,
        minTime,
        padding,
        enabled: scrollEnabled,
        clampOnOverscrollChange: initial.controlled === false,
      });
      const pinch = usePinchZoom({
        engine,
        minTime,
        padding,
        enabled: true,
        timeWindow,
      });
      return {
        engine,
        viewport,
        pan: pan as unknown as GestureHandlers,
        pinch: pinch as unknown as GestureHandlers,
      };
    },
    { initialProps: { timeWindow: 100, scrollEnabled: true } },
  );
  hook.result.current.engine.canvasWidth.set(200);
  hook.result.current.engine.canvasHeight.set(100);
  return hook;
}

it.each(["line", "candle"] as const)(
  "adopts the caller's pair in %s mode and honors past, live, and future edges",
  async (mode) => {
    const { result } = await setup({ mode });
    const { engine, viewport } = result.current;
    expect(engine.viewEnd).toBe(viewport.end);
    expect(engine.viewWindow).toBe(viewport.window);
    for (const end of [80, 100, 140]) {
      viewport.end.set(end);
      mockTick(16.67);
      expect(engine.timestamp.get()).toBe(end);
      expect(engine.displayWindow.get()).toBe(40);
    }
    viewport.end.set(-1);
    mockTick(16.67);
    expect(engine.timestamp.get()).toBe(100); // retained-history guard stays intact
    expect(viewport.end.get()).toBe(-1); // fallback does not clear app state
  },
);

it("preserves external values through base-window and gesture-config changes", async () => {
  const { result, rerender } = await setup();
  const viewport = result.current.viewport;
  await rerender({ timeWindow: 200, scrollEnabled: false });
  for (const reaction of mockReactions) {
    const next = reaction.prepare();
    if (typeof next === "boolean") reaction.react(false, true);
    if (typeof next === "number") reaction.react(0, 0.5);
  }
  expect(result.current.engine.viewEnd).toBe(viewport.end);
  expect(viewport.end.get()).toBe(80);
  expect(viewport.window.get()).toBe(40);
  mockTick(16.67);
  expect(result.current.engine.timestamp.get()).toBe(80);
  expect(result.current.engine.displayWindow.get()).toBe(40);
  resetPinchZoom(result.current.engine);
  expect(viewport.end.get()).toBeNull();
  expect(viewport.window.get()).toBeNull();
  mockTick(16.67);
  expect(result.current.engine.timestamp.get()).toBe(100);
  expect(result.current.engine.displayWindow.get()).toBe(200);
});

it("still clears private zoom state when the base window changes", async () => {
  const { result, rerender } = await setup({ controlled: false });
  result.current.engine.viewWindow.set(25);
  await rerender({ timeWindow: 200, scrollEnabled: true });
  expect(result.current.engine.viewWindow.get()).toBeNull();
});

it("can copy drawn widths exactly while preserving normal value and reset easing", async () => {
  const { result } = await setup({ windowSmoothing: false, smoothing: 0.08 });
  const { engine, viewport } = result.current;
  mockTick(16.67);
  expect(engine.displayWindow.get()).toBe(40);
  expect(engine.displayValue.get()).toBeGreaterThan(0);
  expect(engine.displayValue.get()).toBeLessThan(30);
  viewport.window.set(20);
  mockTick(16.67);
  expect(engine.displayWindow.get()).toBe(20);
  resetPinchZoom(engine);
  mockTick(16.67);
  expect(engine.displayWindow.get()).toBeGreaterThan(20);
  expect(engine.displayWindow.get()).toBeLessThan(100);
});

it("eases external window overrides by default", async () => {
  const { result } = await setup({ smoothing: 0.08 });
  mockTick(16.67);
  expect(result.current.engine.displayWindow.get()).toBeGreaterThan(40);
  expect(result.current.engine.displayWindow.get()).toBeLessThan(100);
});

it("pan and focal pinch write the adopted values and reset clears the same pair", async () => {
  const { result } = await setup();
  const { engine, viewport, pan, pinch } = result.current;
  mockTick(16.67);
  pan.handlers.onStart();
  pan.handlers.onChange({ changeX: 50 });
  expect(viewport.end.get()).toBe(70);
  expect(viewport.window.get()).toBe(40);
  pinch.handlers.onStart();
  pinch.handlers.onChange({ scale: 2, focalX: 100, numberOfPointers: 2 });
  expect(viewport.window.get()).toBe(20);
  expect(viewport.end.get()).toBe(60);
  expect(engine.displayWindow.get()).toBe(20);
  pan.handlers.onStart();
  pan.handlers.onChange({ changeX: -500 });
  expect(viewport.end.get()).toBeNull();
  resetPinchZoom(engine);
  expect(viewport.window.get()).toBeNull();
});

it("watches both adopted values for autoSleep wake-up and settles after external writes", async () => {
  const { result } = await setup();
  const { engine, viewport } = result.current;
  mockTick(16.67);
  expect(mockTick(16.67)).toBe(false);
  const before = mockPrepare();
  viewport.end.set(120);
  viewport.window.set(25);
  expect(mockPrepare()).not.toEqual(before);
  expect(mockTick(16.67)).toBe(true);
  expect(engine.timestamp.get()).toBe(120);
  expect(engine.displayWindow.get()).toBe(25);
  expect(mockTick(16.67)).toBe(false);
});
