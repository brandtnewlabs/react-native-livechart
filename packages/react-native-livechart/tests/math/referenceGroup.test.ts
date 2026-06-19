import { groupReferenceLines } from "../../src/math/referenceGroup";

describe("groupReferenceLines", () => {
  it("returns all-visible with no groups when lines are far apart", () => {
    const r = groupReferenceLines([10, 100, 200], 18);
    expect(r.hidden).toEqual([false, false, false]);
    expect(r.groups).toEqual([]);
  });

  it("collapses two near lines into one group at their centroid", () => {
    const r = groupReferenceLines([100, 110], 18);
    expect(r.hidden).toEqual([true, true]);
    expect(r.groups).toEqual([{ cy: 105, count: 2 }]);
  });

  it("chains three near lines into a single group", () => {
    const r = groupReferenceLines([100, 110, 120], 18);
    expect(r.hidden).toEqual([true, true, true]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].count).toBe(3);
    expect(r.groups[0].cy).toBeCloseTo(110);
  });

  it("keeps a distant singleton out of a nearby cluster (order-independent)", () => {
    // Indices 0 and 2 are near; index 1 is far — clustering sorts by Y first.
    const r = groupReferenceLines([100, 300, 110], 18);
    expect(r.hidden).toEqual([true, false, true]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].count).toBe(2);
  });

  it("skips -1 (non-Form-A / off-canvas) entries", () => {
    const r = groupReferenceLines([-1, 100, 110, -1], 18);
    expect(r.hidden).toEqual([false, true, true, false]);
    expect(r.groups).toHaveLength(1);
  });

  it("groups at exactly the radius gap, but not beyond", () => {
    expect(groupReferenceLines([100, 118], 18).groups).toHaveLength(1); // gap == radius
    expect(groupReferenceLines([100, 119], 18).groups).toHaveLength(0); // gap > radius
  });

  it("disables grouping for a non-positive radius", () => {
    const r = groupReferenceLines([100, 105], 0);
    expect(r.hidden).toEqual([false, false]);
    expect(r.groups).toEqual([]);
  });

  it("returns empty for no lines", () => {
    expect(groupReferenceLines([], 18)).toEqual({ hidden: [], groups: [] });
  });
});
