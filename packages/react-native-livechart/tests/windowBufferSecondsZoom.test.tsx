import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";

import { useLiveChartEngine } from "../src/core/useLiveChartEngine";
import { useLiveChartSeriesEngine } from "../src/core/useLiveChartSeriesEngine";
import {
  resetPinchZoom,
  usePinchZoom,
  type PinchZoomEngineRefs,
} from "../src/hooks/usePinchZoom";

let mockFrame: (info: { timeSincePreviousFrame: number }) => void;

// Drive the real gesture callbacks and engine frames without a native runtime.
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => React.useRef({
      value: initial,
      get() { return this.value; },
      set(next: T) { this.value = next; },
      addListener() {},
      removeListener() {},
    }).current,
    useDerivedValue: <T,>(compute: () => T) => {
      const latest = React.useRef(compute);
      latest.current = compute;
      return React.useMemo(() => ({
        get value() { return latest.current(); },
        get() { return latest.current(); },
      }), []);
    },
    useAnimatedReaction: jest.fn(),
    useFrameCallback: (callback: typeof mockFrame) => {
      mockFrame = callback;
      return { setActive() {} };
    },
  };
});

jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets"),
  scheduleOnUI: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));

jest.mock("react-native-gesture-handler", () => ({
  Gesture: {
    Pinch: () => {
      const handlers: Record<string, unknown> = {};
      const gesture = new Proxy({ handlers }, {
        get(target, key: string) {
          if (key === "handlers") return target.handlers;
          return (arg: unknown) => {
            handlers[key] = arg;
            return gesture;
          };
        },
      });
      return gesture;
    },
  },
}));

type PinchHandlers = {
  handlers: {
    onStart(): void;
    onChange(event: { scale: number; focalX: number; numberOfPointers: number }): void;
  };
};

function useTestPinch(engine: PinchZoomEngineRefs) {
  const minTime = useSharedValue(700);
  return usePinchZoom({
    engine,
    minTime,
    timeWindow: 100,
    enabled: true,
    padding: { left: 0, right: 0, top: 0, bottom: 0 },
  }) as unknown as PinchHandlers;
}

const frame = () => mockFrame({ timeSincePreviousFrame: 16.67 });
const points = [{ time: 700, value: 10 }, { time: 1000, value: 20 }];

async function setupSingle(windowBuffer: number) {
  return renderHook(() => {
    const data = useSharedValue(points);
    const value = useSharedValue(20);
    const engine = useLiveChartEngine({
      data, value, timeWindow: 100, smoothing: 1,
      nowOverride: 1000, windowBuffer, windowBufferSeconds: 5,
      scrollEnabled: true, autoSleep: false,
    });
    const pinch = useTestPinch(engine);
    return { engine, pinch };
  });
}

async function setupMulti(windowBuffer: number) {
  return renderHook(() => {
    const series = useSharedValue([{ id: "a", value: 20, data: points }]);
    const engine = useLiveChartSeriesEngine({
      series, timeWindow: 100, smoothing: 1,
      nowOverride: 1000, windowBuffer, windowBufferSeconds: 5,
      scrollEnabled: true,
    });
    const pinch = useTestPinch(engine);
    return { engine, pinch };
  });
}

describe.each([
  ["single-series", setupSingle],
  ["multi-series", setupMulti],
] as const)("%s buffer during pinch zoom", (_label, setup) => {
  it.each([0, 0.1])(
    "keeps five seconds fixed and scales fractional padding %s with the zoomed window",
    async (windowBuffer) => {
      const { result } = await setup(windowBuffer);
      const { engine, pinch } = result.current;
      engine.canvasWidth.set(200);
      engine.canvasHeight.set(100);
      frame();
      expect(engine.liveEdge.get()).toBe(1005 + 100 * windowBuffer);

      pinch.handlers.onStart();
      // Pinch at the live edge so the chart keeps following while it zooms.
      pinch.handlers.onChange({ scale: 2, focalX: 200, numberOfPointers: 2 });
      expect(engine.viewEnd.get()).toBeNull();
      frame();
      expect(engine.displayWindow.get()).toBe(50);
      expect(engine.timestamp.get()).toBeCloseTo(engine.liveEdge.get());
      expect(engine.liveEdge.get() - 1000).toBeCloseTo(5 + 50 * windowBuffer);

      pinch.handlers.onStart();
      pinch.handlers.onChange({ scale: 0.5, focalX: 200, numberOfPointers: 2 });
      expect(engine.viewEnd.get()).toBeNull();
      frame();
      expect(engine.displayWindow.get()).toBe(100);
      expect(engine.liveEdge.get() - 1000).toBeCloseTo(5 + 100 * windowBuffer);

      resetPinchZoom(engine);
      frame();
      expect(engine.viewWindow.get()).toBeNull();
      expect(engine.viewEnd.get()).toBeNull();
      expect(engine.displayWindow.get()).toBe(100);
      expect(engine.liveEdge.get() - 1000).toBeCloseTo(5 + 100 * windowBuffer);
    },
  );
});
