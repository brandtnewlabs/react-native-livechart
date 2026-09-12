import {
  clampDrawingCoordinate,
  distanceToSegment,
  hitTestTrendLine,
  translateTrendLine,
  type ScreenTrendLine,
  type TrendLineDrawing,
} from "./drawingToolsPoc";

const LINE: ScreenTrendLine = {
  startX: 10,
  startY: 20,
  endX: 110,
  endY: 20,
};

describe("drawing-tools POC geometry", () => {
  test("clamps touch coordinates to the plot", () => {
    expect(clampDrawingCoordinate(-5, 10, 90)).toBe(10);
    expect(clampDrawingCoordinate(42, 10, 90)).toBe(42);
    expect(clampDrawingCoordinate(120, 10, 90)).toBe(90);
  });

  test("measures distance to the finite segment, including past its ends", () => {
    expect(distanceToSegment(60, 30, 10, 20, 110, 20)).toBe(10);
    expect(distanceToSegment(0, 20, 10, 20, 110, 20)).toBe(10);
    expect(distanceToSegment(13, 24, 10, 20, 10, 20)).toBe(5);
  });

  test("gives endpoint handles priority over the line body", () => {
    expect(hitTestTrendLine(LINE, 12, 21, 12, 8)).toBe("start");
    expect(hitTestTrendLine(LINE, 108, 21, 12, 8)).toBe("end");
    expect(hitTestTrendLine(LINE, 60, 25, 12, 8)).toBe("body");
    expect(hitTestTrendLine(LINE, 60, 40, 12, 8)).toBe("none");
  });

  test("translates both anchors without mutating the source", () => {
    const line: TrendLineDrawing = {
      id: "line-1",
      start: { time: 100, value: 20 },
      end: { time: 140, value: 30 },
    };

    expect(translateTrendLine(line, 5, -2)).toEqual({
      id: "line-1",
      start: { time: 105, value: 18 },
      end: { time: 145, value: 28 },
    });
    expect(line.start).toEqual({ time: 100, value: 20 });
  });
});
