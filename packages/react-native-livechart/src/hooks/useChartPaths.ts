import { Skia, type SkPath } from "@shopify/react-native-skia";
import { useRef } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { SingleEngineState } from "../core/useLiveChartEngine";
import { buildLinePoints, type ChartPadding } from "../draw/line";
import { drawSpline, makeSplineScratch } from "../math/spline";
import { blendPtsY, squigglifyPts } from "../math/squiggly";
import { usePathBuilder } from "./usePathBuilder";

/**
 * Builds the `linePath` / `fillPath` with `Skia.PathBuilder`s reused across
 * frames (one per curve, held in a SharedValue) and finalized with `detach()` —
 * which returns a fresh immutable `SkPath` each frame and resets the builder.
 * The fresh reference makes Reanimated notify subscribers (re-record + repaint)
 * without the two-SkPath ping-pong the mutable-path pool needed.
 *
 * The flat point buffer still ping-pongs (ptsA/ptsB) so the intermediate
 * `flatPts` derived value changes reference each frame and re-runs linePath /
 * fillPath.
 */
export function useChartPaths(
  engine: SingleEngineState,
  padding: ChartPadding,
  morphT?: SharedValue<number>,
) {
  const lineBuilder = usePathBuilder();
  const fillBuilder = usePathBuilder();

  const cacheRef = useRef<{
    emptyPath: SkPath;
    ptsA: number[];
    ptsB: number[];
    ptsTick: boolean;
    scratch: ReturnType<typeof makeSplineScratch>;
  } | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = {
      emptyPath: Skia.Path.Make(),
      ptsA: [] as number[],
      ptsB: [] as number[],
      ptsTick: false,
      scratch: makeSplineScratch(),
    };
  }

  const flatPts = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.ptsTick = !cache.ptsTick;
    const buf = cache.ptsTick ? cache.ptsA : cache.ptsB;
    const realPts = buildLinePoints(
      engine.data.get(),
      engine.displayValue.get(),
      engine.timestamp.get(),
      engine.displayWindow.get(),
      engine.displayMin.get(),
      engine.displayMax.get(),
      engine.canvasWidth.get(),
      engine.canvasHeight.get(),
      padding,
      buf,
    );

    // Skip blending when fully revealed or no morphT provided
    const t = morphT?.get() ?? 1;
    if (t >= 1 || realPts.length === 0) return realPts;

    // Compute squiggly Y values at the same X positions as the real line
    const centerY =
      (engine.canvasHeight.get() - padding.bottom + padding.top) / 2;
    const squigglyPts = squigglifyPts(realPts, engine.timestamp.get(), centerY);

    // Blend center-out: centre of chart reveals first, edges last
    return blendPtsY(
      squigglyPts,
      realPts,
      t,
      padding,
      engine.canvasWidth.get(),
    );
  });

  const linePath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    const pts = flatPts.get();
    const n = pts.length >> 1;
    if (n < 2) return cache.emptyPath;
    const b = lineBuilder.value;
    b.moveTo(pts[0], pts[1]);
    drawSpline(b, pts, cache.scratch);
    return b.detach();
  });

  const fillPath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    const pts = flatPts.get();
    const n = pts.length >> 1;
    if (n < 2) return cache.emptyPath;
    const b = fillBuilder.value;
    b.moveTo(pts[0], pts[1]);
    drawSpline(b, pts, cache.scratch);
    const bottom = engine.canvasHeight.get() - padding.bottom;
    b.lineTo(pts[(n - 1) * 2], bottom);
    b.lineTo(pts[0], bottom);
    b.close();
    return b.detach();
  });

  return { linePath, fillPath } as const;
}
