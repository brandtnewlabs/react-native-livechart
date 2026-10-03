import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { computeScrubDotY } from "../../src/hooks/crosshairShared";
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
    useDerivedValue: (updater: () => unknown) => ({ get: updater }),
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

  it.each([120, -20])("grabs an off-axis line at the pinned edge (value=%s)", async (value) => {
    const { result } = await setup([
      { value, draggable: true, grabRange: [0, 80] },
    ]);
    const y = value > 100 ? DEFAULT_PADDING.top : 300 - DEFAULT_PADDING.bottom;
    expect(result.current.hitTest(40, y)).toBe(true);
    expect(result.current.hitTest(200, y)).toBe(false);
  });

  it("does not grab lines before the canvas has a drawable height", async () => {
    const { result } = await setup([
      { value: 120, draggable: true, grabRange: [0, 80] },
    ], true, 0);
    expect(result.current.hitTest(40, DEFAULT_PADDING.top)).toBe(false);
  });

  it("is inert for a static chart (enabled = false)", async () => {
    const { result } = await setup([{ value: 50, draggable: true }], false);
    expect(result.current).toBeTruthy();
  });
});
