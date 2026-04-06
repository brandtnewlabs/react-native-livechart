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
});
