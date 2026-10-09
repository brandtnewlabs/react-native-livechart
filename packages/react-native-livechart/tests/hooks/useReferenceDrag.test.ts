import { renderHook } from "@testing-library/react-native";
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";

import {
  tickLiveChartEngineFrame,
  type EngineTickMutable,
} from "../../src/core/liveChartEngineTick";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import {
  computeScrubDotY,
  computeValueAtY,
} from "../../src/hooks/crosshairShared";
import { useReferenceDrag } from "../../src/hooks/useReferenceDrag";
import type { ReferenceLine } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

// Execute gesture worklets against mutable JS values; the native test shim
// freezes SharedValues when serializing handlers and cannot drive their state.
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => React.useRef({
      value: initial,
      get() { return this.value; },
      set(next: T) { this.value = next; },
    }).current,
    useDerivedValue: (updater: () => unknown) => {
      const latest = React.useRef(updater);
      latest.current = updater;
      return React.useMemo(() => ({ get: () => latest.current() }), []);
    },
    useAnimatedReaction: jest.fn(),
  };
});

function engine(canvasHeight = 300): ChartEngineLayout {
  return withSharedValueAccessors({
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: canvasHeight },
    timestamp: { value: 0 },
  }) as unknown as ChartEngineLayout;
}

async function setup(lines: ReferenceLine[], enabled = true, canvasHeight = 300) {
  return await renderHook(() => {
    const dragValues = useSharedValue<number[]>(lines.map((l) => l.value ?? 0));
    const dragActive = useSharedValue<boolean[]>(lines.map(() => false));
    return useReferenceDrag(
      engine(canvasHeight),
      DEFAULT_PADDING,
      lines,
      dragValues,
      dragActive,
      enabled,
    );
  });
}

type DragHandlers = {
  onTouchesDown: (
    e: { changedTouches: { x: number; y: number }[] },
    manager: { fail: () => void },
  ) => void;
  onStart: (e: { y: number }) => void;
  onUpdate: (e: { y: number }) => void;
  onFinalize: () => void;
};

const TOP = DEFAULT_PADDING.top;
const BOTTOM = 300 - DEFAULT_PADDING.bottom;

/** Canvas Y of `value` on the 300 px test canvas with the range `[min, max]`. */
function yOf(value: number, min = 0, max = 100) {
  return computeScrubDotY(
    value,
    min,
    max,
    300,
    DEFAULT_PADDING.top,
    DEFAULT_PADDING.bottom,
  );
}

/** Draggable lines on a stable engine, with the hook's drag state exposed. The
 *  Reanimated mock computes derived values on read, so `drawn()` is what the
 *  overlays would read after the range set with `setRange`. */
async function setupDrag(initial: ReferenceLine[]) {
  const eng = engine();
  const { result, rerender } = await renderHook(
    ({ lines }: { lines: ReferenceLine[] }) => {
      const values = useSharedValue(lines.map((l) => l.value ?? 0));
      const active = useSharedValue(lines.map(() => false));
      const drag = useReferenceDrag(
        eng,
        DEFAULT_PADDING,
        lines,
        values,
        active,
        true,
      );
      return { drag, values, active };
    },
    { initialProps: { lines: initial } },
  );
  const handlers = () =>
    result.current.drag.gesture.handlers as unknown as DragHandlers;
  return {
    eng,
    rerender,
    handlers,
    /** The value the finger last set (what the range fit reads). */
    values: () => result.current.values.get(),
    /** Stands in for the chart re-seeding its values for new `lines`. */
    setValues: (values: number[]) => result.current.values.set(values),
    /** Which lines the drag marks as dragging. */
    active: () => result.current.active.get(),
    /** Stands in for the chart re-seeding its flags for new `lines`. */
    setActive: (active: boolean[]) => result.current.active.set(active),
    /** The values the lines are drawn at. */
    drawn: () => result.current.drag.drawnValues.get(),
    setRange(min: number, max: number) {
      eng.displayMin.set(min);
      eng.displayMax.set(max);
    },
    /** Grab the line at `index`, drag the finger to `y` and hold it there. */
    dragTo(y: number, index = 0) {
      const at = yOf(
        initial[index].value ?? 0,
        eng.displayMin.get(),
        eng.displayMax.get(),
      );
      handlers().onTouchesDown(
        { changedTouches: [{ x: 40, y: at }] },
        { fail: jest.fn() },
      );
      handlers().onStart({ y });
      handlers().onUpdate({ y });
    },
  };
}

/** Lets `scheduleOnRN` callbacks (queued as microtasks in Jest) run. */
const flushCallbacks = () => Promise.resolve();

describe("useReferenceDrag", () => {
  it("returns a gesture for a draggable line", async () => {
    const { result } = await setup([{ value: 50, draggable: true }]);
    expect(result.current).toBeTruthy();
  });

  it("returns a gesture when nothing is draggable", async () => {
    const { result } = await setup([
      { value: 50 },
      { valueFrom: 10, valueTo: 20 },
    ]);
    expect(result.current).toBeTruthy();
  });

  it("sets up the onDragIn/Out reaction when those callbacks exist", async () => {
    const { result } = await setup([
      { value: 50, draggable: true, snap: 1, bounds: [0, 90], onDragOut: () => {} },
      { value: 70, onDragIn: () => {} },
    ]);
    expect(result.current).toBeTruthy();
  });

  it("hitTest grabs a line with a grabRange only inside it", async () => {
    const { result } = await setup([
      { value: 50, draggable: true, grabRange: [0, 80] },
    ]);
    const y = computeScrubDotY(
      50,
      0,
      100,
      300,
      DEFAULT_PADDING.top,
      DEFAULT_PADDING.bottom,
    );
    expect(result.current.hitTest(40, y)).toBe(true);
    expect(result.current.hitTest(200, y)).toBe(false);
  });

  it("hitTest grabs a line without a grabRange anywhere along it", async () => {
    const { result } = await setup([{ value: 50, draggable: true }]);
    const y = computeScrubDotY(
      50,
      0,
      100,
      300,
      DEFAULT_PADDING.top,
      DEFAULT_PADDING.bottom,
    );
    expect(result.current.hitTest(40, y)).toBe(true);
    expect(result.current.hitTest(200, y)).toBe(true);
  });

  it.each([40, 200])("decides drag ownership at touch-down x=%s", async (x) => {
    const { result } = await setup([
      { value: 50, draggable: true, grabRange: [0, 80] },
    ]);
    const y = computeScrubDotY(
      50, 0, 100, 300, DEFAULT_PADDING.top, DEFAULT_PADDING.bottom,
    );
    const fail = jest.fn();
    const touchDown = result.current.gesture.handlers.onTouchesDown as unknown as (
      e: { changedTouches: { x: number; y: number }[] },
      manager: { fail: () => void },
    ) => void;
    touchDown({ changedTouches: [{ x, y }] }, { fail });
    expect(fail).toHaveBeenCalledTimes(x === 40 ? 0 : 1);
    // A grabbed line keeps ownership beyond both its X and Y grab bands.
    expect(result.current.hitTest(200, y + 50)).toBe(x === 40);
    (result.current.gesture.handlers.onFinalize as () => void)();
    expect(result.current.hitTest(200, y + 50)).toBe(false);
  });

  it("uses an updated grabRange after a controlled rerender", async () => {
    const { result, rerender } = await renderHook(
      ({ range }: { range: [number, number] }) => {
        const values = useSharedValue([50]);
        const active = useSharedValue([false]);
        return useReferenceDrag(
          engine(),
          DEFAULT_PADDING,
          [{ value: 50, draggable: true, grabRange: range }],
          values,
          active,
          true,
        );
      },
      { initialProps: { range: [0, 80] as [number, number] } },
    );
    const y = computeScrubDotY(
      50, 0, 100, 300, DEFAULT_PADDING.top, DEFAULT_PADDING.bottom,
    );
    expect(result.current.hitTest(40, y)).toBe(true);
    expect(result.current.hitTest(150, y)).toBe(false);
    await rerender({ range: [120, 200] });
    expect(result.current.hitTest(40, y)).toBe(false);
    expect(result.current.hitTest(150, y)).toBe(true);
  });

  it.each([120, 200, -20, -100])("grabs an off-axis line at the pinned edge (value=%s)", async (value) => {
    const { result } = await setup([
      { value, draggable: true, grabRange: [0, 80] },
    ]);
    const y = value > 100 ? DEFAULT_PADDING.top : 300 - DEFAULT_PADDING.bottom;
    expect(result.current.hitTest(40, y)).toBe(true);
    expect(result.current.hitTest(200, y)).toBe(false);
  });

  it.each([0, DEFAULT_PADDING.top + DEFAULT_PADDING.bottom])("does not grab lines before the canvas has a drawable height (height=%s)", async (height) => {
    const { result } = await setup([
      { value: 120, draggable: true, grabRange: [0, 80] },
    ], true, height);
    expect(result.current.hitTest(40, DEFAULT_PADDING.top)).toBe(false);
  });

  it("keeps a dragged line under a still finger when the range or plot moves", async () => {
    const t = await setupDrag([{ value: 50, draggable: true }]);
    const fingerY = yOf(60);
    t.dragTo(fingerY);
    expect(t.drawn()[0]).toBeCloseTo(60);

    // Live data / a range animation moves the range; the finger doesn't move.
    t.setRange(0, 200);
    expect(t.drawn()[0]).toBeCloseTo(120);
    expect(yOf(t.drawn()[0], 0, 200)).toBeCloseTo(fingerY);
    // The range fit keeps the value the finger set.
    expect(t.values()[0]).toBeCloseTo(60);

    // So does a resize of the plot.
    t.eng.canvasHeight.set(400);
    expect(t.drawn()[0]).toBeCloseTo(
      computeValueAtY(fingerY, 0, 200, 400, TOP, DEFAULT_PADDING.bottom)!,
    );
  });

  it("reports onChange as the finger moves, not as the range moves", async () => {
    const onChange = jest.fn();
    const t = await setupDrag([{ value: 50, draggable: true, onChange }]);
    t.dragTo(yOf(60));
    t.setRange(0, 200);
    await flushCallbacks();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBeCloseTo(60);
    // The next move reports the value at the finger against the current range.
    t.handlers().onUpdate({ y: yOf(150, 0, 200) });
    await flushCallbacks();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1][0]).toBeCloseTo(150);
  });

  it("commits the value under the finger and leaves the line there", async () => {
    const calls: [string, number][] = [];
    const t = await setupDrag([
      {
        value: 50,
        draggable: true,
        onChange: (v) => calls.push(["change", v]),
        onCommit: (v) => calls.push(["commit", v]),
      },
    ]);
    t.dragTo(yOf(60));
    t.setRange(0, 200);
    t.handlers().onFinalize();
    await flushCallbacks();
    // onChange catches up with the drawn line once, then the commit.
    expect(calls.map(([kind]) => kind)).toEqual(["change", "change", "commit"]);
    expect(calls[0][1]).toBeCloseTo(60);
    expect(calls[1][1]).toBeCloseTo(120);
    expect(calls[2][1]).toBeCloseTo(120);
    expect(t.values()[0]).toBeCloseTo(120);
    expect(t.drawn()[0]).toBeCloseTo(120);
  });

  it("re-maps with the line's snap and bounds", async () => {
    const t = await setupDrag([
      { value: 50, draggable: true, snap: 5, bounds: [0, 105] },
    ]);
    t.dragTo(yOf(60));
    t.setRange(0, 170); // 102 → snapped to 100
    expect(t.drawn()[0]).toBe(100);
    t.setRange(0, 180); // 108 → 110 → clamped to 105
    expect(t.drawn()[0]).toBe(105);
  });

  it("draws a snapped line on the plot at its edge", async () => {
    const t = await setupDrag([{ value: 95, draggable: true, snap: 0.05 }]);
    t.setRange(89.96, 101.23);
    // At the top edge 101.23 rounds to 101.25, above the range: drawn one step in.
    t.dragTo(TOP);
    expect(t.drawn()[0]).toBeCloseTo(101.2);
    // The range moves under the finger: same rule.
    t.setRange(89.96, 101.38); // 101.40 is above → 101.35
    expect(t.drawn()[0]).toBeCloseTo(101.35);
    // At the bottom edge 89.96 rounds to 89.95, below the range: one step in.
    t.handlers().onUpdate({ y: BOTTOM });
    expect(t.drawn()[0]).toBeCloseTo(90);
  });

  it("rounds the finger's value outward past the edge, so a coarse snap can widen the range", async () => {
    const onCommit = jest.fn();
    const t = await setupDrag([
      { value: 103, draggable: true, snap: 1, onCommit },
    ]);
    t.setRange(99.28, 106.3);
    // At the edge: the nearest whole number, 106.
    t.dragTo(TOP);
    expect(t.values()[0]).toBe(106);
    // Past it: 107, above the range, which the range then fits; drawn at 106.
    t.handlers().onUpdate({ y: TOP - 20 });
    expect(t.values()[0]).toBe(107);
    expect(t.drawn()[0]).toBe(106);
    // Past the bottom edge: down.
    t.handlers().onUpdate({ y: BOTTOM + 20 });
    expect(t.values()[0]).toBe(99);
    expect(t.drawn()[0]).toBe(100);
    // The drop is what is drawn.
    t.handlers().onFinalize();
    await flushCallbacks();
    expect(onCommit).toHaveBeenCalledWith(100);
  });

  it.each([
    ["no line is grabbed", "none"],
    ["a line is grabbed but not yet dragged", "grab"],
    ["the drag has ended", "release"],
  ] as const)("does not re-map a line when %s", async (_, phase) => {
    const t = await setupDrag([{ value: 50, draggable: true }]);
    if (phase === "grab") {
      t.handlers().onTouchesDown(
        { changedTouches: [{ x: 40, y: yOf(50) }] },
        { fail: jest.fn() },
      );
    } else if (phase === "release") {
      t.dragTo(yOf(60));
      t.handlers().onFinalize();
    }
    const before = t.values()[0];
    t.setRange(0, 200);
    expect(t.drawn()[0]).toBe(before);
  });

  it("lets go when another line takes the dragged line's index", async () => {
    const orderCommit = jest.fn();
    const alertCommit = jest.fn();
    const order = {
      id: "order",
      value: 50,
      draggable: true,
      onCommit: orderCommit,
    };
    const alert = {
      id: "alert",
      value: 10,
      draggable: true,
      onCommit: alertCommit,
    };
    const t = await setupDrag([order]);
    t.dragTo(yOf(60));
    // A line is added before the dragged one: "alert" takes index 0, and the
    // chart carries the dragged value and flag over to it by index.
    await t.rerender({ lines: [alert, order] });
    t.setValues([60, 50]);
    t.setActive([true, false]);
    t.setRange(0, 200);
    expect(t.drawn()).toBe(t.values()); // nothing re-mapped
    t.handlers().onUpdate({ y: yOf(150, 0, 200) });
    expect(t.values()[0]).toBeCloseTo(10); // replacement restored on cancellation
    t.handlers().onFinalize();
    await flushCallbacks();
    expect(alertCommit).not.toHaveBeenCalled();
    expect(orderCommit).not.toHaveBeenCalled();
    // Released, "alert" is back at its own value, not the dragged one.
    expect(t.values()).toEqual([10, 50]);
    expect(t.active()).toEqual([false, false]);
  });

  it("does not start a drag whose line is gone by the time it activates", async () => {
    const onCommit = jest.fn();
    const t = await setupDrag([{ value: 50, draggable: true, onCommit }]);
    t.handlers().onTouchesDown(
      { changedTouches: [{ x: 40, y: yOf(50) }] },
      { fail: jest.fn() },
    );
    // The lines are replaced before the finger has moved far enough to drag.
    await t.rerender({ lines: [] });
    t.setValues([]);
    expect(() => t.handlers().onStart({ y: yOf(60) })).not.toThrow();
    t.handlers().onUpdate({ y: yOf(60) });
    t.handlers().onFinalize();
    await flushCallbacks();
    expect(t.values()).toEqual([]);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not resume an invalidated drag when its original line returns", async () => {
    const onChange = jest.fn();
    const onCommit = jest.fn();
    const order = { id: "order", value: 50, draggable: true, onChange, onCommit };
    const alert = { id: "alert", value: 10, draggable: true };
    const t = await setupDrag([order]);
    t.dragTo(yOf(60));
    await flushCallbacks();
    onChange.mockClear();

    await t.rerender({ lines: [alert, order] });
    t.setValues([60, 50]);
    t.setActive([true, false]);
    t.handlers().onUpdate({ y: yOf(70) });
    expect(t.active()).toEqual([false, false]);
    expect(t.values()).toEqual([10, 50]);

    await t.rerender({ lines: [order] });
    t.setValues([50]);
    t.setActive([false]);
    t.handlers().onUpdate({ y: yOf(80) });
    t.handlers().onFinalize();
    await flushCallbacks();
    expect(t.values()).toEqual([50]);
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("cancels a reordered drag while the finger rests", async () => {
    const onCommit = jest.fn();
    const order = { id: "order", value: 50, draggable: true, onCommit };
    const alert = { id: "alert", value: 10, draggable: true };
    const t = await setupDrag([order]);
    t.dragTo(yOf(60));
    const replacement = [alert, order];
    await t.rerender({ lines: replacement });
    t.setValues([60, 50]);
    t.setActive([true, false]);

    // Drive the identity reaction as Reanimated does after the new lines arrive;
    // no gesture update is needed to release the old index.
    const [prepare, react] = jest.mocked(useAnimatedReaction).mock.calls
      .at(-2)!;
    const invalid = prepare();
    expect(invalid).toBe(true);
    react(invalid, false);
    expect(t.values()).toEqual([10, 50]);
    expect(t.drawn()).toEqual([10, 50]);
    expect(t.active()).toEqual([false, false]);
    expect(t.handlers().onFinalize).not.toThrow();
    await flushCallbacks();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("lets go, without throwing, when the dragged line is removed mid-drag", async () => {
    const onCommit = jest.fn();
    const t = await setupDrag([{ value: 50, draggable: true, onCommit }]);
    t.dragTo(yOf(60));
    await t.rerender({ lines: [] });
    t.setValues([]);
    t.setActive([]);
    t.setRange(0, 200);
    expect(() => t.handlers().onUpdate({ y: yOf(150, 0, 200) })).not.toThrow();
    expect(() => t.handlers().onFinalize()).not.toThrow();
    await flushCallbacks();
    expect(t.values()).toEqual([]);
    expect(t.active()).toEqual([]);
    expect(t.drawn()).toEqual([]);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not catch onChange up on release when the line ends where the finger set it", async () => {
    const onChange = jest.fn();
    const t = await setupDrag([{ value: 50, draggable: true, onChange }]);
    t.dragTo(yOf(60));
    t.handlers().onUpdate({ y: yOf(70) });
    t.handlers().onFinalize();
    await flushCallbacks();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[0][0]).toBeCloseTo(60);
    expect(onChange.mock.calls[1][0]).toBeCloseTo(70);
  });

  it("does not take over a line that replaced the grabbed one before the drag started", async () => {
    const onChange = jest.fn();
    const onCommit = jest.fn();
    const order = {
      id: "order",
      value: 50,
      draggable: true,
      onChange,
      onCommit,
    };
    const alert = {
      id: "alert",
      value: 50,
      draggable: true,
      onChange,
      onCommit,
    };
    const t = await setupDrag([order]);
    t.handlers().onTouchesDown(
      { changedTouches: [{ x: 40, y: yOf(50) }] },
      { fail: jest.fn() },
    );
    // "alert" takes the grabbed index before the finger has moved far enough.
    await t.rerender({ lines: [alert] });
    t.handlers().onStart({ y: yOf(60) });
    expect(t.active()).toEqual([false]);
    // Even if the grabbed line comes back, a drag that never started moves nothing.
    await t.rerender({ lines: [order] });
    t.handlers().onUpdate({ y: yOf(70) });
    t.handlers().onFinalize();
    await flushCallbacks();
    expect(t.values()).toEqual([50]);
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("watches the drawn value for onDragIn / onDragOut", async () => {
    const lines: ReferenceLine[] = [
      { value: 50, draggable: true, onDragOut: () => {} },
    ];
    const t = await setupDrag(lines);
    // The final reaction watches onDragIn / onDragOut.
    const [prepare] = jest
      .mocked(useAnimatedReaction)
      .mock.calls.at(-1)!;
    t.dragTo(TOP); // the finger sets 100, the range's top
    t.setRange(0, 90); // the range shrinks under the still finger
    expect(prepare()).toEqual([false]); // drawn at the top edge: not out
    expect(t.values()[0]).toBe(100);
    expect(t.drawn()[0]).toBe(90);
  });

  it("settles the range under a still finger when onChange drives the line's value", async () => {
    // The engine's own tick fits the data, the line's controlled `value` (written
    // back from onChange) and the value the finger set, as LiveChart does.
    let prop = 98;
    const t = await setupDrag([
      { value: 98, draggable: true, onChange: (v) => (prop = v) },
    ]);
    const state: EngineTickMutable = {
      displayValue: 95,
      displayMin: 0,
      displayMax: 1,
      displayWindow: 30,
      timestamp: 1000,
      liveEdge: 0,
      edgeValue: 0,
      extremaMinValue: NaN,
      extremaMaxValue: NaN,
      extremaMinTime: NaN,
      extremaMaxTime: NaN,
    };
    const frame = (snap = false) => {
      tickLiveChartEngineFrame(state, {
        dt: 1000 / 60,
        canvasWidth: 400,
        canvasHeight: 300,
        timeWindow: 30,
        smoothing: 0.08,
        exaggerate: false,
        referenceValue: undefined,
        referenceValues: [prop, t.values()[0]],
        targetValue: 95,
        points: [
          { time: 990, value: 90 },
          { time: 1000, value: 100 },
        ],
        nowSeconds: 1000,
        nowOverride: 1000,
        snap,
      });
      t.setRange(state.displayMin, state.displayMax);
    };
    frame(true);
    t.dragTo(TOP); // and hold it at the top edge
    for (let k = 0; k < 120; k++) {
      frame();
      t.drawn();
      await flushCallbacks();
    }
    const settled = state.displayMax;
    for (let k = 0; k < 60; k++) {
      frame();
      await flushCallbacks();
    }
    expect(state.displayMax).toBe(settled);
    expect(settled).toBeLessThan(105);
    expect(yOf(t.drawn()[0], state.displayMin, state.displayMax)).toBeCloseTo(
      TOP,
    );
  });

  it("retains the recognizer through controlled updates and dispatches current callbacks", async () => {
    const oldChange = jest.fn();
    const newChange = jest.fn();
    const newCommit = jest.fn();
    const t = await setupDrag([{ id: "order", value: 50, draggable: true, onChange: oldChange }]);
    const original = t.handlers();
    t.dragTo(yOf(55));
    await flushCallbacks();
    expect(oldChange).toHaveBeenLastCalledWith(55);

    await t.rerender({ lines: [{
      id: "order", value: 55, draggable: true, snap: 10,
      onChange: newChange, onCommit: newCommit,
    }] });
    expect(t.handlers()).toBe(original);
    original.onUpdate({ y: yOf(74) });
    original.onFinalize();
    await flushCallbacks();
    expect(newChange).toHaveBeenLastCalledWith(70);
    expect(newCommit).toHaveBeenLastCalledWith(70);
    expect(oldChange).toHaveBeenCalledTimes(1);
  });

  it("is inert for a static chart (enabled = false)", async () => {
    const { result } = await setup([{ value: 50, draggable: true }], false);
    expect(result.current).toBeTruthy();
  });
});
