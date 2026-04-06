import type { CandlePoint } from "../types";
import { pickCandleAtTime } from "./pickCandle";

const makeCandle = (
  time: number,
  o = 100,
  h = 110,
  l = 90,
  c = 105,
): CandlePoint => ({
  time,
  open: o,
  high: h,
  low: l,
  close: c,
});

describe("pickCandleAtTime", () => {
  const candles: CandlePoint[] = [
    makeCandle(1000),
    makeCandle(1060),
    makeCandle(1120),
  ];
  const width = 60;

  it("returns null for empty candles and no live candle", () => {
    expect(pickCandleAtTime([], null, 1030, width)).toBeNull();
  });

  it("picks a candle whose bucket contains the time", () => {
    const result = pickCandleAtTime(candles, null, 1030, width);
    expect(result).toEqual(candles[0]);
  });

  it("picks the second candle at 1060", () => {
    const result = pickCandleAtTime(candles, null, 1060, width);
    expect(result).toEqual(candles[1]);
  });

  it("picks the last candle near its end", () => {
    const result = pickCandleAtTime(candles, null, 1179, width);
    expect(result).toEqual(candles[2]);
  });

  it("returns null before the first candle", () => {
    expect(pickCandleAtTime(candles, null, 999, width)).toBeNull();
  });

  it("returns null after the last candle ends", () => {
    expect(pickCandleAtTime(candles, null, 1180, width)).toBeNull();
  });

  it("picks the live candle when time falls in its bucket", () => {
    const live = makeCandle(1180, 100, 115, 95, 108);
    const result = pickCandleAtTime(candles, live, 1200, width);
    expect(result).toEqual(live);
  });

  it("prefers the live candle over committed candles when overlapping", () => {
    const live = makeCandle(1120, 100, 120, 80, 110);
    const result = pickCandleAtTime(candles, live, 1140, width);
    expect(result).toEqual(live);
  });

  it("falls back to committed candle when time is outside live bucket", () => {
    const live = makeCandle(1180, 100, 115, 95, 108);
    const result = pickCandleAtTime(candles, live, 1090, width);
    expect(result).toEqual(candles[1]);
  });

  it("returns null when time is between candle gaps", () => {
    const sparse = [makeCandle(1000), makeCandle(1200)];
    expect(pickCandleAtTime(sparse, null, 1100, width)).toBeNull();
  });
});
