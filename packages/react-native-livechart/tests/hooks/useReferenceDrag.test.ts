import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { useReferenceDrag } from "../../src/hooks/useReferenceDrag";
import type { ReferenceLine } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

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

async function setup(
  lines: ReferenceLine[],
  enabled = true,
  canvasHeight = 300,
) {
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

  it("pins a line far above the visible range to the top edge, where it stays grabbable", async () => {
    // 0–100 visible: 200 projects well above the canvas (a negative Y).
    const { result } = await setup([{ value: 200, draggable: true }]);
    expect(result.current.hitTest(40, DEFAULT_PADDING.top)).toBe(true);
  });

  it("pins a line far below the visible range to the bottom edge", async () => {
    const { result } = await setup([{ value: -100, draggable: true }]);
    expect(result.current.hitTest(40, 300 - DEFAULT_PADDING.bottom)).toBe(true);
  });

  it("grabs nothing on a canvas with no plot height", async () => {
    // Exactly as tall as its padding: a pinned handle would sit on the top edge.
    const height = DEFAULT_PADDING.top + DEFAULT_PADDING.bottom;
    const flat = await setup([{ value: 50, draggable: true }], true, height);
    expect(flat.result.current.hitTest(40, DEFAULT_PADDING.top)).toBe(false);
    const unmeasured = await setup([{ value: 50, draggable: true }], true, 0);
    expect(unmeasured.result.current.hitTest(40, 0)).toBe(false);
  });

  it("is inert for a static chart (enabled = false)", async () => {
    const { result } = await setup([{ value: 50, draggable: true }], false);
    expect(result.current).toBeTruthy();
  });
});
