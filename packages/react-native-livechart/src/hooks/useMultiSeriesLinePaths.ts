import { Skia, type SkPath } from "@shopify/react-native-skia";
import { useRef } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { MAX_MULTI_SERIES } from "../constants";
import type { MultiEngineState } from "../core/useLiveChartEngine";
import { buildLinePoints, type ChartPadding } from "../draw/line";
import {
  makeLineSimplifyScratch,
  simplifyLinePoints,
} from "../math/simplify";
import { drawSpline, makeSplineScratch } from "../math/spline";
import { usePathBuilders } from "./usePathBuilder";

/**
 * One derived shared value holding only the active series' Skia paths, capped at
 * `MAX_MULTI_SERIES`.
 *
 * Each visible series' path is built into a per-slot `Skia.PathBuilder` (reused
 * across frames via a SharedValue) and finalized with `detach()` — a fresh
 * immutable `SkPath` per frame, so `MultiSeriesStroke`'s per-slot
 * `useDerivedValue(() => paths.value[index])` repaints without the two-SkPath
 * ping-pong. Only active series allocate and publish a path.
 */
export function useMultiSeriesLinePaths(
  engine: MultiEngineState,
  padding: ChartPadding,
  activeSeriesCount = MAX_MULTI_SERIES,
  /** Shared screen-space simplification tolerance; a series can override it. */
  simplifyTolerance = 0,
): SharedValue<SkPath[]> {
  const builders = usePathBuilders(MAX_MULTI_SERIES);

  const poolRef = useRef<{
    empty: SkPath;
    ptsBuf: number[];
    simplifiedPts: number[];
    pathsA: SkPath[];
    pathsB: SkPath[];
    pathsTick: boolean;
    scratch: ReturnType<typeof makeSplineScratch>;
    simplifyScratch: ReturnType<typeof makeLineSimplifyScratch>;
  } | null>(null);
  if (poolRef.current === null) {
    poolRef.current = {
      empty: Skia.Path.Make(),
      ptsBuf: [] as number[],
      simplifiedPts: [] as number[],
      pathsA: [] as SkPath[],
      pathsB: [] as SkPath[],
      pathsTick: false,
      scratch: makeSplineScratch(),
      simplifyScratch: makeLineSimplifyScratch(),
    };
  }

  return useDerivedValue(() => {
    const pool = poolRef.current!;
    const slots = builders.value;
    const s = engine.series.get();
    const displays = engine.displaySeriesValues.get();
    pool.pathsTick = !pool.pathsTick;
    const out = pool.pathsTick ? pool.pathsA : pool.pathsB;
    out.length = 0;
    const count = Math.min(activeSeriesCount, s.length, MAX_MULTI_SERIES);
    for (let i = 0; i < count; i++) {
      const rawPts = buildLinePoints(
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
      const seriesTolerance = s[i].simplify ?? simplifyTolerance;
      const pts =
        Number.isFinite(seriesTolerance) && seriesTolerance > 0
          ? simplifyLinePoints(
              rawPts,
              seriesTolerance,
              pool.simplifiedPts,
              pool.simplifyScratch,
            )
          : rawPts;
      const n = pts.length >> 1;
      if (n >= 2) {
        const b = slots[i];
        b.moveTo(pts[0], pts[1]);
        // Straight polyline when this series opts into `curve: "linear"`.
        drawSpline(b, pts, pool.scratch, s[i].curve === "linear");
        out.push(b.detach());
      } else {
        out.push(pool.empty);
      }
    }
    return out;
  });
}
