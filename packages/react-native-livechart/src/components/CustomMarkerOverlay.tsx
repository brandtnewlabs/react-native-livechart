import { useMemo, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import {
  markersSignature,
  projectMarkers,
  type ProjectedMarker,
} from "../math/markers";
import {
  clusterMarkers,
  type ResolvedMarkerCluster,
} from "../math/markerCluster";
import type {
  LiveChartPoint,
  Marker,
  MarkerRenderContext,
  SeriesConfig,
} from "../types";

/** Live group flags surfaced to `renderMarker` (mirrored to JS on change). */
type GroupState = Record<string, { isGrouped: boolean; groupCount: number }>;

/**
 * One custom-rendered marker: a React Native element floated over the canvas and
 * pinned to the marker's live clustered `(x, y)` position. It reads its slot out
 * of the shared `posById` map (one project+cluster for all markers) by id, so a
 * reorder of the array can't make it flash another marker's spot, and the
 * transform runs on the UI thread — no JS re-render as the chart scrolls/rescales.
 *
 * A collapsed-cluster member (`hidden`) and an off-screen marker both fade out.
 * The element is auto-centered on the point: its size is measured via `onLayout`,
 * and the animated transform offsets by half that size. `pointerEvents="box-none"`
 * lets empty space fall through to the scrub gesture while still letting an
 * interactive leaf inside the custom element be tapped.
 */
function CustomMarkerView({
  marker,
  element,
  posById,
}: {
  marker: Marker;
  element: React.ReactElement;
  posById: SharedValue<Record<string, ProjectedMarker>>;
}) {
  const id = marker.id;

  // Measured element size, so the transform can center it on the point.
  const size = useSharedValue({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    size.value = { width, height };
  };

  const animatedStyle = useAnimatedStyle(() => {
    const p = posById.get()[id];
    const s = size.get();
    if (!p || !p.visible || p.hidden) {
      return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    }
    return {
      opacity: 1,
      transform: [
        { translateX: p.x - s.width / 2 },
        { translateY: p.y - s.height / 2 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      onLayout={onLayout}
      style={[styles.anchor, animatedStyle]}
    >
      {element}
    </Animated.View>
  );
}

/**
 * React Native overlay (NOT Skia) that floats `renderMarker` elements over the
 * Skia canvas, one per marker the consumer chooses to customize. Rendered as a
 * sibling of `<Canvas>` (like {@link AxisLabelOverlay}) so the elements can be
 * any RN view — including non-Skia effects (e.g. a glass `BlurView`) — and stay
 * crisp at native resolution instead of being rasterized into the marker atlas.
 *
 * The set of markers is mirrored to JS state via `markersSignature` (same as
 * `MarkerOverlay`); `renderMarker(marker, ctx)` is then called per marker on the
 * JS thread. Markers it returns an element for are excluded from the Skia atlas
 * upstream, so there's no double-draw.
 *
 * Custom views participate in {@link clusterMarkers}: a single per-frame
 * project+cluster over all markers feeds a `posById` map so co-located custom
 * views fan apart (or hide when their cluster collapses) in lockstep with the
 * atlas markers. `renderMarker` must return an element consistently for a given
 * id (it may restyle via `ctx`, but should not flip between element and `null`
 * based on `ctx.isGrouped`).
 */
export function CustomMarkerOverlay({
  markers,
  renderMarker,
  engine,
  padding,
  series,
  lineData,
  lineLinear,
  cluster,
}: {
  markers: SharedValue<Marker[]>;
  renderMarker: (
    marker: Marker,
    ctx: MarkerRenderContext,
  ) => React.ReactElement | null | undefined;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  /** Multi-series data, used to anchor markers by `seriesId`. */
  series?: SharedValue<SeriesConfig[]>;
  /** Single-series line data; anchors markers that omit `value`. */
  lineData?: SharedValue<LiveChartPoint[]>;
  /** Single-series line is drawn linear — anchor `lineData` markers on the chord. */
  lineLinear?: boolean;
  /** Collision config; `"stacked"` fans/collapses co-located markers. */
  cluster: ResolvedMarkerCluster;
}) {
  const [snapshot, setSnapshot] = useState<Marker[]>(() => markers.get().slice());
  // Live group flags (which custom markers are collapsed-cluster reps), mirrored
  // to JS so `renderMarker`'s ctx can reflect grouping without a per-frame bridge.
  const [groupState, setGroupState] = useState<GroupState>({});

  const pull = () => {
    setSnapshot(markers.get().slice());
  };

  useAnimatedReaction(
    () => markersSignature(markers.get()),
    /* istanbul ignore next -- scheduleOnRN from UI-thread reaction */
    (sig, prev) => {
      if (sig !== prev) scheduleOnRN(pull);
    },
    [markers, pull],
  );

  // Resolve each marker's custom element once per snapshot / group change on the
  // JS thread, threading the cluster/position context.
  const custom: { marker: Marker; element: React.ReactElement }[] = [];
  for (let i = 0; i < snapshot.length; i++) {
    const m = snapshot[i];
    const gs = groupState[m.id];
    const ctx: MarkerRenderContext = {
      index: i,
      isGrouped: gs?.isGrouped ?? false,
      groupCount: gs?.groupCount ?? 0,
      side: m.side ?? "center",
    };
    const element = renderMarker(m, ctx);
    if (element != null) custom.push({ marker: m, element });
  }

  // Stable id-set of customized markers (used by the UI-thread map below).
  const customKey = custom.map((c) => c.marker.id).join("\x1f");
  const customIds = useMemo<Record<string, true>>(() => {
    const o: Record<string, true> = {};
    for (const c of custom) o[c.marker.id] = true;
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed when the id set (customKey) changes
  }, [customKey]);

  // One project+cluster over ALL markers each frame, exposed as an id→position map
  // for just the custom markers (so views read their own slot by id). Reuses a
  // single buffer; a fresh map object is returned each frame to notify readers.
  const projRef = useRef<ProjectedMarker[] | null>(null);
  if (projRef.current === null) projRef.current = [];

  const posById = useDerivedValue<Record<string, ProjectedMarker>>(() => {
    const ms = markers.get();
    const buf = projRef.current!;
    projectMarkers(ms, buf, {
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
      series: series?.get(),
      lineData: lineData?.get(),
      lineLinear,
    });
    clusterMarkers(ms, buf, { config: cluster });
    const map: Record<string, ProjectedMarker> = {};
    for (let i = 0; i < ms.length; i++) {
      if (customIds[ms[i].id]) map[ms[i].id] = buf[i];
    }
    return map;
  }, [markers, engine, padding, series, lineData, lineLinear, cluster, customIds]);

  // Mirror collapsed-cluster flags to JS only when they change (not per frame),
  // so a custom rep can render a distinct grouped look via `ctx`.
  const pullGroupState =
    /* istanbul ignore next -- scheduleOnRN from UI-thread reaction */
    () => {
      const m = posById.get();
      const next: GroupState = {};
      for (const k of Object.keys(m)) {
        const p = m[k];
        if (p.isGrouped) next[k] = { isGrouped: true, groupCount: p.groupCount };
      }
      setGroupState((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (prevKeys.length === nextKeys.length &&
          nextKeys.every((k) => prev[k]?.groupCount === next[k].groupCount)) {
          return prev; // no real change — avoid a needless re-render
        }
        return next;
      });
    };

  useAnimatedReaction(
    () => {
      const m = posById.get();
      let sig = "";
      for (const k of Object.keys(m)) {
        const p = m[k];
        if (p.isGrouped) sig += `${k}:${p.groupCount};`;
      }
      return sig;
    },
    /* istanbul ignore next -- scheduleOnRN from UI-thread reaction */
    (sig, prev) => {
      if (sig !== prev) scheduleOnRN(pullGroupState);
    },
    [posById, pullGroupState],
  );

  if (custom.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {custom.map(({ marker, element }) => (
        <CustomMarkerView
          key={marker.id}
          marker={marker}
          element={element}
          posById={posById}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // top/left 0 + translate so the measured element can be centered on the point.
  anchor: { position: "absolute", top: 0, left: 0 },
});
