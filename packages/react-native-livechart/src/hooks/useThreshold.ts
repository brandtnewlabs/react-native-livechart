import { vec, type Uniforms } from "@shopify/react-native-skia";
import { useRef } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { interpolateAtTime } from "../math/interpolate";
import {
  sampleThresholdY,
  sampleThresholdYAt,
  THRESHOLD_SAMPLE_COUNT,
  thresholdLineY,
  thresholdSampleSpanX,
  thresholdSeriesVisible,
  thresholdSplitPositions,
  thresholdVisible,
} from "../math/threshold";
import type { LiveChartPoint } from "../types";

/** A threshold value that is either a single live benchmark or a time-varying series. */
export type ThresholdValue = SharedValue<number> | LiveChartPoint[];

/** `clipRight` sentinel when the threshold extends to "now" (no forward cutoff). */
export const THRESHOLD_NO_CLIP = 1e9;

export interface ThresholdGeometry {
  /** Threshold pixel-Y within the canvas, or NaN before layout / degenerate range. */
  lineY: SharedValue<number>;
  /** Whether the threshold sits within the plot area (drives marker-line opacity). */
  visible: SharedValue<boolean>;
  /** Vertical gradient end vector, `vec(0, canvasHeight)` — shared by stroke + fill. */
  gradientEnd: SharedValue<ReturnType<typeof vec>>;
  /** `[0, t, t, 1]` stop positions for the hard-split gradient — shared by stroke + fill. */
  splitPositions: SharedValue<number[]>;
}

/**
 * Per-frame screen geometry for the **constant** threshold split (a single
 * `SharedValue<number>` benchmark), shared by the stroke gradient, the
 * profit/loss fill band, and the dashed marker line. Reads the live threshold
 * value + engine Y-range on the UI thread; the math lives in `math/threshold` so
 * it stays unit-testable without Reanimated.
 *
 * When the threshold is a time-varying series this geometry is unused — the
 * worklets short-circuit to a NaN `lineY` (→ off-screen, solid-above fallback)
 * and {@link useThresholdSeries} drives the render instead.
 */
export function useThreshold(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  value: ThresholdValue,
): ThresholdGeometry {
  const lineY = useDerivedValue(() => {
    // Series thresholds are handled by `useThresholdSeries`; bail cheaply here.
    if (Array.isArray(value)) return NaN;
    return thresholdLineY(
      value.get(),
      engine.displayMin.get(),
      engine.displayMax.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    );
  });

  const visible = useDerivedValue(() =>
    thresholdVisible(
      lineY.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    ),
  );

  const splitPositions = useDerivedValue(() =>
    thresholdSplitPositions(lineY.get(), engine.canvasHeight.get()),
  );

  const gradientEnd = useDerivedValue(() =>
    vec(0, Math.max(1, engine.canvasHeight.get())),
  );

  return { lineY, visible, gradientEnd, splitPositions };
}

export interface ThresholdSeriesGeometry {
  /** Marker-line polyline in screen space `[x, y, …]`, projected from `samples`
   *  (so it aligns exactly with the band edge + stroke split) and pinned to the
   *  plot's left edge and to `min(plot right, clipRightX)`. */
  screenPts: SharedValue<number[]>;
  /** `THRESHOLD_SAMPLE_COUNT` threshold pixel-Y values on the time-anchored
   *  sample grid — the split shader's `samples[]`, and the bottom edge of the
   *  profit/loss band. Their pixel-X span is `thresholdSampleSpanX(...)`, which
   *  glides with the window (NOT the static plot edges). */
  samples: SharedValue<number[]>;
  /** Whether any of the polyline is on-screen (drives marker-line opacity). */
  visible: SharedValue<boolean>;
  /** Threshold value at `now` (flat-extended past the last point) — the badge label. */
  currentValue: SharedValue<number>;
  /** Pixel-Y of `currentValue` — anchors the badge. */
  currentLineY: SharedValue<number>;
  /** Whether the badge should show: `currentLineY` on-plot AND, with
   *  `extendToNow` off, "now" not past the series' last point. (`visible` can be
   *  true for the polyline while the value-at-now sits outside the plot; the
   *  badge must not draw into the gutters then.) */
  currentVisible: SharedValue<boolean>;
  /** Pixel-X where the threshold ends: the last point's X with `extendToNow`
   *  off, else {@link THRESHOLD_NO_CLIP}. The shader paints its plain
   *  `restColor` right of it; the marker polyline stops there. */
  clipRightX: SharedValue<number>;
}

/** Stable empties so the constant-mode short-circuit returns a churn-free reference. */
const EMPTY_PTS: number[] = [];
const EMPTY_SAMPLES: number[] = new Array(THRESHOLD_SAMPLE_COUNT).fill(0);

/**
 * Per-frame screen geometry for a **time-varying** threshold — a plain
 * `LiveChartPoint[]` `value` or a live `SharedValue<LiveChartPoint[]>` `series`
 * (which wins when both are given): the screen polyline (marker line +
 * fill-band bottom), the shader's pixel-Y `samples[]`, the current value/anchor
 * for the badge, and the `extendToNow` cutoff X. The array buffers ping-pong
 * (Reanimated only re-notifies subscribers when the returned reference
 * changes). When the threshold is a constant `SharedValue<number>` every
 * worklet short-circuits cheaply and {@link useThreshold} drives the render
 * instead.
 */
export function useThresholdSeries(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  value: ThresholdValue,
  series: SharedValue<LiveChartPoint[]> | null = null,
  extendToNow = true,
): ThresholdSeriesGeometry {
  const cacheRef = useRef<{
    ptsA: number[];
    ptsB: number[];
    ptsTick: boolean;
    sampA: number[];
    sampB: number[];
    sampTick: boolean;
  } | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = {
      ptsA: [],
      ptsB: [],
      ptsTick: false,
      sampA: [],
      sampB: [],
      sampTick: false,
    };
  }

  // Per-worklet inline: the live SharedValue form wins, then the plain-array
  // form; null in constant / no-threshold mode. Inlined (not a shared helper)
  // so `series` sits directly in each worklet's closure and Reanimated tracks
  // it as a mapper input.
  const samples = useDerivedValue(() => {
    const pts = series ? series.get() : Array.isArray(value) ? value : null;
    if (pts === null) return EMPTY_SAMPLES;
    const cache = cacheRef.current!;
    cache.sampTick = !cache.sampTick;
    const buf = cache.sampTick ? cache.sampA : cache.sampB;
    return sampleThresholdY(
      pts,
      engine.timestamp.get(),
      engine.displayWindow.get(),
      engine.displayMin.get(),
      engine.displayMax.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
      THRESHOLD_SAMPLE_COUNT,
      buf,
    );
  });

  const clipRightX = useDerivedValue(() => {
    if (extendToNow) return THRESHOLD_NO_CLIP;
    const pts = series ? series.get() : Array.isArray(value) ? value : null;
    if (pts === null || pts.length === 0) return THRESHOLD_NO_CLIP;
    const win = engine.displayWindow.get();
    const plotLeft = padding.left;
    const plotRight = engine.canvasWidth.get() - padding.right;
    if (!(win > 0) || plotRight <= plotLeft) return THRESHOLD_NO_CLIP;
    const winStart = engine.timestamp.get() - win;
    const lastT = pts[pts.length - 1].time;
    return plotLeft + ((lastT - winStart) / win) * (plotRight - plotLeft);
  });

  // Marker-line polyline projected from the SAME `samples` the band + shader read
  // (the time-anchored, gliding grid). Tracing the exact threshold vertices
  // instead would put the marker a fraction of a sample off the band/stroke
  // split — the "gradient lagging the line" — so the marker, band edge and
  // stroke colour all share one source of truth here. The grid overhangs the
  // plot, so the ends are pinned to the exact plot edges via interpolation —
  // which also keeps the dash pattern's anchor (the path start) fixed while the
  // geometry glides. With `extendToNow` off the right end pins to the
  // threshold's end X instead.
  const screenPts = useDerivedValue(() => {
    const pts = series ? series.get() : Array.isArray(value) ? value : null;
    if (pts === null || pts.length === 0) return EMPTY_PTS;
    const s = samples.get();
    const n = s.length;
    if (n < 2) return EMPTY_PTS;
    const plotLeft = padding.left;
    const plotRight = engine.canvasWidth.get() - padding.right;
    const endX = Math.min(plotRight, clipRightX.get());
    if (endX <= plotLeft) return EMPTY_PTS;
    const cache = cacheRef.current!;
    cache.ptsTick = !cache.ptsTick;
    const buf = cache.ptsTick ? cache.ptsA : cache.ptsB;
    buf.length = 0;
    const [x0, x1] = thresholdSampleSpanX(
      engine.timestamp.get(),
      engine.displayWindow.get(),
      plotLeft,
      plotRight,
      n,
    );
    buf.push(plotLeft, sampleThresholdYAt(s, x0, x1, plotLeft));
    const step = (x1 - x0) / (n - 1);
    for (let i = 0; i < n; i++) {
      const sx = x0 + step * i;
      if (sx > plotLeft && sx < endX) buf.push(sx, s[i]);
    }
    buf.push(endX, sampleThresholdYAt(s, x0, x1, endX));
    return buf;
  });

  const visible = useDerivedValue(() => {
    if (series === null && !Array.isArray(value)) return false;
    return thresholdSeriesVisible(
      screenPts.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    );
  });

  const currentValue = useDerivedValue(() => {
    const pts = series ? series.get() : Array.isArray(value) ? value : null;
    if (pts === null) return NaN;
    return interpolateAtTime(pts, engine.timestamp.get()) ?? NaN;
  });

  const currentLineY = useDerivedValue(() =>
    thresholdLineY(
      currentValue.get(),
      engine.displayMin.get(),
      engine.displayMax.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    ),
  );

  const currentVisible = useDerivedValue(() => {
    if (!extendToNow) {
      // The threshold ends at its last point — no badge past it.
      const pts = series ? series.get() : Array.isArray(value) ? value : null;
      if (pts === null || pts.length === 0) return false;
      if (pts[pts.length - 1].time < engine.timestamp.get()) return false;
    }
    return thresholdVisible(
      currentLineY.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    );
  });

  return {
    screenPts,
    samples,
    visible,
    currentValue,
    currentLineY,
    currentVisible,
    clipRightX,
  };
}

/**
 * Pack a series geometry + a color set into the {@link ThresholdSplitShader}'s
 * uniforms (one `SharedValue` per paint — stroke vs. the alpha-reduced fill band).
 * The object is rebuilt each frame so the shader re-paints as `samples` advance;
 * `sampleLeft`/`sampleRight` are the gliding pixel-X span of the sample grid and
 * `clipRight`/`restColor` implement the `extendToNow: false` cutoff (plain line
 * color for the stroke, transparent for the band).
 */
export function useThresholdSplitUniforms(
  samples: SharedValue<number[]>,
  engine: ChartEngineLayout,
  padding: ChartPadding,
  aboveColor: number[],
  belowColor: number[],
  restColor: number[],
  clipRightX: SharedValue<number>,
): SharedValue<Uniforms> {
  return useDerivedValue<Uniforms>(() => {
    const s = samples.get();
    const [x0, x1] = thresholdSampleSpanX(
      engine.timestamp.get(),
      engine.displayWindow.get(),
      padding.left,
      engine.canvasWidth.get() - padding.right,
      s.length,
    );
    return {
      sampleLeft: x0,
      sampleRight: x1,
      clipRight: clipRightX.get(),
      aboveColor,
      belowColor,
      restColor,
      samples: s,
    };
  });
}
