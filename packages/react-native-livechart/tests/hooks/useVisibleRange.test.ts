import { isNearStart, rangeSignature } from "../../src/hooks/useVisibleRange";

describe("rangeSignature", () => {
  it("rounds each edge to integer seconds (throttle key)", () => {
    expect(rangeSignature(1000.2, 1100.8, false)).toBe("1000|1101|0");
  });

  it("encodes the near-start flag", () => {
    expect(rangeSignature(1000, 1100, true)).toBe("1000|1100|1");
  });

  it("is stable across sub-second drift (so a live chart throttles)", () => {
    expect(rangeSignature(1000.1, 1100.1, false)).toBe(
      rangeSignature(1000.4, 1099.6, false),
    );
  });

  it("changes once the edges cross a whole second", () => {
    expect(rangeSignature(1000.4, 1100, false)).not.toBe(
      rangeSignature(1001.4, 1100, false),
    );
  });
});

describe("isNearStart", () => {
  it("is true when the left edge is within the threshold of the oldest data", () => {
    // winStart 1010 ≤ minTime 1000 + threshold 30.
    expect(isNearStart(1010, 1000, 30)).toBe(true);
  });

  it("is true exactly at the threshold boundary", () => {
    expect(isNearStart(1030, 1000, 30)).toBe(true);
  });

  it("is false when the left edge is still far from the oldest data", () => {
    expect(isNearStart(1031, 1000, 30)).toBe(false);
  });
});
