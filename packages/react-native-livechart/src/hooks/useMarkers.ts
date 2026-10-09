import { useEffect, useMemo, useRef } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  useAnimatedReaction,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { projectMarkers, type ProjectedMarker } from "../math/markers";
import { nearestMarkerIndex } from "../math/markers";
import {
  clusterMarkers,
  clusterMembers,
  type ResolvedMarkerCluster,
} from "../math/markerCluster";
import type {
  LiveChartPoint,
  Marker,
  MarkerPressEvent,
  SeriesConfig,
} from "../types";

import { useLatestCallback } from "./useLatestCallback";

const ANCHORED_CLUSTER: ResolvedMarkerCluster = {
  mode: "anchored",
  direction: "horizontal",
  overlap: 0.75,
  gap: 2,
  maxBeforeGroup: 5,
  maxVisible: Number.MAX_SAFE_INTEGER,
  groupBadge: "count",
  showGroupCount: false,
};

/**
 * Projects markers to screen positions each frame and builds a tap gesture that
 * hit-tests against them, firing `onMarkerPress` (or `null` on a miss). Applies
 * the {@link clusterMarkers} collision pass each frame so hit-testing matches the
 * drawn (stacked / collapsed) positions.
 */
export function useMarkers(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  markers: SharedValue<Marker[]>,
  active: boolean,
  hitRadius: number,
  onMarkerPress?: (event: MarkerPressEvent | null) => void,
  seriesSV?: SharedValue<SeriesConfig[]>,
  lineData?: SharedValue<LiveChartPoint[]>,
  /** Static charts run no loops: register without starting. Default `true`. */
  autostart = true,
  /** Single-series line is drawn linear (`line.curve === "linear"`) — anchor
   *  `lineData` markers on the straight chord rather than the spline. */
  lineLinear = false,
  /** Collision config; default `"anchored"` (no stacking). */
  cluster: ResolvedMarkerCluster = ANCHORED_CLUSTER,
  /** Runtime gate shared with the chart engine. */
  isFrameLoopActive?: SharedValue<boolean>,
  /** Experimental input-driven projection instead of continuous frames; defaults to false. */
  autoSleep = false,
): {
  projected: SharedValue<ProjectedMarker[]>;
  tapGesture: ReturnType<typeof Gesture.Tap>;
  /** Worklet hit-test: true when (x, y) lands on a projected marker. */
  hitTest: (x: number, y: number) => boolean;
} {
  const projected = useSharedValue<ProjectedMarker[]>([]);
  const cacheRef = useRef<{
    a: ProjectedMarker[];
    b: ProjectedMarker[];
    tick: boolean;
  } | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = { a: [] as ProjectedMarker[], b: [] as ProjectedMarker[], tick: false };
  }

  const emitPress = useLatestCallback(
    /* istanbul ignore next -- invoked only from the UI-thread tap worklet */
    (event: MarkerPressEvent | null) => {
      onMarkerPress?.(event);
    },
  );

  const project =
    /* istanbul ignore next -- worklet runs on UI thread, not in Jest */ () => {
      "worklet";
      if (isFrameLoopActive?.get() === false) return;
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
        lineData: lineData?.get(),
        lineLinear,
      });
      clusterMarkers(markers.get(), buf, {
        config: cluster,
        minY: 0,
        maxY: engine.canvasHeight.get(),
      });
      projected.set(buf);
    };
  const legacyActive = autostart && !autoSleep;
  const markerFrameCallback = useFrameCallback(project, legacyActive);
  useAnimatedReaction(
    () => {
      if (!autoSleep || !autostart) return null;
      return [active, markers.get(), engine.canvasWidth.get(), engine.canvasHeight.get(),
        engine.timestamp.get(), engine.displayWindow.get(), engine.displayMin.get(),
        engine.displayMax.get(), seriesSV?.get(), lineData?.get(), isFrameLoopActive?.get()];
    },
    (inputs) => {
      if (inputs !== null) project();
    },
  );
  useEffect(() => {
    // Reanimated does not reactively apply later `autostart` values.
    markerFrameCallback.setActive(legacyActive);
  }, [legacyActive, markerFrameCallback]);

  const { tapGesture, hitTest } = useMemo(() => {
    const tapGesture = Gesture.Tap().onEnd(
      /* istanbul ignore next -- gesture worklet runs on UI thread, not in Jest */ (
        e,
      ) => {
        "worklet";
        const proj = projected.get();
        const idx = nearestMarkerIndex(proj, e.x, e.y, hitRadius);
        if (idx < 0) {
          runOnJS(emitPress)(null);
          return;
        }
        const ms = markers.get();
        const m = ms[idx];
        const p = proj[idx];
        const isGrouped = p.isGrouped;
        // Collapsed cluster: surface the whole bucket so the consumer can list it.
        const members = isGrouped ? clusterMembers(ms, proj, idx) : undefined;
        runOnJS(emitPress)({
          marker: m,
          point: { x: p.x, y: p.y },
          index: idx,
          isGrouped,
          members,
        });
      },
    );

    // Lets a coexisting gesture (e.g. the scrub-action tap) defer to a marker
    // under the finger instead of acting on it.
    const hitTest =
      /* istanbul ignore next -- worklet, runs on the UI thread, not in Jest */ (
        x: number,
        y: number,
      ) => {
        "worklet";
        return nearestMarkerIndex(projected.get(), x, y, hitRadius) >= 0;
      };

    return { tapGesture, hitTest };
  }, [
    emitPress,
    hitRadius,
    markers,
    projected,
  ]);

  return { projected, tapGesture, hitTest };
}
