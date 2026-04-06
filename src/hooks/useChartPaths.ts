import { Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { buildLinePoints, type ChartPadding } from "../draw/line";
import { drawSpline } from "../math/spline";
import { blendPtsY, squigglifyPts } from "../math/squiggly";
import type { SingleEngineState } from "../useLivelineEngine";

export function useChartPaths(
  engine: SingleEngineState,
  padding: ChartPadding,
  morphT?: SharedValue<number>,
) {
  const flatPts = useDerivedValue(() => {
    const realPts = buildLinePoints(
      engine.data.value,
      engine.displayValue.value,
      engine.timestamp.value,
      engine.displayWindow.value,
      engine.displayMin.value,
      engine.displayMax.value,
      engine.canvasWidth.value,
      engine.canvasHeight.value,
      padding,
    );

    // Skip blending when fully revealed or no morphT provided
    const t = morphT?.value ?? 1;
    if (t >= 1 || realPts.length === 0) return realPts;

    // Compute squiggly Y values at the same X positions as the real line
    const centerY =
      (engine.canvasHeight.value - padding.bottom + padding.top) / 2;
    const squigglyPts = squigglifyPts(realPts, engine.timestamp.value, centerY);

    // Blend center-out: centre of chart reveals first, edges last
    return blendPtsY(
      squigglyPts,
      realPts,
      t,
      padding,
      engine.canvasWidth.value,
    );
  });

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
