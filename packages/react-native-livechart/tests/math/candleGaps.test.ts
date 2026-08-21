import {
  candleGapBucketStartAtTime,
  candleGapDefaultLabel,
  pickCandleGapAtTime,
  previousCandleAtTime,
  previousCandleCloseAtTime,
} from "../../src/math/candleGaps";
import type { CandleGap, CandlePoint } from "../../src/types";

const candle = (time: number, close: number): CandlePoint => ({
  time,
  open: close - 1,
  high: close + 2,
  low: close - 2,
  close,
});

const gaps: CandleGap[] = [
  { from: 1_060, to: 1_180, kind: "no-trades" },
  { from: 1_240, to: 1_360, kind: "unavailable" },
];

describe("candle gap math", () => {
  it("picks half-open sorted intervals", () => {
    expect(pickCandleGapAtTime(gaps, 1_059)).toBeNull();
    expect(pickCandleGapAtTime(gaps, 1_060)).toBe(gaps[0]);
    expect(pickCandleGapAtTime(gaps, 1_179)).toBe(gaps[0]);
    expect(pickCandleGapAtTime(gaps, 1_180)).toBeNull();
    expect(pickCandleGapAtTime(gaps, 1_300)).toBe(gaps[1]);
  });

  it("finds the latest committed or live anchor strictly before time", () => {
    const candles = [candle(1_000, 100), candle(1_180, 110)];
    const live = candle(1_240, 120);
    expect(previousCandleAtTime(candles, live, 999)).toBeNull();
    expect(previousCandleCloseAtTime(candles, live, 1_100)).toBe(100);
    expect(previousCandleCloseAtTime(candles, live, 1_250)).toBe(120);
  });

  it("aligns selectable no-trade buckets to the preceding candle", () => {
    const candles = [candle(1_000, 100), candle(1_180, 110)];
    expect(
      candleGapBucketStartAtTime(gaps[0], 1_090, candles, null, 60),
    ).toBe(1_060);
    expect(
      candleGapBucketStartAtTime(gaps[0], 1_150, candles, null, 60),
    ).toBe(1_120);
    expect(
      candleGapBucketStartAtTime(gaps[1], 1_270, candles, null, 60),
    ).toBeNull();
  });

  it("does not select a conflicting real candle or an unanchored gap", () => {
    const gap = { from: 1_060, to: 1_180, kind: "no-trades" } as const;
    expect(
      candleGapBucketStartAtTime(
        gap,
        1_090,
        [candle(1_000, 100), candle(1_060, 101)],
        null,
        60,
      ),
    ).toBeNull();
    expect(candleGapBucketStartAtTime(gap, 1_090, [], null, 60)).toBeNull();
  });

  it("provides stable default labels", () => {
    expect(candleGapDefaultLabel("no-trades")).toBe("No trades");
    expect(candleGapDefaultLabel("unavailable")).toBe("Trading unavailable");
    expect(candleGapDefaultLabel("unknown")).toBe("Data unavailable");
  });
});
