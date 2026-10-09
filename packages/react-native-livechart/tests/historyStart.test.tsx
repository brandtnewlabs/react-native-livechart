import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import { useLiveChartSeriesEngine } from "../src/core/useLiveChartSeriesEngine";
import { resetPinchZoom, usePinchZoom } from "../src/hooks/usePinchZoom";
import type { SeriesConfig } from "../src/types";

let mockFrame: (info: { timeSincePreviousFrame: number }) => void;
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
      // Reactions are not needed for this deterministic frame driver.
    },
    useFrameCallback: (fn: (info: { timeSincePreviousFrame: number }) => void) => { mockFrame = fn; return { setActive() {} }; },
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


type Handlers = { handlers: { onStart(): void; onChange(e: { scale: number; focalX: number; numberOfPointers: number }): void } };
const frame = () => mockFrame({ timeSincePreviousFrame: 16.67 });
async function setup(firstTime = 1000, now = 8200, configured = 3600, maxTimeWindow?: number) {
  const hook = await renderHook(({ now, start }: { now: number; start?: number }) => {
    const series = useSharedValue<SeriesConfig[]>([{ id: "a", value: 20, data: [{ time: firstTime, value: 10 }, { time: 8200, value: 20 }] }]);
    const engine = useLiveChartSeriesEngine({ series, timeWindow: configured, smoothing: 0.08, historyStartTime: start, nowOverride: now, windowBuffer: 0.04 });
    const minTime = useSharedValue(Math.min(firstTime, start ?? firstTime));
    const pinch = usePinchZoom({ engine, fullHistoryWindow: engine.fullHistoryWindow, minTime, timeWindow: configured, maxTimeWindow, enabled: true, padding: { left: 0, right: 0, top: 0, bottom: 0 } });
    return { engine, pinch: pinch as unknown as Handlers };
  }, { initialProps: { now, start: 1000 as number | undefined } });
  hook.result.current.engine.canvasWidth.set(320);
  hook.result.current.engine.canvasHeight.set(200);
  frame();
  return hook;
}

it("keeps the authoritative start exactly fixed as the clock advances, regardless of smoothing", async () => {
  const { result, rerender } = await setup(1000, 3760, 2760);
  expect(result.current.engine.displayWindow.get()).toBe(2875);
  expect(result.current.engine.timestamp.get()).toBe(3875);
  expect(result.current.engine.currentTime.get()).toBe(3760);
  expect(result.current.engine.timestamp.get() - result.current.engine.displayWindow.get()).toBe(1000);
  await rerender({ now: 4600, start: 1000 }); frame();
  expect(result.current.engine.timestamp.get() - result.current.engine.displayWindow.get()).toBe(1000);
  expect(result.current.engine.fullHistoryWindow.get()).toBe(3750);
});

it.each([1000, 5000])("pinches the actual 7500-second window and restores the full span with first point %s", async firstTime => {
  const { result } = await setup(firstTime);
  const { engine, pinch } = result.current;
  expect(engine.displayWindow.get()).toBe(7500);
  pinch.handlers.onStart();
  pinch.handlers.onChange({ scale: 2, focalX: 160, numberOfPointers: 2 });
  expect(engine.viewWindow.get()).toBe(3750);
  frame();
  expect(engine.displayWindow.get()).toBe(3750);
  pinch.handlers.onStart();
  pinch.handlers.onChange({ scale: 0.5, focalX: 160, numberOfPointers: 2 });
  expect(engine.displayWindow.get()).toBe(7500);
  resetPinchZoom(engine); frame();
  expect(engine.timestamp.get() - engine.displayWindow.get()).toBe(1000);
});

it("honors an explicit zoom maximum smaller than either default span", async () => {
  const { result } = await setup(5000, 8200, 3600, 3000);
  const { engine, pinch } = result.current;
  pinch.handlers.onStart();
  pinch.handlers.onChange({ scale: 0.5, focalX: 160, numberOfPointers: 2 });
  expect(engine.displayWindow.get()).toBe(3000);
});

it("freezes a panned width, permits sparse-history positions, and returns to the new anchored span", async () => {
  const { result, rerender } = await setup(5000);
  const engine = result.current.engine;
  engine.viewEnd.set(4000);
  await rerender({ now: 9160, start: 1000 }); frame();
  expect(engine.timestamp.get()).toBe(4000);
  expect(engine.displayWindow.get()).toBe(7500);
  resetPinchZoom(engine); frame();
  expect(engine.displayWindow.get()).toBe(8500);
  expect(engine.timestamp.get()).toBe(9500);
});

it("preserves fixed-window fallback when the history start is removed", async () => {
  const { result, rerender } = await setup();
  await rerender({ now: 8200, start: undefined }); frame();
  expect(result.current.engine.fullHistoryWindow.get()).toBeNull();
  expect(result.current.engine.displayWindow.get()).toBeLessThan(7500);
  expect(result.current.engine.timestamp.get()).toBe(8344);
});

it.each([NaN, Infinity, 9000])("falls back safely for invalid or future history start %s", async start => {
  const { result, rerender } = await setup();
  await rerender({ now: 8200, start }); frame();
  expect(result.current.engine.fullHistoryWindow.get()).toBeNull();
  expect(result.current.engine.timestamp.get()).toBe(8344);
});
