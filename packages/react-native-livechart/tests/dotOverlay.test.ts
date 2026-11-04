import { pulseClockTime } from "../src/components/DotOverlay";

describe("pulseClockTime", () => {
  it("advances on every display frame during a slow visible pulse", () => {
    let previous = 0;
    for (let frame = 1; frame <= 60; frame++) {
      const timestamp = frame * 1000 / 60;
      const clock = pulseClockTime(timestamp, 3000, 1800, 21);
      expect(clock).toBeGreaterThan(previous);
      expect(clock).toBeCloseTo(timestamp);
      previous = clock;
    }
  });

  it("parks at the end of the visible pulse during the idle gap", () => {
    expect(pulseClockTime(600, 1000, 500, 19)).toBe(500);
    expect(pulseClockTime(900, 1000, 500, 19)).toBe(500);
    expect(pulseClockTime(1000, 1000, 500, 19)).toBe(1000);
  });

  it("parks at the cycle start when the pulse cannot travel", () => {
    expect(pulseClockTime(250, 1000, 500, 9)).toBe(0);
    expect(pulseClockTime(250, 1000, 0, 19)).toBe(0);
    expect(pulseClockTime(250, 1000, NaN, 19)).toBe(0);
  });
});
