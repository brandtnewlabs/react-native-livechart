import { useRef } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { projectMarkers, type ProjectedMarker } from "../math/markers";
import { nearestMarkerIndex } from "../math/markers";
import type { Marker, MarkerHoverEvent, SeriesConfig } from "../types";

/**
 * Projects markers to screen positions each frame and builds a tap gesture that
 * hit-tests against them, firing `onMarkerHover` (or `null` on a miss).
 */
export function useMarkers(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  markers: SharedValue<Marker[]>,
  active: boolean,
  hitRadius: number,
  onMarkerHover?: (event: MarkerHoverEvent | null) => void,
  seriesSV?: SharedValue<SeriesConfig[]>,
): { projected: SharedValue<ProjectedMarker[]>; tapGesture: ReturnType<typeof Gesture.Tap> } {
  const projected = useSharedValue<ProjectedMarker[]>([]);
  const cacheRef = useRef<{
    a: ProjectedMarker[];
    b: ProjectedMarker[];
    tick: boolean;
  } | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = { a: [] as ProjectedMarker[], b: [] as ProjectedMarker[], tick: false };
  }

  const emitHover =
    /* istanbul ignore next -- invoked only from the UI-thread tap worklet */
    (event: MarkerHoverEvent | null) => {
      onMarkerHover?.(event);
    };

  useFrameCallback(
    /* istanbul ignore next -- worklet runs on UI thread, not in Jest */ () => {
      "worklet";
      const cache = cacheRef.current!;
      if (!active) {
        if (projected.get().length > 0) projected.set([]);
        return;
      }
      cache.tick = !cache.tick;
      const buf = cache.tick ? cache.a : cache.b;
      projectMarkers(markers.get(), buf, {
        canvasWidth: engine.canvasWidth.get(),
        canvasHeight: engine.canvasHeight.get(),
        padTop: padding.top,
        padBottom: padding.bottom,
        padLeft: padding.left,
        padRight: padding.right,
        timestamp: engine.timestamp.get(),
        displayWindow: engine.displayWindow.get(),
        displayMin: engine.displayMin.get(),
        displayMax: engine.displayMax.get(),
        series: seriesSV?.get(),
      });
      projected.set(buf);
    },
  );

  const tapGesture = Gesture.Tap().onEnd(
    /* istanbul ignore next -- gesture worklet runs on UI thread, not in Jest */ (
      e,
    ) => {
      "worklet";
      const idx = nearestMarkerIndex(projected.get(), e.x, e.y, hitRadius);
      if (idx < 0) {
        runOnJS(emitHover)(null);
        return;
      }
      const m = markers.get()[idx];
      const p = projected.get()[idx];
      runOnJS(emitHover)({ marker: m, point: { x: p.x, y: p.y } });
    },
  );

  return { projected, tapGesture };
}
