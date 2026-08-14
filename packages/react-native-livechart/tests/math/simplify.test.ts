import {
  makeLineSimplifyScratch,
  simplifyLinePoints,
} from "../../src/math/simplify";

function simplify(
  points: number[],
  tolerance: number,
  out: number[] = [],
  absoluteXOffset = 0,
) {
  return simplifyLinePoints(
    points,
    tolerance,
    out,
    makeLineSimplifyScratch(),
    absoluteXOffset,
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

  it("bounds worst-case work with retained fixed-grid range endpoints", () => {
    const points = Array.from({ length: 130 }, (_, i) => [i, 0]).flat();
    expect(simplify(points, 0.5)).toEqual([
      0, 0, 29, 0, 30, 0, 59, 0, 60, 0, 89, 0, 90, 0, 119, 0, 120, 0,
      129, 0,
    ]);
  });

  it("keeps retained interior geometry stable while a live window advances", () => {
    const frame = (startX: number) =>
      Array.from({ length: 201 }, (_, i) => {
        const absoluteX = startX + i;
        const y =
          Math.sin(absoluteX * 0.31) * 4 +
          (absoluteX % 17 === 0 ? 8 : 0);
        return [absoluteX - startX, y];
      }).flat();
    const retainedInterior = (startX: number) => {
      const result = simplify(frame(startX), 1, [], startX);
      const retained: number[] = [];
      for (let i = 0; i < result.length; i += 2) {
        const absoluteX = result[i] + startX;
        if (absoluteX > 40 && absoluteX < 160) retained.push(absoluteX);
      }
      return retained;
    };

    expect(retainedInterior(0)).toEqual(retainedInterior(1));
  });

  it("leaves an aliased output buffer untouched", () => {
    const points = [0, 0, 1, 0.1, 2, 0];
    expect(
      simplifyLinePoints(points, 1, points, makeLineSimplifyScratch()),
    ).toBe(points);
    expect(points).toEqual([0, 0, 1, 0.1, 2, 0]);
  });
});
