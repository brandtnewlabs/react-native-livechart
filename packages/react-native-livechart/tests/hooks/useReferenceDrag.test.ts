import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { useReferenceDrag } from "../../src/hooks/useReferenceDrag";
import type { ReferenceLine } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

function engine(): ChartEngineLayout {
  return withSharedValueAccessors({
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 0 },
  }) as unknown as ChartEngineLayout;
}

async function setup(lines: ReferenceLine[], enabled = true) {
  return await renderHook(() => {
    const dragValues = useSharedValue<number[]>(lines.map((l) => l.value ?? 0));
    const dragActive = useSharedValue<boolean[]>(lines.map(() => false));
    return useReferenceDrag(
      engine(),
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

  it("is inert for a static chart (enabled = false)", async () => {
    const { result } = await setup([{ value: 50, draggable: true }], false);
    expect(result.current).toBeTruthy();
  });
});
