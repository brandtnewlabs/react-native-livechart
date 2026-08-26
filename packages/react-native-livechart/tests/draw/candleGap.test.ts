import { buildCandleGapGeometry } from "../../src/draw/candleGap";
import type { CandleGap, CandlePoint } from "../../src/types";

const padding = { top: 10, right: 10, bottom: 10, left: 10 };
const candle = (time: number, close: number): CandlePoint => ({
  time,
  open: close - 1,
  high: close + 2,
  low: close - 2,
  close,
});

function geometry(
  gaps: CandleGap[],
  candles: CandlePoint[] = [candle(0, 100), candle(180, 106)],
) {
  return buildCandleGapGeometry(
    candles,
    null,
    gaps,
    padding,
    320,
    200,
    0,
    240,
    90,
    110,
    60,
    true,
    true,
    false,
  );
}

describe("buildCandleGapGeometry", () => {
  it("emits neutral marks for each fully covered missing bucket", () => {
    const result = geometry([
      { from: 60, to: 180, kind: "no-trades" },
    ]);
    expect(result.marks.map((mark) => mark.kind)).toEqual([
      "no-trades",
      "no-trades",
    ]);
    expect(result.marks[0].y).toBeCloseTo(100);
  });

  it("skips a real candle that conflicts with gap metadata", () => {
    const result = geometry(
      [{ from: 60, to: 180, kind: "no-trades" }],
      [candle(0, 100), candle(60, 102), candle(180, 106)],
    );
    expect(result.marks).toHaveLength(1);
    expect(result.marks[0].y).toBeCloseTo(82);
  });

  it("honors semantic bridge switches", () => {
    const result = geometry([
      { from: 60, to: 120, kind: "unavailable" },
      { from: 120, to: 180, kind: "unknown" },
    ]);
    expect(result.marks.map((mark) => mark.kind)).toEqual(["unavailable"]);
  });

  it("does not fabricate a price without a preceding observation", () => {
    expect(
      geometry([{ from: 0, to: 120, kind: "no-trades" }], []).marks,
    ).toEqual([]);
  });

  it("rejects degenerate layout inputs", () => {
    expect(
      buildCandleGapGeometry(
        [],
        null,
        [],
        padding,
        0,
        0,
        0,
        0,
        1,
        1,
        0,
        true,
        true,
        true,
      ),
    ).toEqual({ marks: [] });
  });
});
