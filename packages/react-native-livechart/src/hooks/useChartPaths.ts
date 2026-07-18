import { Skia, type SkPath } from "@shopify/react-native-skia";
import { useRef } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { SingleEngineState } from "../core/useLiveChartEngine";
import { buildLinePoints, type ChartPadding } from "../draw/line";
import { drawSpline, makeSplineScratch } from "../math/spline";
import { sampleThresholdYAt, thresholdSampleSpanX } from "../math/threshold";
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
  /** Loading squiggle wave amplitude (px) for the reveal morph. Default 14. */
  squiggleAmplitude = 14,
  /** Loading squiggle wave speed multiplier for the reveal morph. Default 1. */
  squiggleSpeed = 1,
  /** When set, build `thresholdFillPath` as the band between the line and this
   *  *time-varying* threshold — the split shader's evenly-spaced pixel-Y
   *  `samples[]` (so band geometry matches the shader exactly). Takes precedence
   *  over `thresholdY`, the constant (horizontal) case. */
  thresholdSamples?: SharedValue<number[]>,
) {
  const lineBuilder = usePathBuilder();
  const fillBuilder = usePathBuilder();
  const thresholdFillBuilder = usePathBuilder();

  const cacheRef = useRef<{
    emptyPath: SkPath;
    ptsA: number[];
    ptsB: number[];
    ptsTick: boolean;
    squigglePts: number[];
    morphA: number[];
    morphB: number[];
    morphTick: boolean;
    scratch: ReturnType<typeof makeSplineScratch>;
  } | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = {
      emptyPath: Skia.Path.Make(),
      ptsA: [] as number[],
      ptsB: [] as number[],
      ptsTick: false,
      squigglePts: [] as number[],
      morphA: [] as number[],
      morphB: [] as number[],
      morphTick: false,
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
    const squigglyPts = squigglifyPts(
      realPts,
      engine.timestamp.get(),
      centerY,
      squiggleAmplitude,
      squiggleSpeed,
      cache.squigglePts,
    );

    // Blend center-out: centre of chart reveals first, edges last
    cache.morphTick = !cache.morphTick;
    return blendPtsY(
      squigglyPts,
      realPts,
      t,
      padding,
      engine.canvasWidth.get(),
      cache.morphTick ? cache.morphA : cache.morphB,
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

  // Threshold-anchored fill: the same spline, closed along the threshold instead
  // of the baseline, so the band lies between the line and the threshold (the
  // profit/loss area). Painted with the split gradient/shader, the part above the
  // split shows the above-color and the part below shows the below-color.
  //
  // `thresholdPts` (a time-varying series) closes the band along that polyline,
  // right-to-left; otherwise `thresholdY` closes it at a single horizontal Y.
  const thresholdFillPath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    const pts = flatPts.get();
    const n = pts.length >> 1;
    if (n < 2) return cache.emptyPath;

    const tsamples = thresholdSamples?.get();
    if (tsamples && tsamples.length >= 2) {
      const b = thresholdFillBuilder.value;
      b.moveTo(pts[0], pts[1]);
      drawSpline(b, pts, cache.scratch, linear);
      // Band bottom = the SAMPLED threshold (identical to what the split shader
      // reads), pinned to the LINE's x-range. Because the geometry and the shader
      // use the same evenly-spaced, linearly-interpolated samples, a step riser
      // ramps the same way in both — no green/red sliver bleeds through — and the
      // x-range pin keeps the band closing with clean vertical sides (no wedge).
      const leftX = pts[0];
      const rightX = pts[(n - 1) * 2];
      const count = tsamples.length;
      // The samples live on the time-anchored, gliding grid — interpolate them
      // across that span (same as the shader), not the static plot edges.
      const [x0, x1] = thresholdSampleSpanX(
        engine.timestamp.get(),
        engine.displayWindow.get(),
        padding.left,
        engine.canvasWidth.get() - padding.right,
        count,
      );
      const step = (x1 - x0) / (count - 1);
      b.lineTo(rightX, sampleThresholdYAt(tsamples, x0, x1, rightX));
      for (let i = count - 1; i >= 0; i--) {
        const sx = x0 + step * i;
        if (sx > leftX && sx < rightX) b.lineTo(sx, tsamples[i]);
      }
      b.lineTo(leftX, sampleThresholdYAt(tsamples, x0, x1, leftX));
      b.close();
      return b.detach();
    }

    if (!thresholdY) return cache.emptyPath;
    const yT = thresholdY.get();
    if (!Number.isFinite(yT)) return cache.emptyPath;
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
