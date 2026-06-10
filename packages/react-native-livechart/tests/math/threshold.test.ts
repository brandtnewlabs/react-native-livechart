import {
  thresholdLineY,
  thresholdSplitPositions,
  thresholdVisible,
} from "../../src/math/threshold";

// Common geometry: 300px canvas, 12px top inset, 28px bottom inset → 260px plot.
const H = 300;
const TOP = 12;
const BOT = 28;
const CHART_H = H - TOP - BOT; // 260

describe("thresholdLineY", () => {
  it("maps a mid-range value to the matching plot Y", () => {
    // value 50 of [0,100] → halfway down the plot.
    expect(thresholdLineY(50, 0, 100, H, TOP, BOT)).toBeCloseTo(
      TOP + 0.5 * CHART_H,
    );
  });

  it("maps the max value to the plot top, the min to the plot bottom", () => {
    expect(thresholdLineY(100, 0, 100, H, TOP, BOT)).toBeCloseTo(TOP);
    expect(thresholdLineY(0, 0, 100, H, TOP, BOT)).toBeCloseTo(H - BOT);
  });

  it("projects an out-of-range value to an off-plot (but finite) Y", () => {
    const y = thresholdLineY(150, 0, 100, H, TOP, BOT);
    expect(Number.isFinite(y)).toBe(true);
    expect(y).toBeLessThan(TOP);
  });

  it("returns NaN before layout (height 0)", () => {
    expect(thresholdLineY(50, 0, 100, 0, TOP, BOT)).toBeNaN();
  });

  it("returns NaN for a degenerate value range", () => {
    expect(thresholdLineY(50, 50, 50, H, TOP, BOT)).toBeNaN();
  });

  it("returns NaN when insets exceed the canvas height", () => {
    expect(thresholdLineY(50, 0, 100, 30, TOP, BOT)).toBeNaN();
  });
});

describe("thresholdVisible", () => {
  it("is true within the plot, false above / below it", () => {
    expect(thresholdVisible(TOP + 100, H, TOP, BOT)).toBe(true);
    expect(thresholdVisible(TOP - 1, H, TOP, BOT)).toBe(false);
    expect(thresholdVisible(H - BOT + 1, H, TOP, BOT)).toBe(false);
  });

  it("is inclusive of the plot edges", () => {
    expect(thresholdVisible(TOP, H, TOP, BOT)).toBe(true);
    expect(thresholdVisible(H - BOT, H, TOP, BOT)).toBe(true);
  });

  it("is false for NaN or an un-laid-out canvas", () => {
    expect(thresholdVisible(NaN, H, TOP, BOT)).toBe(false);
    expect(thresholdVisible(100, 0, TOP, BOT)).toBe(false);
  });
});

describe("thresholdSplitPositions", () => {
  it("places the hard stop at the threshold's canvas fraction", () => {
    expect(thresholdSplitPositions(150, H)).toEqual([0, 0.5, 0.5, 1]);
  });

  it("clamps to all-below when the threshold is above the canvas", () => {
    expect(thresholdSplitPositions(-20, H)).toEqual([0, 0, 0, 1]);
  });

  it("clamps to all-above when the threshold is below the canvas", () => {
    expect(thresholdSplitPositions(H + 20, H)).toEqual([0, 1, 1, 1]);
  });

  it("falls back to a valid ascending array for NaN / height 0", () => {
    expect(thresholdSplitPositions(NaN, H)).toEqual([0, 1, 1, 1]);
    expect(thresholdSplitPositions(150, 0)).toEqual([0, 1, 1, 1]);
  });
});
