import { useCallback, useEffect, useMemo, useRef } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
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
  const cache = useMemo(
    () => ({ a: [] as ProjectedMarker[], b: [] as ProjectedMarker[], tick: false }),
    [],
  );

  const onHoverRef = useRef(onMarkerHover);
  useEffect(() => {
    onHoverRef.current = onMarkerHover;
  });
  const emitHover = useCallback(
    /* istanbul ignore next -- invoked only from the UI-thread tap worklet */
    (event: MarkerHoverEvent | null) => {
      onHoverRef.current?.(event);
    },
    [],
  );

  useFrameCallback(
    /* istanbul ignore next -- worklet runs on UI thread, not in Jest */ () => {
      "worklet";
      if (!active) {
        if (projected.value.length > 0) projected.value = [];
        return;
      }
      cache.tick = !cache.tick;
      const buf = cache.tick ? cache.a : cache.b;
      projectMarkers(markers.value, buf, {
        canvasWidth: engine.canvasWidth.value,
        canvasHeight: engine.canvasHeight.value,
        padTop: padding.top,
        padBottom: padding.bottom,
        padLeft: padding.left,
        padRight: padding.right,
        timestamp: engine.timestamp.value,
        displayWindow: engine.displayWindow.value,
        displayMin: engine.displayMin.value,
        displayMax: engine.displayMax.value,
        series: seriesSV?.value,
      });
      projected.value = buf;
    },
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(
        /* istanbul ignore next -- gesture worklet runs on UI thread, not in Jest */ (
          e,
        ) => {
          "worklet";
          const idx = nearestMarkerIndex(projected.value, e.x, e.y, hitRadius);
          if (idx < 0) {
            runOnJS(emitHover)(null);
            return;
          }
          const m = markers.value[idx];
          const p = projected.value[idx];
          runOnJS(emitHover)({ marker: m, point: { x: p.x, y: p.y } });
        },
      ),
    [projected, markers, hitRadius, emitHover],
  );

  return { projected, tapGesture };
}
