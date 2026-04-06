import { useCallback, useState } from "react";

import type { ChartEngineLayout } from "../useLivelineEngine";
import type { LayoutChangeEvent } from "react-native";

export function useCanvasLayout(engine: ChartEngineLayout) {
  const [layoutHeight, setLayoutHeight] = useState(0);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      engine.canvasWidth.value = width;
      engine.canvasHeight.value = height;
      setLayoutHeight(height);
    },
    [engine.canvasWidth, engine.canvasHeight],
  );

  return { layoutHeight, onLayout } as const;
}
