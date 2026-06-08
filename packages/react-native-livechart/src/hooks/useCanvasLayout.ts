import { useState } from "react";

import type { LayoutChangeEvent } from "react-native";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";

/**
 * Track canvas dimensions via `onLayout` and sync them into engine shared values.
 * Returns `{ layoutWidth, layoutHeight, onLayout }` — pass `onLayout` to the
 * container View and use dimensions for conditional rendering or gradient coordinates.
 */
export function useCanvasLayout(engine: ChartEngineLayout) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [layoutHeight, setLayoutHeight] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    engine.canvasWidth.set(width);
    engine.canvasHeight.set(height);
    setLayoutWidth(width);
    setLayoutHeight(height);
  };

  return { layoutWidth, layoutHeight, onLayout } as const;
}
