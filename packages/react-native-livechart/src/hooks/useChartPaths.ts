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
  /** When set, also build `thresholdFillPath` — the band between the line and this
   *  pixel-Y, closed at the threshold instead of the chart baseline. */
  thresholdY?: SharedValue<number>,
  /** Draw the line/fill as a straight polyline instead of the monotone cubic. */
  linear = false,
  /**
   * Value at the visible window's right edge (engine `edgeValue`). With
   * `followViewEdge`, the line's right-edge tip uses this instead of the live
   * `displayValue` — so while time-scrolled the line ends at the last visible
   * price rather than dropping to the (off-screen) live value.
   */
  edgeValue?: SharedValue<number>,
  followViewEdge = false,
) {
  const lineBuilder = usePathBuilder();
  const fillBuilder = usePathBuilder();
  const thresholdFillBuilder = usePathBuilder();

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
    // While scrolled back with `followViewEdge`, tip the line at the view-edge
    // price (engine `edgeValue`) instead of the live value — otherwise the line
    // drops from the last visible point to the off-screen live value at the edge.
    const tipValue =
      followViewEdge && edgeValue ? edgeValue.get() : engine.displayValue.get();
    const realPts = buildLinePoints(
      engine.data.get(),
      tipValue,
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
    drawSpline(b, pts, cache.scratch, linear);
    return b.detach();
  });

  const fillPath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    const pts = flatPts.get();
    const n = pts.length >> 1;
    if (n < 2) return cache.emptyPath;
    const b = fillBuilder.value;
    b.moveTo(pts[0], pts[1]);
    drawSpline(b, pts, cache.scratch, linear);
    const bottom = engine.canvasHeight.get() - padding.bottom;
    b.lineTo(pts[(n - 1) * 2], bottom);
    b.lineTo(pts[0], bottom);
    b.close();
    return b.detach();
  });

  // Threshold-anchored fill: the same spline, closed at `thresholdY` instead of the
  // baseline, so the band lies between the line and the threshold (the profit/loss
  // area). Painted with the hard-split vertical gradient, the part above the split
  // shows the above-color and the part below shows the below-color.
  const thresholdFillPath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    if (!thresholdY) return cache.emptyPath;
    const yT = thresholdY.get();
    const pts = flatPts.get();
    const n = pts.length >> 1;
    if (n < 2 || !Number.isFinite(yT)) return cache.emptyPath;
    const b = thresholdFillBuilder.value;
    b.moveTo(pts[0], pts[1]);
    drawSpline(b, pts, cache.scratch, linear);
    b.lineTo(pts[(n - 1) * 2], yT);
    b.lineTo(pts[0], yT);
    b.close();
    return b.detach();
  });

  return { linePath, fillPath, thresholdFillPath } as const;
}
