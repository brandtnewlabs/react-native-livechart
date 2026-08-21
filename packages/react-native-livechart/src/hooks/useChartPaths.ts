import { Skia, type SkPath } from "@shopify/react-native-skia";
import { useRef } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type {
  ChartEngineEdge,
  ChartEngineScroll,
  SingleEngineState,
} from "../core/useLiveChartEngine";
import { buildLinePoints, type ChartPadding } from "../draw/line";
import { buildLineGapSegmentRanges } from "../draw/lineGap";
import {
  makeLineSimplifyScratch,
  simplifyLinePoints,
} from "../math/simplify";
import { drawSpline, makeSplineScratch } from "../math/spline";
import { sampleThresholdYAt, thresholdSampleSpanX } from "../math/threshold";
import { blendPtsY, squigglifyPts } from "../math/squiggly";
import { usePathBuilder } from "./usePathBuilder";
import type { CandleGap } from "../types";

/** Selects the synthetic right-edge line tip without coupling chart geometry
 * to badge or live-indicator presentation options. */
export function resolveLineTipValue(
  displayValue: number,
  edgeValue: number,
  viewEnd: number | null,
): number {
  "worklet";
  return viewEnd == null ? displayValue : edgeValue;
}

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
  engine: SingleEngineState & ChartEngineScroll & ChartEngineEdge,
  padding: ChartPadding,
  morphT?: SharedValue<number>,
  /** When set, also build `thresholdFillPath` — the band between the line and this
   *  pixel-Y, closed at the threshold instead of the chart baseline. */
  thresholdY?: SharedValue<number>,
  /** Draw the line/fill as a straight polyline instead of the monotone cubic. */
  linear = false,
  /** Loading squiggle wave amplitude (px) for the reveal morph. Default 14. */
  squiggleAmplitude = 14,
  /** Loading squiggle wave speed multiplier for the reveal morph. Default 1. */
  squiggleSpeed = 1,
  /** When set, build `thresholdFillPath` as the band between the line and this
   *  *time-varying* threshold — the split shader's evenly-spaced pixel-Y
   *  `samples[]` (so band geometry matches the shader exactly). Takes precedence
   *  over `thresholdY`, the constant (horizontal) case. */
  thresholdSamples?: SharedValue<number[]>,
  /** Screen-space path simplification tolerance in pixels. `0` disables it. */
  simplifyTolerance = 0,
  /** Explicit empty intervals that split line and fill geometry. */
  lineGaps: CandleGap[] = [],
) {
  const lineBuilder = usePathBuilder();
  const fillBuilder = usePathBuilder();
  const thresholdFillBuilder = usePathBuilder();

  const cacheRef = useRef<{
    emptyPath: SkPath;
    ptsA: number[];
    ptsB: number[];
    rawPts: number[];
    rangesA: number[];
    rangesB: number[];
    gapXs: number[];
    rangesTick: boolean;
    ptsTick: boolean;
    squigglePts: number[];
    morphA: number[];
    morphB: number[];
    morphTick: boolean;
    scratch: ReturnType<typeof makeSplineScratch>;
    simplifyScratch: ReturnType<typeof makeLineSimplifyScratch>;
  } | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = {
      emptyPath: Skia.Path.Make(),
      ptsA: [] as number[],
      ptsB: [] as number[],
      rawPts: [] as number[],
      rangesA: [] as number[],
      rangesB: [] as number[],
      gapXs: [] as number[],
      rangesTick: false,
      ptsTick: false,
      squigglePts: [] as number[],
      morphA: [] as number[],
      morphB: [] as number[],
      morphTick: false,
      scratch: makeSplineScratch(),
      simplifyScratch: makeLineSimplifyScratch(),
    };
  }

  const flatPts = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.ptsTick = !cache.ptsTick;
    const buf = cache.ptsTick ? cache.ptsA : cache.ptsB;
    // A historical window must end at its own right-edge price. Badge and
    // live-indicator options affect overlays only; they must not distort the
    // plotted series by connecting history to the off-screen live value.
    const tipValue = resolveLineTipValue(
      engine.displayValue.get(),
      engine.edgeValue.get(),
      engine.viewEnd.get(),
    );
    const simplify =
      Number.isFinite(simplifyTolerance) && simplifyTolerance > 0
        ? simplifyTolerance
        : 0;
    const now = engine.timestamp.get();
    const windowSecs = engine.displayWindow.get();
    const canvasWidth = engine.canvasWidth.get();
    const realPts = buildLinePoints(
      engine.data.get(),
      tipValue,
      now,
      windowSecs,
      engine.displayMin.get(),
      engine.displayMax.get(),
      canvasWidth,
      engine.canvasHeight.get(),
      padding,
      simplify > 0 ? cache.rawPts : buf,
      // Only a live-following chart may extend the line to the right edge; a
      // parked (scrolled-back / overscrolled) window ends at its last real
      // point rather than fabricating a flat line into dataless space.
      engine.viewEnd.get() != null,
    );
    const chartWidth = canvasWidth - padding.left - padding.right;
    const absoluteXOffset =
      windowSecs > 0 ? (now - windowSecs) * (chartWidth / windowSecs) : 0;
    const renderPts =
      simplify > 0
        ? simplifyLinePoints(
            realPts,
            simplify,
            buf,
            cache.simplifyScratch,
            absoluteXOffset,
          )
        : realPts;

    // Skip blending when fully revealed or no morphT provided
    const t = morphT?.get() ?? 1;
    if (t >= 1 || renderPts.length === 0) return renderPts;

    // Compute squiggly Y values at the same X positions as the real line
    const centerY =
      (engine.canvasHeight.get() - padding.bottom + padding.top) / 2;
    const squigglyPts = squigglifyPts(
      renderPts,
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
      renderPts,
      t,
      padding,
      engine.canvasWidth.get(),
      cache.morphTick ? cache.morphA : cache.morphB,
    );
  });

  const segmentRanges = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.rangesTick = !cache.rangesTick;
    const ranges = cache.rangesTick ? cache.rangesA : cache.rangesB;
    const windowSecs = engine.displayWindow.get();
    const canvasWidth = engine.canvasWidth.get();
    return buildLineGapSegmentRanges(
      flatPts.get(),
      engine.data.get(),
      lineGaps,
      engine.timestamp.get() - windowSecs,
      windowSecs,
      padding.left,
      canvasWidth - padding.left - padding.right,
      ranges,
      cache.gapXs,
    );
  });

  const linePath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    const pts = flatPts.get();
    const n = pts.length >> 1;
    if (n < 2) return cache.emptyPath;
    const b = lineBuilder.value;
    const ranges = segmentRanges.get();
    if (ranges.length === 0) return cache.emptyPath;
    for (let i = 0; i < ranges.length; i += 2) {
      const start = ranges[i];
      const end = ranges[i + 1];
      b.moveTo(pts[start * 2], pts[start * 2 + 1]);
      drawSpline(b, pts, cache.scratch, linear, start, end);
    }
    return b.detach();
  });

  const fillPath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    const pts = flatPts.get();
    const n = pts.length >> 1;
    if (n < 2) return cache.emptyPath;
    const b = fillBuilder.value;
    const ranges = segmentRanges.get();
    if (ranges.length === 0) return cache.emptyPath;
    const bottom = engine.canvasHeight.get() - padding.bottom;
    for (let i = 0; i < ranges.length; i += 2) {
      const start = ranges[i];
      const end = ranges[i + 1];
      const first = start * 2;
      const last = (end - 1) * 2;
      b.moveTo(pts[first], pts[first + 1]);
      drawSpline(b, pts, cache.scratch, linear, start, end);
      b.lineTo(pts[last], bottom);
      b.lineTo(pts[first], bottom);
      b.close();
    }
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
    const ranges = segmentRanges.get();
    if (ranges.length === 0) return cache.emptyPath;

    const tsamples = thresholdSamples?.get();
    if (tsamples && tsamples.length >= 2) {
      const b = thresholdFillBuilder.value;
      // Band bottom = the SAMPLED threshold (identical to what the split shader
      // reads), pinned to the LINE's x-range. Because the geometry and the shader
      // use the same evenly-spaced, linearly-interpolated samples, a step riser
      // ramps the same way in both — no green/red sliver bleeds through — and the
      // x-range pin keeps the band closing with clean vertical sides (no wedge).
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
      for (let range = 0; range < ranges.length; range += 2) {
        const start = ranges[range];
        const end = ranges[range + 1];
        const first = start * 2;
        const last = (end - 1) * 2;
        const leftX = pts[first];
        const rightX = pts[last];
        b.moveTo(leftX, pts[first + 1]);
        drawSpline(b, pts, cache.scratch, linear, start, end);
        b.lineTo(rightX, sampleThresholdYAt(tsamples, x0, x1, rightX));
        for (let i = count - 1; i >= 0; i--) {
          const sx = x0 + step * i;
          if (sx > leftX && sx < rightX) b.lineTo(sx, tsamples[i]);
        }
        b.lineTo(leftX, sampleThresholdYAt(tsamples, x0, x1, leftX));
        b.close();
      }
      return b.detach();
    }

    if (!thresholdY) return cache.emptyPath;
    const yT = thresholdY.get();
    if (!Number.isFinite(yT)) return cache.emptyPath;
    const b = thresholdFillBuilder.value;
    for (let i = 0; i < ranges.length; i += 2) {
      const start = ranges[i];
      const end = ranges[i + 1];
      const first = start * 2;
      const last = (end - 1) * 2;
      b.moveTo(pts[first], pts[first + 1]);
      drawSpline(b, pts, cache.scratch, linear, start, end);
      b.lineTo(pts[last], yT);
      b.lineTo(pts[first], yT);
      b.close();
    }
    return b.detach();
  });

  return { linePath, fillPath, thresholdFillPath } as const;
}
