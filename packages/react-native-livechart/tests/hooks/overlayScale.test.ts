import {
  priceToY,
  timeToX,
  xToTime,
  yToPrice,
} from "../../src/hooks/overlayScale";
import type { ChartScale } from "../../src/types";

// plot: left=12, top=12, right=320, bottom=272 → chartH=260, chartW=308.
// range 0..100, window 30s ending at now=0 (winStart=-30).
const SCALE: ChartScale = {
  min: 0,
  max: 100,
  window: 30,
  now: 0,
  plot: { left: 12, top: 12, right: 320, bottom: 272, width: 400, height: 300 },
};

/** A scale whose plot has no height/width (canvas not laid out yet). */
const UNLAID: ChartScale = {
  ...SCALE,
  plot: { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
};

describe("priceToY", () => {
  it("maps the range bounds to the plot top / bottom", () => {
    expect(priceToY(100, SCALE)).toBeCloseTo(12); // max → top
    expect(priceToY(0, SCALE)).toBeCloseTo(272); // min → bottom
    expect(priceToY(50, SCALE)).toBeCloseTo(142); // mid
  });

  it("returns -1 when the canvas is not laid out", () => {
    expect(priceToY(50, UNLAID)).toBe(-1);
  });

  it("pins to the plot center for a degenerate range", () => {
    expect(priceToY(50, { ...SCALE, min: 50, max: 50 })).toBeCloseTo(142);
  });
});

describe("yToPrice", () => {
  it("is the inverse of priceToY", () => {
    for (const price of [0, 25, 50, 75, 100]) {
      expect(yToPrice(priceToY(price, SCALE), SCALE)).toBeCloseTo(price);
    }
  });

  it("clamps to the visible range outside the plot", () => {
    expect(yToPrice(-100, SCALE)).toBeCloseTo(100); // above top → max
    expect(yToPrice(9999, SCALE)).toBeCloseTo(0); // below bottom → min
  });

  it("returns null when the canvas is not laid out", () => {
    expect(yToPrice(50, UNLAID)).toBeNull();
  });

  it("collapses to the single value for a degenerate range", () => {
    expect(yToPrice(142, { ...SCALE, min: 50, max: 50 })).toBe(50);
  });
});

describe("timeToX / xToTime", () => {
  it("map the plot edges to the window start and now", () => {
    expect(timeToX(-30, SCALE)).toBeCloseTo(12); // winStart → left
    expect(timeToX(0, SCALE)).toBeCloseTo(320); // now → right
    expect(xToTime(12, SCALE)).toBeCloseTo(-30);
    expect(xToTime(320, SCALE)).toBeCloseTo(0);
  });

  it("round-trip across the plot", () => {
    for (const x of [12, 100, 200, 320]) {
      expect(timeToX(xToTime(x, SCALE), SCALE)).toBeCloseTo(x);
    }
  });

  it("return -1 when the canvas is not laid out", () => {
    expect(timeToX(0, UNLAID)).toBe(-1);
    expect(xToTime(0, UNLAID)).toBe(-1);
  });

  it("timeToX pins to the left edge when the window is degenerate", () => {
    expect(timeToX(0, { ...SCALE, window: 0 })).toBe(12);
  });
});
