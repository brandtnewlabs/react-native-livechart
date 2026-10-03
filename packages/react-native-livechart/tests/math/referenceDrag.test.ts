import {
  clampToBounds,
  nearestDraggableIndex,
  referenceDragOwnsTouch,
  referenceValueOut,
  resolveDragIntent,
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

  it("with grab ranges, grabs a line only inside its range (ends included)", () => {
    const ranges: [number, number][] = [[10, 90]];
    expect(nearestDraggableIndex([50], 52, 14, { x: 40, ranges })).toBe(0);
    expect(nearestDraggableIndex([50], 52, 14, { x: 10, ranges })).toBe(0);
    expect(nearestDraggableIndex([50], 52, 14, { x: 90, ranges })).toBe(0);
    expect(nearestDraggableIndex([50], 52, 14, { x: 91, ranges })).toBe(-1);
    expect(nearestDraggableIndex([50], 52, 14, { x: 9, ranges })).toBe(-1);
    expect(nearestDraggableIndex([50], 52, 14, { x: 300, ranges })).toBe(-1);
  });

  it("with grab ranges, a line without one is grabbed anywhere along it", () => {
    expect(
      nearestDraggableIndex([50], 52, 14, { x: 300, ranges: [null] }),
    ).toBe(0);
    expect(nearestDraggableIndex([50], 52, 14, { x: 300, ranges: [] })).toBe(0);
  });

  it("skips an out-of-range line for one in reach whose range holds the touch", () => {
    // Two lines 8 px apart: the touch is nearer line 1, but outside its range.
    const ranges: ([number, number] | null)[] = [
      [0, 120],
      [0, 60],
    ];
    expect(nearestDraggableIndex([50, 58], 57, 14, { x: 100, ranges })).toBe(0);
    expect(nearestDraggableIndex([50, 58], 57, 14, { x: 40, ranges })).toBe(1);
  });

  it("never grabs a reversed range, and includes a zero-width range's point", () => {
    for (const x of [0, 10, 50, 90, 100]) {
      expect(nearestDraggableIndex([50], 50, 14, { x, ranges: [[90, 10]] })).toBe(-1);
    }
    expect(nearestDraggableIndex([50], 50, 14, { x: 10, ranges: [[10, 10]] })).toBe(0);
    expect(nearestDraggableIndex([50], 50, 14, { x: 11, ranges: [[10, 10]] })).toBe(-1);
  });
});

describe("referenceDragOwnsTouch", () => {
  it("falls back to the handle reach when no line is grabbed", () => {
    expect(referenceDragOwnsTouch(-1, [100, 200], 105, 14)).toBe(true);
    expect(referenceDragOwnsTouch(-1, [100, 200], 150, 14)).toBe(false);
    expect(referenceDragOwnsTouch(-1, [], 150, 14)).toBe(false);
  });

  it("owns the touch while a line is grabbed, wherever the finger is said to be", () => {
    // The scrub pan asks with its touch-down point; a drag has since carried the
    // line 80 px away from it — the drag still owns the touch.
    expect(referenceDragOwnsTouch(0, [180], 100, 14)).toBe(true);
    expect(referenceDragOwnsTouch(1, [-1, 400], 0, 14)).toBe(true);
  });

  it("respects grab ranges when no line is grabbed, and ignores them while one is", () => {
    const grab = { x: 300, ranges: [[10, 90] as [number, number]] };
    expect(referenceDragOwnsTouch(-1, [100], 102, 14, grab)).toBe(false);
    expect(referenceDragOwnsTouch(-1, [100], 102, 14, { ...grab, x: 50 })).toBe(
      true,
    );
    expect(referenceDragOwnsTouch(0, [100], 102, 14, grab)).toBe(true);
  });
});

describe("resolveDragIntent", () => {
  it("waits until the travel passes the threshold", () => {
    expect(resolveDragIntent(0, 0, 4)).toBe("wait");
    expect(resolveDragIntent(4, 4, 4)).toBe("wait"); // exactly at threshold (not past)
    expect(resolveDragIntent(-4, -4, 4)).toBe("wait");
  });

  it("activates on vertical travel past the threshold", () => {
    expect(resolveDragIntent(0, 5, 4)).toBe("activate");
    expect(resolveDragIntent(1, -6, 4)).toBe("activate");
  });

  it("activates on horizontal / diagonal travel too (drag owns the touch, #163)", () => {
    expect(resolveDragIntent(5, 0, 4)).toBe("activate");
    // Horizontal-dominant start that previously fell through to scrub now drags.
    expect(resolveDragIntent(8, 2, 4)).toBe("activate");
    expect(resolveDragIntent(-9, 1, 4)).toBe("activate");
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
