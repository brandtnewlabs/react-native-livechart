import { Skia } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import { buildLinePoints, type ChartPadding } from "../draw/line";
import { drawSpline } from "../math/spline";
import type { EngineState } from "../useLivelineEngine";

export function useChartPaths(engine: EngineState, padding: ChartPadding) {
  const flatPts = useDerivedValue(() =>
    buildLinePoints(
      engine.data.value,
      engine.displayValue.value,
      engine.timestamp.value,
      engine.displayWindow.value,
      engine.displayMin.value,
      engine.displayMax.value,
      engine.canvasWidth.value,
      engine.canvasHeight.value,
      padding,
    ),
  );

  const linePath = useDerivedValue(() => {
    const pts = flatPts.value;
    const path = Skia.Path.Make();
    const n = pts.length >> 1;
    if (n < 2) return path;
    path.moveTo(pts[0], pts[1]);
    drawSpline(path, pts);
    return path;
  });

  const fillPath = useDerivedValue(() => {
    const pts = flatPts.value;
    const path = Skia.Path.Make();
    const n = pts.length >> 1;
    if (n < 2) return path;
    path.moveTo(pts[0], pts[1]);
    drawSpline(path, pts);
    const bottom = engine.canvasHeight.value - padding.bottom;
    path.lineTo(pts[(n - 1) * 2], bottom);
    path.lineTo(pts[0], bottom);
    path.close();
    return path;
  });

  return { linePath, fillPath } as const;
}
