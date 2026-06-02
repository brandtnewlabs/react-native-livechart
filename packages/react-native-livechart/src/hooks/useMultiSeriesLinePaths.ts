import { Skia } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { MAX_MULTI_SERIES } from "../constants";
import type { MultiEngineState } from "../core/useLiveChartEngine";
import { buildLinePoints, type ChartPadding } from "../draw/line";
import { drawSpline } from "../math/spline";

/**
 * One derived shared value holding up to `MAX_MULTI_SERIES` Skia paths (unused slots are empty paths).
 *
 * Each slot ping-pongs between two persistent `SkPath`s so `MultiSeriesStroke`'s
 * per-slot `useDerivedValue(() => paths.value[index])` sees a fresh reference each
 * tick (otherwise Reanimated's setter short-circuits and Skia never repaints).
 * No new JSI-backed `SkPath` is allocated per frame. See {@link useChartPaths}
 * for the memory rationale.
 */
export function useMultiSeriesLinePaths(
  engine: MultiEngineState,
  padding: ChartPadding,
): SharedValue<ReturnType<typeof Skia.Path.Make>[]> {
  const pool = useMemo(() => {
    const a: ReturnType<typeof Skia.Path.Make>[] = [];
    const b: ReturnType<typeof Skia.Path.Make>[] = [];
    for (let i = 0; i < MAX_MULTI_SERIES; i++) {
      a.push(Skia.Path.Make());
      b.push(Skia.Path.Make());
    }
    return { a, b, tick: false };
  }, []);

  return useDerivedValue(() => {
    pool.tick = !pool.tick;
    const slots = pool.tick ? pool.a : pool.b;
    const s = engine.series.value;
    const displays = engine.displaySeriesValues.value;
    const out: ReturnType<typeof Skia.Path.Make>[] = [];
    for (let i = 0; i < MAX_MULTI_SERIES; i++) {
      const path = slots[i];
      path.reset();
      if (i >= s.length) {
        out.push(path);
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
