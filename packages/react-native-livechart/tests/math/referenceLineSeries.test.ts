import { DEFAULT_PADDING } from "../../src/draw/line";
import { buildReferenceLineSeriesPoints } from "../../src/math/referenceLineSeries";

const NOW = 100;
const WINDOW = 40;
const WIDTH = 220;
const HEIGHT = 140;

describe("buildReferenceLineSeriesPoints", () => {
  const points = [
    { time: 50, value: 4 },
    { time: 70, value: 6 },
    { time: 90, value: 8 },
  ];

  it("interpolates the window edge and extends the last value to now", () => {
    const result = buildReferenceLineSeriesPoints(
      points,
      NOW,
      WINDOW,
      0,
      10,
      WIDTH,
      HEIGHT,
      DEFAULT_PADDING,
      true,
    );
    const plotRight = WIDTH - DEFAULT_PADDING.right;
    expect(result[0]).toBe(DEFAULT_PADDING.left);
    expect(result[result.length - 2]).toBe(plotRight);
    expect(result).toHaveLength(8);
  });

  it("stops at the final point when extendToNow is false", () => {
    const result = buildReferenceLineSeriesPoints(
      points,
      NOW,
      WINDOW,
      0,
      10,
      WIDTH,
      HEIGHT,
      DEFAULT_PADDING,
      false,
    );
    const plotWidth = WIDTH - DEFAULT_PADDING.left - DEFAULT_PADDING.right;
    const expectedEndX = DEFAULT_PADDING.left + (30 / WINDOW) * plotWidth;
    expect(result[result.length - 2]).toBeCloseTo(expectedEndX);
  });

  it("returns empty geometry when an ended series is left of the window", () => {
    expect(
      buildReferenceLineSeriesPoints(
        [{ time: 20, value: 5 }],
        NOW,
        WINDOW,
        0,
        10,
        WIDTH,
        HEIGHT,
        DEFAULT_PADDING,
        false,
      ),
    ).toEqual([]);
  });

  it("reuses and clears the supplied output buffer", () => {
    const out = [999, 999];
    expect(
      buildReferenceLineSeriesPoints(
        points,
        NOW,
        WINDOW,
        0,
        10,
        WIDTH,
        HEIGHT,
        DEFAULT_PADDING,
        true,
        out,
      ),
    ).toBe(out);
    expect(out).not.toContain(999);
  });
});
