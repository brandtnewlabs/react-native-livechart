import { useState } from "react";

import type { LayoutChangeEvent } from "react-native";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";

/**
 * Track canvas dimensions via `onLayout` and sync them into engine shared values.
 * Returns `{ layoutHeight, onLayout }` — pass `onLayout` to the container View
 * and use `layoutHeight` for conditional rendering (e.g. minimum height guards).
 */
export function useCanvasLayout(engine: ChartEngineLayout) {
  const [layoutHeight, setLayoutHeight] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    engine.canvasWidth.set(width);
    engine.canvasHeight.set(height);
    setLayoutHeight(height);
  };

  return { layoutHeight, onLayout } as const;
}
