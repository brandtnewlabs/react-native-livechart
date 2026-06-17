import { useState } from "react";
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
import { markersSignature, projectPoint } from "../math/markers";
import type { LiveChartPoint, Marker, SeriesConfig } from "../types";

/**
 * One custom-rendered marker: a React Native element floated over the canvas and
 * pinned to the marker's live `(time, value)` position. Each glyph projects its
 * OWN marker every frame (mirrors `ConnectorGlyph`) so reordering the array can't
 * make it flash another marker's spot, and the transform runs on the UI thread —
 * no JS re-render as the chart scrolls/rescales.
 *
 * The element is auto-centered on the point: its size is measured via `onLayout`
 * into a SharedValue, and the animated transform offsets by half that size.
 * `pointerEvents="box-none"` lets empty space fall through to the scrub gesture
 * while still allowing an interactive leaf inside the custom element to be tapped.
 */
function CustomMarkerView({
  marker,
  element,
  engine,
  padding,
  seriesSV,
  lineDataSV,
  lineLinear,
}: {
  marker: Marker;
  element: React.ReactElement;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  seriesSV?: SharedValue<SeriesConfig[]>;
  lineDataSV?: SharedValue<LiveChartPoint[]>;
  lineLinear?: boolean;
}) {
  const time = marker.time;
  const value = marker.value;
  const seriesId = marker.seriesId;

  const layout = useDerivedValue(() =>
    projectPoint(time, value, seriesId, {
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
      lineData: lineDataSV?.get(),
      lineLinear,
    }),
  );

  // Measured element size, so the transform can center it on the point.
  const size = useSharedValue({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    size.value = { width, height };
  };

  const animatedStyle = useAnimatedStyle(() => {
    const l = layout.get();
    const s = size.get();
    return {
      opacity: l.visible ? 1 : 0,
      transform: [
        { translateX: l.x - s.width / 2 },
        { translateY: l.y - s.height / 2 },
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
 * `MarkerOverlay`); `renderMarker` is then called per marker on the JS thread.
 * Markers it returns an element for are excluded from the Skia atlas upstream, so
 * there's no double-draw.
 */
export function CustomMarkerOverlay({
  markers,
  renderMarker,
  engine,
  padding,
  series,
  lineData,
  lineLinear,
}: {
  markers: SharedValue<Marker[]>;
  renderMarker: (marker: Marker) => React.ReactElement | null | undefined;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  /** Multi-series data, used to anchor markers by `seriesId`. */
  series?: SharedValue<SeriesConfig[]>;
  /** Single-series line data; anchors markers that omit `value`. */
  lineData?: SharedValue<LiveChartPoint[]>;
  /** Single-series line is drawn linear — anchor `lineData` markers on the chord. */
  lineLinear?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<Marker[]>(() => markers.get().slice());

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

  // Resolve each marker's custom element once per snapshot on the JS thread.
  const custom: { marker: Marker; element: React.ReactElement }[] = [];
  for (let i = 0; i < snapshot.length; i++) {
    const m = snapshot[i];
    const element = renderMarker(m);
    if (element != null) custom.push({ marker: m, element });
  }
  if (custom.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {custom.map(({ marker, element }) => (
        <CustomMarkerView
          key={marker.id}
          marker={marker}
          element={element}
          engine={engine}
          padding={padding}
          seriesSV={series}
          lineDataSV={lineData}
          lineLinear={lineLinear}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // top/left 0 + translate so the measured element can be centered on the point.
  anchor: { position: "absolute", top: 0, left: 0 },
});
