import {
  DashPathEffect,
  Path,
  Skia,
  type SkPath,
} from "@shopify/react-native-skia";
import { useRef } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartPadding } from "../draw/line";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";

/**
 * A dashed horizontal line that tracks the live display value — sitting at
 * the same Y as the badge and live dot. Rendered behind the chart line.
 */
export function ValueLineOverlay({
  dotY,
  engine,
  padding,
  strokeWidth,
  intervals,
  color,
}: {
  dotY: SharedValue<number>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  strokeWidth: number;
  intervals: [number, number];
  color: string;
}) {
  // Ping-pong persistent paths — avoid allocating a JSI-backed SkPath per frame.
  const cacheRef = useRef<{
    a: SkPath;
    b: SkPath;
    tick: boolean;
  } | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = {
      a: Skia.Path.Make(),
      b: Skia.Path.Make(),
      tick: false,
    };
  }

  const path = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.tick = !cache.tick;
    const p = cache.tick ? cache.a : cache.b;
    p.reset();
    const y = dotY.get();
    if (y < 0) return p;
    p.moveTo(padding.left, y);
    p.lineTo(engine.canvasWidth.get() - padding.right, y);
    return p;
  });

  return (
    <Path path={path} style="stroke" strokeWidth={strokeWidth} color={color}>
      <DashPathEffect intervals={intervals} />
    </Path>
  );
}
