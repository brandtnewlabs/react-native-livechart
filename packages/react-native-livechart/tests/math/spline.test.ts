import { drawSpline } from "../../src/math/spline";

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
