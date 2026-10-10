import { matchFont } from "react-native-skia";
import { renderHook } from "@testing-library/react-native";
import { Gesture } from "react-native-gesture-handler";
import { cancelAnimation, type SharedValue } from "react-native-reanimated";
import {
  resolveYAxis,
  resolveYAxisScaleGesture,
} from "../../src/core/resolveConfig";
import {
  draggedYAxisScale,
  isYAxisScaleHit,
  useYAxisScaleGesture,
  useYAxisScaleValue,
} from "../../src/hooks/useYAxisScaleGesture";

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T>(initial: T) =>
      React.useRef({
        value: initial,
        get() {
          return this.value;
        },
        set(next: T) {
          this.value = next;
        },
      }).current,
    cancelAnimation: jest.fn(),
    withTiming: (value: number) => value,
  };
});

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
const font = matchFont({ fontSize: 12 });
const padding = { left: 12, right: 68, top: 10, bottom: 60 };
const entries = [{ y: 50, alpha: 1, label: "100.00" }];

describe("axis-scale configuration", () => {
  it("is opt-in and normalizes invalid bounds/sensitivity", () => {
    expect(resolveYAxis(true)?.scaleGesture).toBeNull();
    expect(resolveYAxis(false)).toBeNull();
    expect(resolveYAxisScaleGesture(false)).toBeNull();
    expect(resolveYAxisScaleGesture(true)).toEqual({
      minScale: 0.25,
      maxScale: 10,
      dragDistance: 160,
      doubleTapReset: true,
    });
    expect(
      resolveYAxisScaleGesture({
        minScale: -1,
        maxScale: Infinity,
        dragDistance: NaN,
      }),
    ).toEqual(resolveYAxisScaleGesture(true));
    expect(
      resolveYAxis({
        scaleGesture: {
          minScale: 2,
          maxScale: 1,
          dragDistance: 80,
          doubleTapReset: false,
        },
      })?.scaleGesture,
    ).toEqual({
      minScale: 2,
      maxScale: 2,
      dragDistance: 80,
      doubleTapReset: false,
    });
  });
});

describe("scale math and live layout", () => {
  it("scales exponentially in either direction and saturates extreme drags", () => {
    expect(draggedYAxisScale(2, 160, 160, 0.25, 10)).toBeCloseTo(2 * Math.E);
    expect(draggedYAxisScale(2, -160, 160, 0.25, 10)).toBeCloseTo(2 / Math.E);
    expect(draggedYAxisScale(1, 1e300, 160, 0.25, 10)).toBe(10);
    expect(draggedYAxisScale(1, -1e300, 160, 0.25, 10)).toBe(0.25);
    expect(draggedYAxisScale(NaN, 0, 160, 0.25, 10)).toBe(1);
    expect(draggedYAxisScale(-3, 0, 160, 0.25, 10)).toBe(1);
    expect(draggedYAxisScale(50, 0, 160, 0.25, 10)).toBe(10);
  });

  it("uses the actual gutter, excluding the volume/time band and outside canvas", () => {
    const hit = (x: number, y: number) =>
      isYAxisScaleHit(
        x,
        y,
        400,
        300,
        padding,
        "right",
        false,
        undefined,
        entries,
        font,
      );
    expect(hit(332, 10)).toBe(true);
    expect(hit(331, 100)).toBe(false);
    expect(hit(370, 239)).toBe(true);
    expect(hit(370, 240)).toBe(false);
    expect(hit(370, 9)).toBe(false);
    expect(hit(401, 50)).toBe(false);
    expect(hit(-1, 50)).toBe(false);
    expect(
      isYAxisScaleHit(
        1,
        20,
        0,
        0,
        padding,
        "right",
        false,
        undefined,
        [],
        font,
      ),
    ).toBe(false);
  });

  it("follows a left inset and the actual widths of floating/anchored labels", () => {
    expect(
      isYAxisScaleHit(
        60,
        100,
        400,
        300,
        { ...padding, left: 80 },
        "left",
        true,
        20,
        entries,
        font,
      ),
    ).toBe(true);
    expect(
      isYAxisScaleHit(
        81,
        100,
        400,
        300,
        { ...padding, left: 80 },
        "left",
        false,
        undefined,
        entries,
        font,
      ),
    ).toBe(false);
    const textWidth = font.measureText(entries[0].label).width;
    const floatPadding = { ...padding, right: 6 };
    expect(
      isYAxisScaleHit(
        394 - textWidth,
        100,
        400,
        300,
        floatPadding,
        "right",
        true,
        undefined,
        entries,
        font,
      ),
    ).toBe(true);
    expect(
      isYAxisScaleHit(
        393 - textWidth,
        100,
        400,
        300,
        floatPadding,
        "right",
        true,
        undefined,
        entries,
        font,
      ),
    ).toBe(false);
    expect(
      isYAxisScaleHit(
        370 - textWidth,
        100,
        400,
        300,
        floatPadding,
        "right",
        false,
        30,
        entries,
        font,
      ),
    ).toBe(true);
  });
});

async function setup(deferHit?: (x: number, y: number) => boolean) {
  const engine = {
    canvasWidth: shared(400),
    canvasHeight: shared(300),
    displayMin: shared(0),
    displayMax: shared(100),
    displayWindow: shared(60),
    timestamp: shared(1000),
    wake: jest.fn(),
  };
  const scale = shared(2);
  const gesture = Gesture.Simultaneous(Gesture.Pan(), Gesture.Pinch());
  const onStart = jest.fn();
  const active = shared(false);
  const options = {
    engine,
    padding,
    font,
    scale,
    gesture,
    entries: shared(entries),
    deferHit,
    onStart,
    active,
  };
  const hook = await renderHook(
    ({
      axis,
      pad,
    }: {
      axis: ReturnType<typeof resolveYAxis>;
      pad: typeof padding;
    }) => useYAxisScaleGesture({ ...options, axis, padding: pad }),
    {
      initialProps: {
        axis: resolveYAxis({ scaleGesture: true }),
        pad: padding,
      },
    },
  );
  const [pan, reset] = hook.result.current.toGestureArray();
  return { ...hook, engine, scale, gesture, onStart, active, pan, reset };
}

type Handlers = {
  onTouchesDown: (
    event: { allTouches: { x: number; y: number }[]; numberOfTouches: number },
    manager: { fail: () => void; activate: () => void },
  ) => void;
  onTouchesUp: (event: object, manager: { end: () => void }) => void;
  onTouchesCancelled: (event: object, manager: { fail: () => void }) => void;
  onStart: () => void;
  onFinalize: () => void;
  onTouchesMove: (event: { allTouches: { x: number; y: number }[] }) => void;
  onEnd: (event: object, success: boolean) => void;
};
const manager = () => ({
  fail: jest.fn(),
  activate: jest.fn(),
  begin: jest.fn(),
});
const down = (x: number, y = 100, numberOfTouches = 1) => ({
  allTouches: [{ x, y }],
  numberOfTouches,
});

describe("axis gesture ownership", () => {
  it("seeds each drag before native moves that precede the ACTIVE event", async () => {
    const { pan, scale } = await setup();
    const h = pan.handlers as unknown as Handlers;
    const state = { ...manager(), end: jest.fn() };
    h.onTouchesDown(down(370), state);
    h.onTouchesMove(down(370, 180));
    expect(scale.get()).toBeCloseTo(2 * Math.exp(0.5));
    h.onStart();
    h.onTouchesMove(down(370, 260));
    expect(scale.get()).toBeCloseTo(2 * Math.E);
    h.onTouchesUp({}, state);
    h.onTouchesMove(down(370, 300));
    expect(scale.get()).toBeCloseTo(2 * Math.E);
    h.onFinalize();

    // A reset or external control between drags must become the new baseline.
    scale.set(1);
    h.onTouchesDown(down(370), state);
    h.onTouchesMove(down(370, 180));
    h.onStart();
    h.onTouchesMove(down(370, 260));
    expect(scale.get()).toBeCloseTo(Math.E);
    h.onTouchesCancelled({}, state);
    h.onTouchesMove(down(370, 300));
    expect(scale.get()).toBeCloseTo(Math.E);
  });

  it("uses explicit native activation and releases every terminal touch", async () => {
    const manual = jest.spyOn(Gesture, "Manual");
    const { pan, scale } = await setup();
    expect(manual).toHaveBeenCalled();
    const h = pan.handlers as unknown as Handlers;
    const state = { ...manager(), end: jest.fn() };
    h.onTouchesDown(down(200), state);
    h.onTouchesUp({}, state);
    expect(state.end).not.toHaveBeenCalled();
    h.onTouchesMove(down(370, 260));
    expect(scale.get()).toBe(2);
    h.onTouchesDown(down(370), state);
    expect(state.begin.mock.invocationCallOrder[0]).toBeLessThan(
      state.activate.mock.invocationCallOrder[0],
    );
    h.onStart();
    h.onTouchesUp({}, state);
    expect(state.end).toHaveBeenCalledTimes(1);
    h.onFinalize();
    h.onTouchesMove(down(370, 260));
    expect(scale.get()).toBe(2);
    h.onTouchesDown(down(370), state);
    h.onTouchesCancelled({}, state);
    h.onFinalize();
    expect(state.fail).toHaveBeenCalledTimes(2);
    manual.mockRestore();
  });

  it("makes every plot recognizer wait for the axis, while its own drag/reset coexist", async () => {
    const { result, gesture, pan, reset } = await setup();
    result.current.prepare();
    for (const plot of gesture.toGestureArray()) {
      expect(plot.config.requireToFail).toEqual(
        expect.arrayContaining([pan, reset]),
      );
    }
    expect(pan.config.simultaneousWith).toContain(reset);
    expect(reset.config.simultaneousWith).toContain(pan);
  });

  it("claims the current gutter and fails immediately for plot, volume, or two fingers", async () => {
    const { pan, reset, engine } = await setup();
    for (const g of [pan, reset]) {
      const handlers = g.handlers as unknown as Handlers;
      for (const event of [down(200), down(370, 260), down(370, 100, 2)]) {
        const state = manager();
        handlers.onTouchesDown(event, state);
        expect(state.fail).toHaveBeenCalledTimes(1);
        expect(state.activate).not.toHaveBeenCalled();
      }
    }
    const state = manager();
    (pan.handlers as unknown as Handlers).onTouchesDown(down(370), state);
    expect(state.activate).toHaveBeenCalledTimes(1);
    engine.canvasWidth.set(500);
    const resized = manager();
    (pan.handlers as unknown as Handlers).onTouchesDown(down(370), resized);
    expect(resized.fail).toHaveBeenCalledTimes(1);
  });

  it("yields both recognizers to interactive overlay hits", async () => {
    const { pan, reset } = await setup(() => true);
    for (const g of [pan, reset]) {
      const state = manager();
      (g.handlers as unknown as Handlers).onTouchesDown(down(370), state);
      expect(state.fail).toHaveBeenCalledTimes(1);
    }
  });

  it("cancels an animation, writes the same scale, resets, and can start another drag", async () => {
    const { pan, reset, scale, engine, onStart, active } = await setup();
    const h = pan.handlers as unknown as Handlers;
    h.onTouchesDown(down(370), manager());
    h.onStart();
    expect(active.get()).toBe(true);
    expect(cancelAnimation).toHaveBeenCalledWith(scale);
    h.onTouchesMove(down(370, 260));
    expect(scale.get()).toBeCloseTo(2 * Math.E);
    (reset.handlers as unknown as Handlers).onEnd({}, false);
    expect(scale.get()).toBeCloseTo(2 * Math.E);
    (reset.handlers as unknown as Handlers).onEnd({}, true);
    expect(scale.get()).toBe(1);
    h.onTouchesDown(down(370), manager());
    h.onStart();
    h.onTouchesMove(down(370, -60));
    expect(scale.get()).toBeCloseTo(1 / Math.E);
    expect(engine.wake).toHaveBeenCalledTimes(3);
    expect(onStart).toHaveBeenCalledTimes(3);
    h.onFinalize();
    expect(active.get()).toBe(false);
  });

  it("reuses handlers across equal inline config and inset objects, disables cleanly", async () => {
    const { result, rerender, gesture } = await setup();
    const original = result.current;
    await rerender({
      axis: resolveYAxis({ scaleGesture: {} }),
      pad: { ...padding },
    });
    expect(result.current).toBe(original);
    await rerender({
      axis: resolveYAxis({ scaleGesture: { doubleTapReset: false } }),
      pad: padding,
    });
    expect(result.current.toGestureArray()[1].config.enabled).toBe(false);
    await rerender({ axis: resolveYAxis(true), pad: padding });
    expect(result.current).toBe(gesture);
    await rerender({ axis: null, pad: padding });
    expect(result.current).toBe(gesture);
  });
});

describe("private scale state", () => {
  it("starts at one, persists while external state is selected, and uses the supplied reference", async () => {
    const external = shared(4);
    const { result, rerender } = await renderHook(
      ({ value }: { value: SharedValue<number> | undefined }) =>
        useYAxisScaleValue(value),
      { initialProps: { value: undefined as SharedValue<number> | undefined } },
    );
    const internal = result.current;
    expect(internal.get()).toBe(1);
    internal.set(2);
    await rerender({ value: external });
    expect(result.current).toBe(external);
    await rerender({ value: undefined });
    expect(result.current).toBe(internal);
    expect(result.current.get()).toBe(2);
  });
});
