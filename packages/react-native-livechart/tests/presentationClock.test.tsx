import { renderHook } from "@testing-library/react-native";
import { Skia } from "react-native-skia";
import { useSharedValue } from "react-native-reanimated";
import { useLiveChartSeriesEngine } from "../src/core/useLiveChartSeriesEngine";
import { useMultiSeriesLinePaths } from "../src/hooks/useMultiSeriesLinePaths";
import { buildLinePoints, lineTipX } from "../src/draw/line";
import { MAX_MULTI_SERIES } from "../src/constants";
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
const padding = { top: 0, right: 0, bottom: 0, left: 0 };
it("advances engine, path builder and scrub clock from a SharedValue without a React render", async () => {
  let renders = 0;
  const { result } = await renderHook(() => {
    renders++;
    const series = useSharedValue<SeriesConfig[]>([{ id: "a", curve: "linear", value: 30, data: [
      { time: 1000, value: 20 }, { time: 1050, value: 30 }, { time: 1060, value: 9999 }, { time: 1070, value: 40 },
    ] }]);
    const head = useSharedValue<number | undefined>(1050);
    const engine = useLiveChartSeriesEngine({ series, presentationTime: head, nowOverride: 1055, timeWindow: 100, windowBuffer: 0.1, smoothing: 1, allowFutureViewEnd: true });
    const paths = useMultiSeriesLinePaths(engine, padding, 1);
    return { engine, head, paths, series };
  });
  const { engine, head, paths, series } = result.current;
  engine.canvasWidth.set(320); engine.canvasHeight.set(200);
  mockFrame({ timeSincePreviousFrame: 16.67 });
  expect(engine.timestamp.get()).toBe(1060);
  expect(engine.currentTime.get()).toBe(1050);
  expect(engine.tipTime?.get()).toBe(1050);
  expect(engine.extremaMaxValue.get()).toBe(30);
  expect(paths.get()).toHaveLength(1);
  const builder = (Skia.PathBuilder.Make as jest.Mock).mock.results.slice(-MAX_MULTI_SERIES)[0].value;
  expect(builder.lineTo.mock.calls.at(-1)[0]).toBe(288);
  expect(builder.lineTo.mock.calls.every(([x]: [number]) => x <= 288)).toBe(true);
  for (const edge of [1055, 1060, 1070, 1100]) {
    engine.viewEnd.set(edge);
    mockFrame({ timeSincePreviousFrame: 16.67 });
    paths.get();
    expect(engine.displaySeriesValues.get()[0]).toBe(30);
    expect(engine.displayMin.get()).toBeCloseTo(18.8);
    expect(engine.displayMax.get()).toBeCloseTo(31.2);
    expect(engine.extremaMaxValue.get()).toBe(30);
    expect(builder.lineTo.mock.calls.at(-1)[0]).toBeCloseTo(lineTipX(edge, 100, 1050, 320, padding));
  }
  engine.viewEnd.set(1040);
  mockFrame({ timeSincePreviousFrame: 16.67 });
  expect(engine.displaySeriesValues.get()[0]).toBe(20);
  engine.viewEnd.set(null);
  head.set(1070); series.set([{ ...series.get()[0], value: 40 }]);
  mockFrame({ timeSincePreviousFrame: 16.67 }); paths.get();
  expect(engine.timestamp.get()).toBe(1080);
  expect(engine.currentTime.get()).toBe(1070);
  expect(builder.lineTo.mock.calls.at(-1)[0]).toBe(288);
  expect(renders).toBe(1);
  head.set(undefined); mockFrame({ timeSincePreviousFrame: 16.67 });
  expect(engine.currentTime.get()).toBe(1055);
  expect(engine.timestamp.get()).toBe(1065);
  head.set(1050); engine.viewEnd.set(1040); mockFrame({ timeSincePreviousFrame: 16.67 });
  expect(engine.tipTime?.get()).toBe(1040);
  engine.viewEnd.set(1100); mockFrame({ timeSincePreviousFrame: 16.67 }); paths.get();
  expect(engine.tipTime?.get()).toBe(1050);
  expect(builder.lineTo.mock.calls.at(-1)[0]).toBe(160);
});
it("keeps paths and dot projection at the same head in a future viewport", () => {
  const points = buildLinePoints([{ time: 1000, value: 10 }, { time: 1050, value: 20 }, { time: 1060, value: 99 }], 20, 1100, 100, 0, 100, 320, 200, padding, undefined, false, 1050);
  expect(points.at(-2)).toBe(160);
  expect(points.filter((_, i) => i % 2 === 0).every(x => x <= 160)).toBe(true);
  expect(lineTipX(1100, 100, 1050, 320, padding)).toBe(160);
  expect(lineTipX(1040, 100, 1050, 320, padding)).toBe(320);
});
it("emits no future path when the head predates the first available sample", () => {
  expect(buildLinePoints([{ time: 1051, value: 99 }], 99, 1060, 100, 0, 100, 320, 200, padding, undefined, false, 1050)).toEqual([]);
  expect(buildLinePoints([{ time: 1051, value: 99 }], 99, 1060, 100, 0, 100, 320, 200, padding, undefined, true, 1050)).toEqual([]);
});

it("uses wall time when both presentation head and numeric override are absent", async () => {
  const clock = jest.spyOn(Date, "now").mockReturnValue(2_000_000);
  try {
    const { result } = await renderHook(() => useLiveChartSeriesEngine({ series: useSharedValue<SeriesConfig[]>([]), timeWindow: 100, smoothing: 1, windowBuffer: 0.1, presentationTime: useSharedValue<number | undefined>(undefined) }));
    mockFrame({ timeSincePreviousFrame: 16.67 });
    expect(result.current.currentTime.get()).toBe(2000);
    expect(result.current.liveEdge.get()).toBe(2010);
  } finally { clock.mockRestore(); }
});
