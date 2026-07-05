import { vec, type Uniforms } from "@shopify/react-native-skia";
import { useRef } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { interpolateAtTime } from "../math/interpolate";
import {
  sampleThresholdY,
  THRESHOLD_SAMPLE_COUNT,
  thresholdLineY,
  thresholdSeriesVisible,
  thresholdSplitPositions,
  thresholdVisible,
} from "../math/threshold";
import type { LiveChartPoint } from "../types";

/** A threshold value that is either a single live benchmark or a time-varying series. */
export type ThresholdValue = SharedValue<number> | LiveChartPoint[];

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
 * When `value` is a time-varying series (`LiveChartPoint[]`) this geometry is
 * unused — the worklets short-circuit to a NaN `lineY` (→ off-screen, solid-above
 * fallback) and {@link useThresholdSeries} drives the render instead.
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
  /** Marker-line polyline in screen space `[x, y, …]`, projected from `samples` so
   *  it aligns exactly with the band edge + stroke split. */
  screenPts: SharedValue<number[]>;
  /** `THRESHOLD_SAMPLE_COUNT` threshold pixel-Y values across the plot — the split
   *  shader's `samples[]`, and the bottom edge of the profit/loss band. */
  samples: SharedValue<number[]>;
  /** Plot left edge X (px) — constant (`padding.left`). */
  plotLeft: number;
  /** Plot right edge X (px) — `canvasWidth - padding.right`. */
  plotRight: SharedValue<number>;
  /** Whether any of the polyline is on-screen (drives marker-line opacity). */
  visible: SharedValue<boolean>;
  /** Threshold value at `now` (flat-extended past the last point) — the badge label. */
  currentValue: SharedValue<number>;
  /** Pixel-Y of `currentValue` — anchors the badge. */
  currentLineY: SharedValue<number>;
  /** Whether `currentLineY` itself is on-plot — gates the badge, which is pinned
   *  at that Y. (`visible` can be true for the polyline while the value-at-now
   *  sits outside the plot; the badge must not draw into the gutters then.) */
  currentVisible: SharedValue<boolean>;
}

/** Stable empties so the constant-mode short-circuit returns a churn-free reference. */
const EMPTY_PTS: number[] = [];
const EMPTY_SAMPLES: number[] = new Array(THRESHOLD_SAMPLE_COUNT).fill(0);

/**
 * Per-frame screen geometry for a **time-varying** threshold (`LiveChartPoint[]`):
 * the screen polyline (marker line + fill-band bottom), the shader's pixel-Y
 * `samples[]`, and the current value/anchor for the badge. The array buffers
 * ping-pong (Reanimated only re-notifies subscribers when the returned reference
 * changes). When `value` is a constant `SharedValue<number>` every worklet
 * short-circuits cheaply and {@link useThreshold} drives the render instead.
 */
export function useThresholdSeries(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  value: ThresholdValue,
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

  const samples = useDerivedValue(() => {
    if (!Array.isArray(value)) return EMPTY_SAMPLES;
    const cache = cacheRef.current!;
    cache.sampTick = !cache.sampTick;
    const buf = cache.sampTick ? cache.sampA : cache.sampB;
    return sampleThresholdY(
      value,
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

  // Marker-line polyline projected from the SAME `samples` the band + shader read
  // (evenly spaced across the plot). Tracing the exact threshold vertices instead
  // would put the marker a fraction of a sample off the band/stroke split — the
  // "gradient lagging the line" — so the marker, band edge and stroke colour all
  // share one source of truth here.
  const screenPts = useDerivedValue(() => {
    if (!Array.isArray(value) || value.length === 0) return EMPTY_PTS;
    const s = samples.get();
    const n = s.length;
    if (n < 2) return EMPTY_PTS;
    const cache = cacheRef.current!;
    cache.ptsTick = !cache.ptsTick;
    const buf = cache.ptsTick ? cache.ptsA : cache.ptsB;
    buf.length = 0;
    const plotLeft = padding.left;
    const span = engine.canvasWidth.get() - padding.right - plotLeft;
    for (let i = 0; i < n; i++) {
      buf.push(plotLeft + (span * i) / (n - 1), s[i]);
    }
    return buf;
  });

  const plotRight = useDerivedValue(
    () => engine.canvasWidth.get() - padding.right,
  );

  const visible = useDerivedValue(() => {
    if (!Array.isArray(value)) return false;
    return thresholdSeriesVisible(
      screenPts.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    );
  });

  const currentValue = useDerivedValue(() => {
    if (!Array.isArray(value)) return NaN;
    return interpolateAtTime(value, engine.timestamp.get()) ?? NaN;
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

  const currentVisible = useDerivedValue(() =>
    thresholdVisible(
      currentLineY.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    ),
  );

  return {
    screenPts,
    samples,
    plotLeft: padding.left,
    plotRight,
    visible,
    currentValue,
    currentLineY,
    currentVisible,
  };
}

/**
 * Pack a series geometry + a color pair into the {@link ThresholdSplitShader}'s
 * uniforms (one `SharedValue` per paint — stroke vs. the alpha-reduced fill band).
 * The object is rebuilt each frame so the shader re-paints as `samples` advance.
 */
export function useThresholdSplitUniforms(
  samples: SharedValue<number[]>,
  plotLeft: number,
  plotRight: SharedValue<number>,
  aboveColor: number[],
  belowColor: number[],
): SharedValue<Uniforms> {
  return useDerivedValue<Uniforms>(() => ({
    plotLeft,
    plotRight: plotRight.get(),
    aboveColor,
    belowColor,
    samples: samples.get(),
  }));
}
