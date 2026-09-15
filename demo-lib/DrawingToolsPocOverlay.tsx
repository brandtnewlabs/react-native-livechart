import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
} from "@shopify/react-native-skia";
import Animated, {
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type {
  ChartOverlayContext,
  ChartScale,
} from "react-native-livechart";

import { ACCENT } from "./shared";
import {
  clampDrawingCoordinate,
  hitTestTrendLine,
  translateTrendLine,
  type DrawingAnchor,
  type ScreenTrendLine,
  type TrendLineDragTarget,
  type TrendLineDrawing,
} from "./drawingToolsPoc";

export type DrawingPocMode = "browse" | "draw" | "edit";

const HANDLE_RADIUS = 7;
const HANDLE_HIT_RADIUS = 18;
const LINE_HIT_RADIUS = 12;
const MIN_LINE_LENGTH = 18;
const EMPTY_ANCHOR: DrawingAnchor = { time: 0, value: 0 };
const EMPTY_LINE: TrendLineDrawing = {
  id: "",
  start: EMPTY_ANCHOR,
  end: EMPTY_ANCHOR,
};

type DragTarget = TrendLineDragTarget | "create";

function projectLine(
  drawing: TrendLineDrawing,
  scale: ChartScale,
  timeToX: ChartOverlayContext["timeToX"],
  priceToY: ChartOverlayContext["priceToY"],
): ScreenTrendLine {
  "worklet";
  return {
    startX: timeToX(drawing.start.time, scale),
    startY: priceToY(drawing.start.value, scale),
    endX: timeToX(drawing.end.time, scale),
    endY: priceToY(drawing.end.value, scale),
  };
}

function anchorAtTouch(
  x: number,
  y: number,
  scale: ChartScale,
  xToTime: ChartOverlayContext["xToTime"],
  yToPrice: ChartOverlayContext["yToPrice"],
): DrawingAnchor | null {
  "worklet";
  const clampedX = clampDrawingCoordinate(x, scale.plot.left, scale.plot.right);
  const clampedY = clampDrawingCoordinate(y, scale.plot.top, scale.plot.bottom);
  const value = yToPrice(clampedY, scale);
  if (value === null) return null;
  return { time: xToTime(clampedX, scale), value };
}

function findDrawingHit(
  drawings: TrendLineDrawing[],
  selectedIndex: number,
  x: number,
  y: number,
  scale: ChartScale,
  timeToX: ChartOverlayContext["timeToX"],
  priceToY: ChartOverlayContext["priceToY"],
): { index: number; target: TrendLineDragTarget } {
  "worklet";
  if (selectedIndex >= 0 && selectedIndex < drawings.length) {
    const selectedHit = hitTestTrendLine(
      projectLine(drawings[selectedIndex], scale, timeToX, priceToY),
      x,
      y,
      HANDLE_HIT_RADIUS,
      LINE_HIT_RADIUS,
    );
    if (selectedHit !== "none") {
      return { index: selectedIndex, target: selectedHit };
    }
  }

  for (let index = drawings.length - 1; index >= 0; index--) {
    if (index === selectedIndex) continue;
    const target = hitTestTrendLine(
      projectLine(drawings[index], scale, timeToX, priceToY),
      x,
      y,
      HANDLE_HIT_RADIUS,
      LINE_HIT_RADIUS,
    );
    if (target !== "none") return { index, target };
  }
  return { index: -1, target: "none" };
}

export function DrawingToolsPocOverlay({
  context,
  drawings,
  selectedIndex,
  mode,
  onCreated,
  onStatus,
}: {
  context: ChartOverlayContext;
  drawings: SharedValue<TrendLineDrawing[]>;
  selectedIndex: SharedValue<number>;
  mode: DrawingPocMode;
  onCreated: (id: string) => void;
  onStatus: (message: string) => void;
}) {
  // Destructure every worklet dependency so none of the gesture callbacks close
  // over ChartOverlayContext as an opaque object.
  const { scale, timeToX, priceToY, xToTime, yToPrice } = context;
  const allBuilder = useSharedValue(
    useMemo(() => Skia.PathBuilder.Make(), []),
  );
  const selectedBuilder = useSharedValue(
    useMemo(() => Skia.PathBuilder.Make(), []),
  );
  const nextId = useSharedValue(2);
  const dragTarget = useSharedValue<DragTarget>("none");
  const dragIndex = useSharedValue(-1);
  const dragOrigin = useSharedValue<TrendLineDrawing>(EMPTY_LINE);
  const touchOrigin = useSharedValue<DrawingAnchor>(EMPTY_ANCHOR);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const moved = useSharedValue(false);

  const allPath = useDerivedValue(() => {
    const builder = allBuilder.get();
    const chartScale = scale.get();
    const items = drawings.get();
    for (let index = 0; index < items.length; index++) {
      const line = projectLine(items[index], chartScale, timeToX, priceToY);
      builder.moveTo(line.startX, line.startY);
      builder.lineTo(line.endX, line.endY);
    }
    return builder.detach();
  });

  const selectedPath = useDerivedValue(() => {
    const builder = selectedBuilder.get();
    const items = drawings.get();
    const index = selectedIndex.get();
    if (index >= 0 && index < items.length) {
      const line = projectLine(items[index], scale.get(), timeToX, priceToY);
      builder.moveTo(line.startX, line.startY);
      builder.lineTo(line.endX, line.endY);
    }
    return builder.detach();
  });

  const plotClip = useDerivedValue(() => {
    const plot = scale.get().plot;
    return {
      x: plot.left,
      y: plot.top,
      width: Math.max(0, plot.right - plot.left),
      height: Math.max(0, plot.bottom - plot.top),
    };
  });

  const handleOpacity = useDerivedValue(() => {
    const index = selectedIndex.get();
    return mode === "edit" && index >= 0 && index < drawings.get().length
      ? 1
      : 0;
  });
  const startHandleX = useDerivedValue(() => {
    const items = drawings.get();
    const index = selectedIndex.get();
    return index >= 0 && index < items.length
      ? timeToX(items[index].start.time, scale.get())
      : -100;
  });
  const startHandleY = useDerivedValue(() => {
    const items = drawings.get();
    const index = selectedIndex.get();
    return index >= 0 && index < items.length
      ? priceToY(items[index].start.value, scale.get())
      : -100;
  });
  const endHandleX = useDerivedValue(() => {
    const items = drawings.get();
    const index = selectedIndex.get();
    return index >= 0 && index < items.length
      ? timeToX(items[index].end.time, scale.get())
      : -100;
  });
  const endHandleY = useDerivedValue(() => {
    const items = drawings.get();
    const index = selectedIndex.get();
    return index >= 0 && index < items.length
      ? priceToY(items[index].end.value, scale.get())
      : -100;
  });

  function reportCreated(id: string) {
    onCreated(id);
  }

  function reportStatus(message: string) {
    onStatus(message);
  }

  const gesture = Gesture.Pan()
    .enabled(mode !== "browse")
    .maxPointers(1)
    .minDistance(0)
    .onBegin((event) => {
      "worklet";
      const chartScale = scale.get();
      const plot = chartScale.plot;
      if (
        event.x < plot.left ||
        event.x > plot.right ||
        event.y < plot.top ||
        event.y > plot.bottom
      ) {
        dragTarget.set("none");
        dragIndex.set(-1);
        return;
      }

      touchStartX.set(event.x);
      touchStartY.set(event.y);
      moved.set(false);
      const anchor = anchorAtTouch(event.x, event.y, chartScale, xToTime, yToPrice);
      if (anchor === null) return;
      touchOrigin.set(anchor);

      if (mode === "draw") {
        const id = `line-${nextId.get()}`;
        nextId.set(nextId.get() + 1);
        const items = drawings.get().slice();
        items.push({ id, start: anchor, end: anchor });
        drawings.set(items);
        const index = items.length - 1;
        selectedIndex.set(index);
        dragIndex.set(index);
        dragTarget.set("create");
        return;
      }

      const items = drawings.get();
      const hit = findDrawingHit(
        items,
        selectedIndex.get(),
        event.x,
        event.y,
        chartScale,
        timeToX,
        priceToY,
      );
      selectedIndex.set(hit.index);
      dragIndex.set(hit.index);
      dragTarget.set(hit.target);
      if (hit.index >= 0) {
        dragOrigin.set(items[hit.index]);
        scheduleOnRN(reportStatus, `Selected ${items[hit.index].id}`);
      } else {
        scheduleOnRN(reportStatus, "No line selected");
      }
    })
    .onUpdate((event) => {
      "worklet";
      const target = dragTarget.get();
      const index = dragIndex.get();
      const items = drawings.get();
      if (target === "none" || index < 0 || index >= items.length) return;

      if (
        Math.hypot(event.x - touchStartX.get(), event.y - touchStartY.get()) > 1
      ) {
        moved.set(true);
      }
      const anchor = anchorAtTouch(
        event.x,
        event.y,
        scale.get(),
        xToTime,
        yToPrice,
      );
      if (anchor === null) return;

      const next = items.slice();
      if (target === "create" || target === "end") {
        next[index] = { ...next[index], end: anchor };
      } else if (target === "start") {
        next[index] = { ...next[index], start: anchor };
      } else {
        const origin = touchOrigin.get();
        next[index] = translateTrendLine(
          dragOrigin.get(),
          anchor.time - origin.time,
          anchor.value - origin.value,
        );
      }
      drawings.set(next);
    })
    .onFinalize(() => {
      "worklet";
      const target = dragTarget.get();
      const index = dragIndex.get();
      const items = drawings.get();
      if (target === "create" && index >= 0 && index < items.length) {
        const line = projectLine(items[index], scale.get(), timeToX, priceToY);
        const length = Math.hypot(
          line.endX - line.startX,
          line.endY - line.startY,
        );
        if (length < MIN_LINE_LENGTH) {
          const next = items.slice();
          next.splice(index, 1);
          drawings.set(next);
          selectedIndex.set(-1);
          scheduleOnRN(reportStatus, "Drag farther to create a line");
        } else {
          scheduleOnRN(reportCreated, items[index].id);
        }
      } else if (
        target !== "none" &&
        index >= 0 &&
        index < items.length &&
        moved.get()
      ) {
        scheduleOnRN(reportStatus, `Updated ${items[index].id}`);
      }
      dragTarget.set("none");
      dragIndex.set(-1);
      moved.set(false);
    });

  return (
    <Animated.View
      pointerEvents={mode === "browse" ? "none" : "auto"}
      style={StyleSheet.absoluteFill}
    >
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Group clip={plotClip}>
          <Path
            path={allPath}
            style="stroke"
            strokeWidth={2}
            strokeCap="round"
            color="rgba(125, 116, 255, 0.72)"
          />
          <Path
            path={selectedPath}
            style="stroke"
            strokeWidth={3}
            strokeCap="round"
            color={ACCENT}
          />
          <Group opacity={handleOpacity}>
            <Circle
              cx={startHandleX}
              cy={startHandleY}
              r={HANDLE_RADIUS}
              color="#F6F5FF"
            />
            <Circle
              cx={startHandleX}
              cy={startHandleY}
              r={HANDLE_RADIUS}
              color={ACCENT}
              style="stroke"
              strokeWidth={2}
            />
            <Circle
              cx={endHandleX}
              cy={endHandleY}
              r={HANDLE_RADIUS}
              color="#F6F5FF"
            />
            <Circle
              cx={endHandleX}
              cy={endHandleY}
              r={HANDLE_RADIUS}
              color={ACCENT}
              style="stroke"
              strokeWidth={2}
            />
          </Group>
        </Group>
      </Canvas>
      {mode === "browse" ? null : (
        <GestureDetector gesture={gesture}>
          <Animated.View
            testID="trend-line-drawing-surface"
            accessibilityLabel="Trend line drawing surface"
            style={StyleSheet.absoluteFill}
          />
        </GestureDetector>
      )}
    </Animated.View>
  );
}
