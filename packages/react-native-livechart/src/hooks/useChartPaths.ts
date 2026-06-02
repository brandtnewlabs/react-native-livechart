import { Skia } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { SingleEngineState } from "../core/useLiveChartEngine";
import { buildLinePoints, type ChartPadding } from "../draw/line";
import { drawSpline, makeSplineScratch } from "../math/spline";
import { blendPtsY, squigglifyPts } from "../math/squiggly";

/**
 * Persistent `linePath` / `fillPath` `SkPath`s that are **mutated in place** each frame.
 *
 * Why not `useDerivedValue(() => Skia.Path.Make())`? Each call would allocate a brand-new
 * JSI-backed `SkPath`, and on iOS the native GC lags the JS GC under a steady firehose —
 * resident memory climbs steadily for as long as the chart is mounted. Here we allocate
 * two paths per curve once and ping-pong the reference each frame so Reanimated's
 * value-equality early-return still fires its subscribers (i.e. the Skia reanimated
 * container re-records and repaints).
 */
export function useChartPaths(
  engine: SingleEngineState,
  padding: ChartPadding,
  morphT?: SharedValue<number>,
) {
  // Two persistent paths per curve; ping-pong so the returned reference changes
  // every frame, which keeps Reanimated's setter from short-circuiting the notify.
  const cache = useMemo(
    () => ({
      lineA: Skia.Path.Make(),
      lineB: Skia.Path.Make(),
      fillA: Skia.Path.Make(),
      fillB: Skia.Path.Make(),
      tick: false,
      // Ping-pong point buffers: reused across frames but the returned reference
      // still alternates, so Reanimated keeps notifying linePath/fillPath.
      ptsA: [] as number[],
      ptsB: [] as number[],
      ptsTick: false,
      scratch: makeSplineScratch(),
    }),
    [],
  );

  const flatPts = useDerivedValue(() => {
    cache.ptsTick = !cache.ptsTick;
    const buf = cache.ptsTick ? cache.ptsA : cache.ptsB;
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
      buf,
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
    cache.tick = !cache.tick;
    const path = cache.tick ? cache.lineA : cache.lineB;
    path.reset();
    const n = pts.length >> 1;
    if (n < 2) return path;
    path.moveTo(pts[0], pts[1]);
    drawSpline(path, pts, cache.scratch);
    return path;
  });

  const fillPath = useDerivedValue(() => {
    const pts = flatPts.value;
    // Use the same tick flag flipped by linePath — flipping again here would
    // keep both paths in sync, so just read the current parity.
    const path = cache.tick ? cache.fillA : cache.fillB;
    path.reset();
    const n = pts.length >> 1;
    if (n < 2) return path;
    path.moveTo(pts[0], pts[1]);
    drawSpline(path, pts, cache.scratch);
    const bottom = engine.canvasHeight.value - padding.bottom;
    path.lineTo(pts[(n - 1) * 2], bottom);
    path.lineTo(pts[0], bottom);
    path.close();
    return path;
  });

  return { linePath, fillPath } as const;
}
