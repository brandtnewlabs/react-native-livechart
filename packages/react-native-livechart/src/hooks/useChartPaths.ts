import { buildLineFillPaths } from "../draw/lineFillPaths";
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
import { makeLineSimplifyScratch, simplifyLinePoints } from "../math/simplify";
import { makeSplineScratch } from "../math/spline";
import { thresholdSampleSpanX } from "../math/threshold";
import {
  blendPtsY,
  squiggleClockSeconds,
  squigglifyPts,
} from "../math/squiggly";
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
 * geometry updates (one per curve, held in a SharedValue) and finalized with `detach()` —
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
    lastPts: number[] | null;
    lastRanges: number[] | null;
    lastLinear: boolean;
    lastBottom: number;
    lineOutput: SkPath | null;
    fillOutput: SkPath | null;
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
      lastPts: null,
      lastRanges: null,
      lastLinear: false,
      lastBottom: NaN,
      lineOutput: null,
      fillOutput: null,
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
    // Same wall clock as the loading shell's squiggle, so the wave stays
    // continuous where the shell hands over to the morph.
    const squigglyPts = squigglifyPts(
      renderPts,
      squiggleClockSeconds(),
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

  // One derived rebuild keeps curve inputs and all outputs in the same revision.
  // The spline solver emits to separate builders without extra command buffers.
  const paths = useDerivedValue(() => {
    const cache = cacheRef.current!;
    const pts = flatPts.get();
    const ranges = segmentRanges.get();
    if (pts.length < 4 || ranges.length === 0) {
      cache.lastPts = null;
      return {
        line: cache.emptyPath,
        fill: cache.emptyPath,
        band: cache.emptyPath,
      };
    }
    const bottom = engine.canvasHeight.get() - padding.bottom;
    // Buffers alternate on each geometry update. Identical references here
    // therefore mean only the threshold changed, not the line geometry.
    const bandOnly =
      cache.lastPts === pts &&
      cache.lastRanges === ranges &&
      cache.lastLinear === linear &&
      cache.lastBottom === bottom;
    const samples = thresholdSamples?.get();
    const sampled = samples != null && samples.length >= 2;
    const y = thresholdY?.get() ?? NaN;
    const hasBand = sampled || Number.isFinite(y);
    const span = sampled
      ? thresholdSampleSpanX(
          engine.timestamp.get(),
          engine.displayWindow.get(),
          padding.left,
          engine.canvasWidth.get() - padding.right,
          samples.length,
        )
      : [0, 0];
    const line = lineBuilder.get(),
      fill = fillBuilder.get();
    const band = hasBand ? thresholdFillBuilder.get() : undefined;
    if (!bandOnly || band)
      buildLineFillPaths(
        line,
        fill,
        band,
        pts,
        ranges,
        cache.scratch,
        linear,
        bottom,
        y,
        samples,
        span[0],
        span[1],
        bandOnly,
      );
    if (!bandOnly) {
      cache.lineOutput = line.detach();
      cache.fillOutput = fill.detach();
    }
    cache.lastPts = pts;
    cache.lastRanges = ranges;
    cache.lastLinear = linear;
    cache.lastBottom = bottom;
    return {
      line: cache.lineOutput!,
      fill: cache.fillOutput!,
      band: band?.detach() ?? cache.emptyPath,
    };
  });
  const linePath = useDerivedValue(() => paths.get().line);
  const fillPath = useDerivedValue(() => paths.get().fill);
  const thresholdFillPath = useDerivedValue(() => paths.get().band);

  return { linePath, fillPath, thresholdFillPath } as const;
}
