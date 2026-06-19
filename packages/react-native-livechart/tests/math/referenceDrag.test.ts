import {
  clampToBounds,
  nearestDraggableIndex,
  referenceValueOut,
} from "../../src/math/referenceDrag";

describe("clampToBounds", () => {
  it("returns the value unchanged without bounds", () => {
    expect(clampToBounds(5)).toBe(5);
    expect(clampToBounds(-100)).toBe(-100);
  });

  it("clamps below min and above max", () => {
    expect(clampToBounds(-1, [0, 10])).toBe(0);
    expect(clampToBounds(11, [0, 10])).toBe(10);
    expect(clampToBounds(5, [0, 10])).toBe(5);
  });

  it("accepts reversed bounds", () => {
    expect(clampToBounds(5, [10, 0])).toBe(5);
    expect(clampToBounds(-1, [10, 0])).toBe(0);
    expect(clampToBounds(99, [10, 0])).toBe(10);
  });
});

describe("nearestDraggableIndex", () => {
  it("returns -1 when none is within slop", () => {
    expect(nearestDraggableIndex([100, 200], 10, 14)).toBe(-1);
  });

  it("returns -1 for an empty list", () => {
    expect(nearestDraggableIndex([], 10, 14)).toBe(-1);
  });

  it("skips -1 (non-draggable / off-screen) entries", () => {
    expect(nearestDraggableIndex([-1, 50], 52, 14)).toBe(1);
  });

  it("picks the nearest line within slop", () => {
    expect(nearestDraggableIndex([40, 60], 58, 14)).toBe(1);
    expect(nearestDraggableIndex([40, 60], 44, 14)).toBe(0);
  });

  it("favors the later (topmost-drawn) index on a tie", () => {
    expect(nearestDraggableIndex([50, 50], 50, 14)).toBe(1);
  });
});

describe("referenceValueOut", () => {
  it("uses the visible range when no bounds are given", () => {
    expect(referenceValueOut(5, 0, 10)).toBe(false);
    expect(referenceValueOut(-1, 0, 10)).toBe(true);
    expect(referenceValueOut(11, 0, 10)).toBe(true);
  });

  it("treats the exact visible bounds as in-range", () => {
    expect(referenceValueOut(0, 0, 10)).toBe(false);
    expect(referenceValueOut(10, 0, 10)).toBe(false);
  });

  it("watches the bounds interval when provided (at-or-past a bound is out)", () => {
    expect(referenceValueOut(5, 0, 100, [0, 10])).toBe(false);
    expect(referenceValueOut(10, 0, 100, [0, 10])).toBe(true);
    expect(referenceValueOut(0, 0, 100, [0, 10])).toBe(true);
    expect(referenceValueOut(11, 0, 100, [0, 10])).toBe(true);
  });

  it("accepts reversed bounds", () => {
    expect(referenceValueOut(5, 0, 100, [10, 0])).toBe(false);
    expect(referenceValueOut(10, 0, 100, [10, 0])).toBe(true);
  });
});
