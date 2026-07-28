import { detectMomentum } from "../../src/math/momentum";

describe("detectMomentum", () => {
  it("returns flat when fewer than 5 points", () => {
    expect(detectMomentum([{ time: 0, value: 1 }])).toBe("flat");
  });

  it("returns flat when range is zero", () => {
    const pts = Array.from({ length: 5 }, (_, i) => ({
      time: i,
      value: 5,
    }));
    expect(detectMomentum(pts)).toBe("flat");
  });

  it("returns up when tail rises enough", () => {
    const pts = [
      { time: 0, value: 100 },
      { time: 1, value: 100 },
      { time: 2, value: 100 },
      { time: 3, value: 100 },
      { time: 4, value: 120 },
    ];
    expect(detectMomentum(pts)).toBe("up");
  });

  it("returns down when tail falls enough", () => {
    const pts = [
      { time: 0, value: 120 },
      { time: 1, value: 120 },
      { time: 2, value: 120 },
      { time: 3, value: 120 },
      { time: 4, value: 100 },
    ];
    expect(detectMomentum(pts)).toBe("down");
  });

  it("returns flat when tail delta is small versus overall range", () => {
    const pts = [
      { time: 0, value: 50 },
      { time: 1, value: 100 },
      { time: 2, value: 100 },
      { time: 3, value: 100 },
      { time: 4, value: 100 },
      { time: 5, value: 100.01 },
    ];
    expect(detectMomentum(pts)).toBe("flat");
  });

  it("respects lookback window", () => {
    const pts = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      value: 100 + (i >= 25 ? i * 10 : 0),
    }));
    expect(detectMomentum(pts, 5)).toBe("up");
  });

  it("uses tail slice when lookback exceeds length", () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({
      time: i,
      value: 100 + i * 0.001,
    }));
    expect(detectMomentum(pts, 100)).toBe("up");
  });

  it("detects momentum at an inclusive historical cutoff", () => {
    const pts = [
      { time: 0, value: 100 },
      { time: 1, value: 100 },
      { time: 2, value: 100 },
      { time: 3, value: 100 },
      { time: 4, value: 120 },
      { time: 5, value: 120 },
      { time: 6, value: 120 },
      { time: 7, value: 120 },
      { time: 8, value: 120 },
      { time: 9, value: 80 },
    ];

    expect(detectMomentum(pts)).toBe("down");
    expect(detectMomentum(pts, 20, 0.12, 4)).toBe("up");
  });

  it("returns flat when fewer than five points precede the cutoff", () => {
    const pts = Array.from({ length: 8 }, (_, time) => ({
      time,
      value: time,
    }));

    expect(detectMomentum(pts, 20, 0.12, 3)).toBe("flat");
  });
});
