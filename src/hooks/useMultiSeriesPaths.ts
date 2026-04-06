import { Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { MAX_MULTI_SERIES } from "../constants";
import { buildLinePoints, type ChartPadding } from "../draw/line";
import { drawSpline } from "../math/spline";
import type { MultiEngineState } from "../useLivelineEngine";

/**
 * One derived shared value holding up to `MAX_MULTI_SERIES` Skia paths (unused slots are empty paths).
 */
export function useMultiSeriesLinePaths(
  engine: MultiEngineState,
  padding: ChartPadding,
): SharedValue<ReturnType<typeof Skia.Path.Make>[]> {
  return useDerivedValue(() => {
    const s = engine.series.value;
    const displays = engine.displaySeriesValues.value;
    const out: ReturnType<typeof Skia.Path.Make>[] = [];
    for (let i = 0; i < MAX_MULTI_SERIES; i++) {
      if (i >= s.length) {
        out.push(Skia.Path.Make());
        continue;
      }
      const pts = buildLinePoints(
        s[i].data,
        displays[i] ?? s[i].value,
        engine.timestamp.value,
        engine.displayWindow.value,
        engine.displayMin.value,
        engine.displayMax.value,
        engine.canvasWidth.value,
        engine.canvasHeight.value,
        padding,
      );
      const path = Skia.Path.Make();
      const n = pts.length >> 1;
      if (n >= 2) {
        path.moveTo(pts[0], pts[1]);
        drawSpline(path, pts);
      }
      out.push(path);
    }
    return out;
  });
}
