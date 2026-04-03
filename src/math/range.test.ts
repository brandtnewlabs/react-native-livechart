import { computeRange } from "./range";

describe("computeRange", () => {
  it("expands small range to minRange when exaggerate false", () => {
    const r = computeRange([{ time: 0, value: 1 }], 1, undefined, false);
    expect(r.max - r.min).toBeGreaterThanOrEqual(0.399);
  });

  it("uses exaggerate margins", () => {
    const r = computeRange([{ time: 0, value: 1 }], 1, undefined, true);
    expect(r.max - r.min).toBeGreaterThan(0);
  });

  it("includes current value in range", () => {
    const r = computeRange([{ time: 0, value: 10 }], 50, undefined, false);
    expect(r.min).toBeLessThanOrEqual(10);
    expect(r.max).toBeGreaterThanOrEqual(50);
  });

  it("includes reference value", () => {
    const r = computeRange([{ time: 0, value: 10 }], 20, 100, false);
    expect(r.max).toBeGreaterThanOrEqual(100);
  });

  it("pulls min down when reference is below data range", () => {
    const r = computeRange(
      [{ time: 0, value: 10 }, { time: 1, value: 20 }],
      15,
      5,
      false,
    );
    expect(r.min).toBeLessThanOrEqual(5);
  });

  it("expands min when current is below data min", () => {
    const r = computeRange([{ time: 0, value: 50 }], 10, undefined, false);
    expect(r.min).toBeLessThanOrEqual(10);
  });

  it("expands max when current is above data max", () => {
    const r = computeRange([{ time: 0, value: 10 }], 100, undefined, false);
    expect(r.max).toBeGreaterThanOrEqual(100);
  });

  it("does not expand when reference is strictly inside data min and max", () => {
    const r = computeRange(
      [
        { time: 0, value: 10 },
        { time: 1, value: 20 },
      ],
      15,
      12,
      false,
    );
    expect(r.min).toBeLessThanOrEqual(10);
    expect(r.max).toBeGreaterThanOrEqual(20);
  });

  it("shrinks reference inside range without changing min/max beyond margin", () => {
    const r = computeRange(
      [
        { time: 0, value: 0 },
        { time: 1, value: 100 },
      ],
      50,
      50,
      false,
    );
    expect(r.min).toBeLessThan(0);
    expect(r.max).toBeGreaterThan(100);
  });

  it("does not widen min/max when point is inside current bounds", () => {
    const r = computeRange(
      [
        { time: 0, value: 100 },
        { time: 1, value: 50 },
        { time: 2, value: 80 },
      ],
      75,
      undefined,
      false,
    );
    expect(r.min).toBeLessThanOrEqual(50);
    expect(r.max).toBeGreaterThanOrEqual(100);
  });

  it("applies margin when raw range exceeds minRange", () => {
    const r = computeRange(
      [
        { time: 0, value: 0 },
        { time: 1, value: 100 },
      ],
      50,
      undefined,
      false,
    );
    expect(r.max - r.min).toBeGreaterThan(100);
  });
});
