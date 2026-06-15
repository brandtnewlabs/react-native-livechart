import { drawSpline, splineValueAtTime } from "../../src/math/spline";

function makePath() {
  return {
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    cubicTo: jest.fn(),
    close: jest.fn(),
  };
}

describe("drawSpline", () => {
  it("returns early when fewer than 4 floats (n < 2)", () => {
    const path = makePath();
    drawSpline(path as never, [0, 0]);
    expect(path.lineTo).not.toHaveBeenCalled();
    expect(path.cubicTo).not.toHaveBeenCalled();
  });

  it("uses lineTo for exactly two points", () => {
    const path = makePath();
    drawSpline(path as never, [0, 0, 10, 5]);
    expect(path.lineTo).toHaveBeenCalledWith(10, 5);
    expect(path.cubicTo).not.toHaveBeenCalled();
  });

  it("draws cubic segments for three or more points", () => {
    const path = makePath();
    drawSpline(path as never, [0, 0, 5, 5, 10, 0]);
    expect(path.cubicTo).toHaveBeenCalled();
  });

  it("draws straight segments (lineTo per point) when linear", () => {
    const path = makePath();
    drawSpline(path as never, [0, 0, 5, 5, 10, 0], undefined, true);
    expect(path.lineTo).toHaveBeenCalledWith(5, 5);
    expect(path.lineTo).toHaveBeenCalledWith(10, 0);
    expect(path.cubicTo).not.toHaveBeenCalled();
  });

  it("handles zero delta x (flat vertical segment)", () => {
    const path = makePath();
    drawSpline(path as never, [0, 0, 0, 10, 10, 10]);
    expect(path.cubicTo).toHaveBeenCalled();
  });

  it("handles sign change in delta (monotone m[i]=0)", () => {
    const path = makePath();
    drawSpline(path as never, [0, 10, 10, 5, 20, 10]);
    expect(path.cubicTo).toHaveBeenCalled();
  });

  it("uses average slope when segment deltas share sign", () => {
    const path = makePath();
    drawSpline(path as never, [0, 0, 10, 5, 20, 25, 30, 30]);
    expect(path.cubicTo).toHaveBeenCalled();
  });

  it("scales tangents when Fritsch-Carlson s2 exceeds 9", () => {
    const path = makePath();
    // Steep middle segment vs shallow first: alpha,beta large => s2 > 9
    drawSpline(path as never, [0, 0, 1, 0.01, 2, 50, 4, 0.01]);
    expect(path.cubicTo.mock.calls.length).toBeGreaterThan(0);
  });

  it("handles Fritsch-Carlson s2 > 9 scaling (alternate steep profile)", () => {
    const path = makePath();
    drawSpline(path as never, [0, 0, 2, 80, 4, 0, 6, 80, 8, 0]);
    expect(path.cubicTo.mock.calls.length).toBeGreaterThan(0);
  });

  it("handles delta[i] === 0 in constraint loop", () => {
    const path = makePath();
    drawSpline(path as never, [0, 0, 5, 5, 5, 10, 10, 10]);
    expect(path.cubicTo).toHaveBeenCalled();
  });
});

describe("splineValueAtTime", () => {
  const pts = [
    { time: 0, value: 0 },
    { time: 10, value: 10 },
    { time: 20, value: 5 },
  ];

  it("returns null for empty data", () => {
    expect(splineValueAtTime([], 5)).toBeNull();
  });

  it("returns the only value for a single point", () => {
    expect(splineValueAtTime([{ time: 0, value: 7 }], 99)).toBe(7);
  });

  it("clamps to the endpoints outside the data range", () => {
    expect(splineValueAtTime(pts, -5)).toBe(0);
    expect(splineValueAtTime(pts, 25)).toBe(5);
  });

  it("passes exactly through data vertices (like the rendered curve)", () => {
    expect(splineValueAtTime(pts, 0)).toBeCloseTo(0);
    expect(splineValueAtTime(pts, 10)).toBeCloseTo(10);
    expect(splineValueAtTime(pts, 20)).toBeCloseTo(5);
  });

  it("is linear for exactly two points (matches drawSpline's n===2 lineTo)", () => {
    const two = [
      { time: 0, value: 0 },
      { time: 10, value: 20 },
    ];
    expect(splineValueAtTime(two, 5)).toBeCloseTo(10);
    expect(splineValueAtTime(two, 2.5)).toBeCloseTo(5);
  });

  it("bows off the linear chord between vertices (curved, no overshoot)", () => {
    // Midpoint of the rising segment: linear chord would be 5; the monotone
    // cubic curves above it but never overshoots the [0, 10] vertex range.
    const mid = splineValueAtTime(pts, 5) as number;
    expect(mid).not.toBeCloseTo(5);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThanOrEqual(10);
  });
});
