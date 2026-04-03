import { interpolateAtTime } from "./interpolate";

describe("interpolateAtTime", () => {
  it("returns null for empty points", () => {
    expect(interpolateAtTime([], 5)).toBeNull();
  });

  it("clamps before first point", () => {
    const pts = [
      { time: 10, value: 1 },
      { time: 20, value: 2 },
    ];
    expect(interpolateAtTime(pts, 5)).toBe(1);
  });

  it("clamps after last point", () => {
    const pts = [
      { time: 10, value: 1 },
      { time: 20, value: 2 },
    ];
    expect(interpolateAtTime(pts, 25)).toBe(2);
  });

  it("interpolates between two points", () => {
    const pts = [
      { time: 0, value: 0 },
      { time: 10, value: 10 },
    ];
    expect(interpolateAtTime(pts, 5)).toBe(5);
  });

  it("uses binary search for interior point", () => {
    const pts = [
      { time: 0, value: 0 },
      { time: 10, value: 10 },
      { time: 20, value: 30 },
    ];
    expect(interpolateAtTime(pts, 15)).toBe(20);
  });

  it("narrows with multiple segments", () => {
    const pts = [
      { time: 0, value: 0 },
      { time: 10, value: 10 },
      { time: 20, value: 20 },
      { time: 30, value: 30 },
    ];
    expect(interpolateAtTime(pts, 25)).toBe(25);
  });

  it("binary search takes multiple steps", () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({
      time: i * 10,
      value: i,
    }));
    expect(interpolateAtTime(pts, 95)).toBe(9.5);
  });

  it("returns p1 when dt is zero between adjacent points", () => {
    const pts = [
      { time: 5, value: 3 },
      { time: 5, value: 9 },
    ];
    expect(interpolateAtTime(pts, 5)).toBe(3);
  });
});
