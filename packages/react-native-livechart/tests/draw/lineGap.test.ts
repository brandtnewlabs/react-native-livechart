import {
  buildLineGapGeometry,
  buildLineGapSegmentRanges,
  lineGapContainsData,
  previousLineValueAtTime,
} from "../../src/draw/lineGap";
import type { CandleGap, LiveChartPoint } from "../../src/types";

const padding = { top: 10, right: 10, bottom: 10, left: 10 };
const gap: CandleGap = { from: 30, to: 70, kind: "no-trades" };
const data: LiveChartPoint[] = [
  { time: 0, value: 98 },
  { time: 20, value: 100 },
  { time: 80, value: 104 },
  { time: 100, value: 106 },
];

describe("line gap geometry", () => {
  it("splits rendered point ranges instead of interpolating through a gap", () => {
    expect(
      buildLineGapSegmentRanges(
        [0, 1, 20, 2, 80, 3, 100, 4],
        data,
        [gap],
        0,
        120,
        0,
        120,
      ),
    ).toEqual([0, 2, 2, 4]);
  });

  it("keeps one contiguous range when no gap is configured", () => {
    expect(
      buildLineGapSegmentRanges([0, 1, 20, 2, 80, 3], data, [], 0, 120, 0, 120),
    ).toEqual([0, 3]);
  });

  it("lets a real sample inside the interval override gap metadata", () => {
    const conflicting = [...data, { time: 50, value: 102 }].sort(
      (a, b) => a.time - b.time,
    );
    expect(lineGapContainsData(conflicting, gap)).toBe(true);
    expect(
      buildLineGapSegmentRanges(
        [0, 1, 20, 2, 50, 2.5, 80, 3, 100, 4],
        conflicting,
        [gap],
        0,
        120,
        0,
        120,
      ),
    ).toEqual([0, 5]);
  });

  it("builds a clipped previous-value bridge for enabled kinds", () => {
    const result = buildLineGapGeometry(
      data,
      [gap],
      padding,
      320,
      200,
      0,
      120,
      90,
      110,
      true,
      false,
      false,
    );
    expect(result.bridges).toEqual([
      {
        x1: 85,
        x2: 185,
        y: 100,
        kind: "no-trades",
      },
    ]);
  });

  it("honors bridge switches and requires a preceding observation", () => {
    expect(
      buildLineGapGeometry(
        data,
        [gap],
        padding,
        320,
        200,
        0,
        120,
        90,
        110,
        false,
        false,
        false,
      ).bridges,
    ).toEqual([]);
    expect(previousLineValueAtTime(data, 20)).toBe(98);
    expect(previousLineValueAtTime(data, 0)).toBeNull();
  });

  it("rejects degenerate layout inputs", () => {
    expect(
      buildLineGapGeometry(
        data,
        [gap],
        padding,
        0,
        0,
        0,
        0,
        1,
        1,
        true,
        true,
        true,
      ),
    ).toEqual({ bridges: [] });
  });
});
