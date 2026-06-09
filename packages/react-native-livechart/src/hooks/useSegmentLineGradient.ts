import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { vec } from "@shopify/react-native-skia";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ResolvedSegment } from "../core/resolveSegment";
import type { ChartPadding } from "../draw/line";
import { segmentLineGradient } from "../math/segments";

const FALLBACK_POSITIONS = [0, 1];

/**
 * Derives the horizontal gradient applied to the line stroke for "scrub focus":
 * the line is a flat `baseColor` at rest, and while scrubbing (or when a segment
 * is `active`) the focused segment stays `baseColor` while the others are
 * de-emphasized with their `lineColor`/`lineColors`. `colors`/`positions` come
 * from the pure `segmentLineGradient`; `gradientEnd` spans the full canvas width
 * so stop fractions and the gradient vector share one coordinate space. Apply it
 * to the same `linePath` as the base line — one stroke, no seam, and the line
 * itself carries the opacity (not a layer painted on top).
 */
export function useSegmentLineGradient(
  engine: ChartEngineLayout,
  segments: ResolvedSegment[],
  padding: ChartPadding,
  baseColor: string,
  scrubX: SharedValue<number>,
  scrubActive: SharedValue<boolean>,
) {
  const data = useDerivedValue(() => {
    const cw = engine.canvasWidth.value;
    const win = engine.displayWindow.value;
    const winStart = engine.timestamp.value - win;
    return segmentLineGradient(
      segments,
      winStart,
      win,
      cw,
      padding.left,
      cw - padding.right,
      baseColor,
      scrubActive.value,
      scrubX.value,
    );
  });

  const colors = useDerivedValue(
    () => data.value?.colors ?? [baseColor, baseColor],
  );
  const positions = useDerivedValue(
    () => data.value?.positions ?? FALLBACK_POSITIONS,
  );
  const gradientEnd = useDerivedValue(() =>
    vec(Math.max(1, engine.canvasWidth.value), 0),
  );

  return { colors, positions, gradientEnd };
}
