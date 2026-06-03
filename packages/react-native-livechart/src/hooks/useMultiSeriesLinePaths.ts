import { Skia, type SkPath } from "@shopify/react-native-skia";
import { useRef } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { MAX_MULTI_SERIES } from "../constants";
import type { MultiEngineState } from "../core/useLiveChartEngine";
import { buildLinePoints, type ChartPadding } from "../draw/line";
import { drawSpline, makeSplineScratch } from "../math/spline";

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
  const poolRef = useRef<{
    a: SkPath[];
    b: SkPath[];
    tick: boolean;
    ptsBuf: number[];
    scratch: ReturnType<typeof makeSplineScratch>;
  } | null>(null);
  if (poolRef.current === null) {
    const a: SkPath[] = [];
    const b: SkPath[] = [];
    for (let i = 0; i < MAX_MULTI_SERIES; i++) {
      a.push(Skia.Path.Make());
      b.push(Skia.Path.Make());
    }
    // One point buffer + spline scratch, reused across slots (built sequentially)
    // and across frames — no per-frame, per-series array allocation.
    poolRef.current = { a, b, tick: false, ptsBuf: [] as number[], scratch: makeSplineScratch() };
  }

  return useDerivedValue(() => {
    const pool = poolRef.current!;
    pool.tick = !pool.tick;
    const slots = pool.tick ? pool.a : pool.b;
    const s = engine.series.get();
    const displays = engine.displaySeriesValues.get();
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
        engine.timestamp.get(),
        engine.displayWindow.get(),
        engine.displayMin.get(),
        engine.displayMax.get(),
        engine.canvasWidth.get(),
        engine.canvasHeight.get(),
        padding,
        pool.ptsBuf,
      );
      const n = pts.length >> 1;
      if (n >= 2) {
        path.moveTo(pts[0], pts[1]);
        drawSpline(path, pts, pool.scratch);
      }
      out.push(path);
    }
    return out;
  });
}
