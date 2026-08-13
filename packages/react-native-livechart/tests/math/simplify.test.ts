import {
  makeLineSimplifyScratch,
  simplifyLinePoints,
} from "../../src/math/simplify";

function simplify(points: number[], tolerance: number, out: number[] = []) {
  return simplifyLinePoints(
    points,
    tolerance,
    out,
    makeLineSimplifyScratch(),
  );
}

describe("simplifyLinePoints", () => {
  it.each([0, -1, Number.NaN])(
    "copies the exact points when tolerance is %s",
    (tolerance) => {
      const points = [0, 0, 1, 0.2, 2, 0];
      const out = [99];
      expect(simplify(points, tolerance, out)).toBe(out);
      expect(out).toEqual(points);
    },
  );

  it("copies paths with at most two points", () => {
    expect(simplify([0, 0, 1, 1], 1)).toEqual([0, 0, 1, 1]);
  });

  it("removes sub-tolerance wiggle while preserving endpoints", () => {
    const points = [0, 0, 1, 0.2, 2, -0.15, 3, 0.1, 4, 0];
    expect(simplify(points, 0.5)).toEqual([0, 0, 4, 0]);
  });

  it("retains meaningful peaks and valleys in their original order", () => {
    const points = [0, 0, 1, 0.2, 2, 5, 3, -4, 4, 0.1, 5, 0];
    const result = simplify(points, 0.5);
    expect(result.slice(0, 2)).toEqual([0, 0]);
    expect(result.slice(-2)).toEqual([5, 0]);
    expect(result).toEqual(expect.arrayContaining([2, 5, 3, -4]));
    expect(result.indexOf(2)).toBeLessThan(result.indexOf(3));
  });

  it("handles coincident range endpoints", () => {
    expect(simplify([0, 0, 1, 3, 0, 0], 0.5)).toEqual([
      0, 0, 1, 3, 0, 0,
    ]);
  });

  it("bounds worst-case work with retained overlapping range endpoints", () => {
    const points = Array.from({ length: 130 }, (_, i) => [i, 0]).flat();
    expect(simplify(points, 0.5)).toEqual([
      0, 0, 63, 0, 126, 0, 129, 0,
    ]);
  });

  it("leaves an aliased output buffer untouched", () => {
    const points = [0, 0, 1, 0.1, 2, 0];
    expect(
      simplifyLinePoints(points, 1, points, makeLineSimplifyScratch()),
    ).toBe(points);
    expect(points).toEqual([0, 0, 1, 0.1, 2, 0]);
  });
});
