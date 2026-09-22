import { quantizePulseClock } from "../src/components/DotOverlay";

describe("quantizePulseClock", () => {
  it("advances only when the radius crosses a half-pixel step", () => {
    const first = quantizePulseClock(100, 1000, 500, 19);
    const withinStep = quantizePulseClock(110, 1000, 500, 19);
    const nextStep = quantizePulseClock(130, 1000, 500, 19);

    expect(withinStep).toBe(first);
    expect(nextStep).toBeGreaterThan(first);
  });

  it("parks at the end of the visible pulse during the idle gap", () => {
    expect(quantizePulseClock(600, 1000, 500, 19)).toBe(500);
    expect(quantizePulseClock(900, 1000, 500, 19)).toBe(500);
    expect(quantizePulseClock(1000, 1000, 500, 19)).toBe(1000);
  });

  it("parks at the cycle start when the pulse cannot travel", () => {
    expect(quantizePulseClock(250, 1000, 500, 9)).toBe(0);
    expect(quantizePulseClock(250, 1000, 0, 19)).toBe(0);
    expect(quantizePulseClock(250, 1000, NaN, 19)).toBe(0);
  });
});
