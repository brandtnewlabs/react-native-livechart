import { useRef } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { interpolateAtTime } from "../math/interpolate";
import { buildReferenceLineSeriesPoints } from "../math/referenceLineSeries";
import {
  thresholdLineY,
  thresholdSeriesVisible,
  thresholdVisible,
} from "../math/threshold";
import type { LiveChartPoint } from "../types";

export interface ReferenceLineSeriesGeometry {
  /** Visible series polyline as `[x, y, …]` screen coordinates. */
  screenPts: SharedValue<number[]>;
  /** Whether any series segment crosses the visible plot. */
  visible: SharedValue<boolean>;
  /** Series value at the chart's current right edge. */
  currentValue: SharedValue<number>;
  /** Canvas Y coordinate of {@link currentValue}. */
  currentY: SharedValue<number>;
  /** Whether the current-value label belongs inside the visible plot. */
  currentVisible: SharedValue<boolean>;
}

/**
 * UI-thread geometry for a static historical reference-line series. Point
 * buffers ping-pong so Reanimated observes a changed array reference each frame
 * without allocating new intermediate arrays.
 */
export function useReferenceLineSeries(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  points: LiveChartPoint[],
  extendToNow: boolean,
): ReferenceLineSeriesGeometry {
  const cacheRef = useRef<{
    a: number[];
    b: number[];
    tick: boolean;
  } | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = { a: [], b: [], tick: false };
  }

  const screenPts = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.tick = !cache.tick;
    return buildReferenceLineSeriesPoints(
      points,
      engine.timestamp.get(),
      engine.displayWindow.get(),
      engine.displayMin.get(),
      engine.displayMax.get(),
      engine.canvasWidth.get(),
      engine.canvasHeight.get(),
      padding,
      extendToNow,
      cache.tick ? cache.a : cache.b,
    );
  });

  const visible = useDerivedValue(() =>
    thresholdSeriesVisible(
      screenPts.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    ),
  );

  const currentValue = useDerivedValue(
    () => interpolateAtTime(points, engine.timestamp.get()) ?? NaN,
  );
  const currentY = useDerivedValue(() =>
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
    if (points.length === 0) return false;
    if (!extendToNow && points[points.length - 1].time < engine.timestamp.get()) {
      return false;
    }
    return thresholdVisible(
      currentY.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    );
  });

  return { screenPts, visible, currentValue, currentY, currentVisible };
}
