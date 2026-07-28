import { lerp } from "../../src/math/lerp";

describe("lerp", () => {
  it("approaches target over dt", () => {
    const r = lerp(0, 100, 0.1, 16.67);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(100);
  });

  it("uses default dt 16.67", () => {
    expect(lerp(0, 10, 0.5)).toBe(lerp(0, 10, 0.5, 16.67));
  });

  it("snaps to target at speed 1", () => {
    expect(lerp(0, 100, 1)).toBe(100);
  });

  it("snaps at speed 1 with a zero or negative dt", () => {
    // At dt=0 the exponential form stalls instead of snapping. With a negative
    // dt and equal values, 0 ** (dt / frame) is Infinity and 0 * -Infinity
    // poisons the result with NaN.
    expect(lerp(0, 100, 1, 0)).toBe(100);
    expect(lerp(100, 100, 1, -5)).toBe(100);
  });

  it("recovers a NaN current value when snapping", () => {
    expect(lerp(Number.NaN, 100, 1)).toBe(100);
  });

  it("keeps propagating NaN inputs below speed 1", () => {
    // The engine tick relies on this: a NaN displayValue must stay NaN so the
    // y-range block stays skipped (see liveChartEngineTick).
    expect(lerp(Number.NaN, 100, 0.5)).toBeNaN();
  });
});
