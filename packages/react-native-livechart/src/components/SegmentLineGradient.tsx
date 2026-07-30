import { LinearGradient, vec } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";

import type { ResolvedSegment } from "../core/resolveSegment";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { useSegmentLineGradient } from "../hooks/useSegmentLineGradient";
import { segmentGradientStopCount } from "../math/segments";

interface SegmentLineGradientProps {
  engine: ChartEngineLayout;
  segments: ResolvedSegment[];
  padding: ChartPadding;
  baseColor: string;
  scrubX: SharedValue<number>;
  scrubActive: SharedValue<boolean>;
}

/**
 * Keeps the two SharedValues passed to Skia on one stop-count lifecycle.
 *
 * Scrubbing can change which stops are visible without changing `stopCount`, so
 * padding keeps those mapper updates safe. When the segment props themselves
 * change the count, the keyed child remounts both SharedValues together instead
 * of letting one retain the previous length for a frame.
 */
export function SegmentLineGradient(props: SegmentLineGradientProps) {
  const stopCount = segmentGradientStopCount(props.segments);
  return <SegmentLineGradientPaint key={stopCount} {...props} />;
}

function SegmentLineGradientPaint({
  engine,
  segments,
  padding,
  baseColor,
  scrubX,
  scrubActive,
}: SegmentLineGradientProps) {
  const gradient = useSegmentLineGradient(
    engine,
    segments,
    padding,
    baseColor,
    scrubX,
    scrubActive,
  );

  return (
    <LinearGradient
      start={vec(0, 0)}
      end={gradient.gradientEnd}
      colors={gradient.colors}
      positions={gradient.positions}
    />
  );
}
