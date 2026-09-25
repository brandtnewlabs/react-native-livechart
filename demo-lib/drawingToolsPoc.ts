/**
 * Serializable time/price anchor used by the drawing-tools proof of concept.
 * The POC deliberately stores domain coordinates rather than screen pixels so
 * its geometry keeps following the chart while the live scale moves.
 */
export interface DrawingAnchor {
  time: number;
  value: number;
}

/** One finite, two-anchor trend-line segment. */
export interface TrendLineDrawing {
  id: string;
  start: DrawingAnchor;
  end: DrawingAnchor;
}

export type TrendLineDragTarget = "none" | "start" | "end" | "body";

/** Screen-space line used only for touch hit-testing. */
export interface ScreenTrendLine {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/** Clamp a touch coordinate into one plot-axis interval. */
export function clampDrawingCoordinate(
  coordinate: number,
  min: number,
  max: number,
): number {
  "worklet";
  return Math.min(max, Math.max(min, coordinate));
}

/** Euclidean distance from a point to a finite screen-space segment. */
export function distanceToSegment(
  x: number,
  y: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  "worklet";
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0) return Math.hypot(x - startX, y - startY);

  const projected = ((x - startX) * dx + (y - startY) * dy) / lengthSquared;
  const t = Math.min(1, Math.max(0, projected));
  const nearestX = startX + dx * t;
  const nearestY = startY + dy * t;
  return Math.hypot(x - nearestX, y - nearestY);
}

/**
 * Hit-test one line. Endpoint handles intentionally win over its body so the
 * selected line remains precise to edit even on a small mobile canvas.
 */
export function hitTestTrendLine(
  line: ScreenTrendLine,
  x: number,
  y: number,
  handleRadius: number,
  lineRadius: number,
): TrendLineDragTarget {
  "worklet";
  if (Math.hypot(x - line.startX, y - line.startY) <= handleRadius) {
    return "start";
  }
  if (Math.hypot(x - line.endX, y - line.endY) <= handleRadius) {
    return "end";
  }
  return distanceToSegment(
    x,
    y,
    line.startX,
    line.startY,
    line.endX,
    line.endY,
  ) <= lineRadius
    ? "body"
    : "none";
}

/** Translate both anchors by one domain-space delta. */
export function translateTrendLine(
  line: TrendLineDrawing,
  timeDelta: number,
  valueDelta: number,
): TrendLineDrawing {
  "worklet";
  return {
    ...line,
    start: {
      time: line.start.time + timeDelta,
      value: line.start.value + valueDelta,
    },
    end: {
      time: line.end.time + timeDelta,
      value: line.end.value + valueDelta,
    },
  };
}
