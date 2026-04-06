import { niceTimeInterval } from "./intervals";

describe("niceTimeInterval", () => {
  const cases: [number, number][] = [
    [10, 2],
    [20, 5],
    [45, 10],
    [90, 15],
    [200, 30],
    [500, 60],
    [1200, 300],
    [3000, 600],
    [10000, 1800],
    [40000, 3600],
    [80000, 7200],
    [500000, 86400],
    [700000, 604800],
  ];

  it.each(cases)("window %i -> %i", (windowSecs, expected) => {
    expect(niceTimeInterval(windowSecs)).toBe(expected);
  });

  it("returns max interval for very large windows", () => {
    expect(niceTimeInterval(1e9)).toBe(604800);
  });
});
