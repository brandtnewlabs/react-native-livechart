import {
  clampWindow,
  focalTime,
  zoomViewEnd,
  zoomWindowBounds,
} from "../../src/hooks/usePinchZoom";

describe("clampWindow", () => {
  it("passes a value already in range through", () => {
    expect(clampWindow(50, 10, 100)).toBe(50);
  });

  it("clamps below the minimum (max zoom-in)", () => {
    expect(clampWindow(5, 10, 100)).toBe(10);
  });

  it("clamps above the maximum (max zoom-out)", () => {
    expect(clampWindow(200, 10, 100)).toBe(100);
  });
});

describe("zoomWindowBounds", () => {
  it("defaults max to the data span and min to an 8× zoom-in", () => {
    expect(zoomWindowBounds(80, 800, undefined, undefined)).toEqual([10, 800]);
  });

  it("never lets max fall below the configured window", () => {
    // span (50) < configWindow (80) ⇒ you can always zoom back out to 80.
    expect(zoomWindowBounds(80, 50, undefined, undefined)).toEqual([10, 80]);
  });

  it("honours explicit min/max overrides", () => {
    expect(zoomWindowBounds(80, 800, 20, 400)).toEqual([20, 400]);
  });

  it("guards against an inverted range (min clamped to max)", () => {
    expect(zoomWindowBounds(80, 800, 1000, 500)).toEqual([500, 500]);
  });
});

describe("focalTime", () => {
  // window [1000, 1100] over a 200px plot starting at x=0.
  it("maps the left edge to winStart", () => {
    expect(focalTime(0, 0, 200, 1000, 100)).toBe(1000);
  });

  it("maps the right edge to winStart + window", () => {
    expect(focalTime(200, 0, 200, 1000, 100)).toBe(1100);
  });

  it("maps a mid-plot x to the proportional time", () => {
    expect(focalTime(50, 0, 200, 1000, 100)).toBe(1025);
  });
});

describe("zoomViewEnd", () => {
  it("keeps the focal time under the focal x after a zoom-in", () => {
    // focalT=1025 under x=50; halving the window to 50 ⇒ right edge 1062.5.
    expect(zoomViewEnd(1025, 50, 0, 200, 50)).toBe(1062.5);
  });

  // Round-trip invariant: after zooming to any window, the focal time still
  // projects back to the original focal x.
  it.each([10, 25, 50, 100, 250])(
    "is the inverse of focalTime for newWindow=%p",
    (newWindow) => {
      const chartLeft = 0;
      const chartW = 200;
      const focalX = 73;
      const focalT = focalTime(focalX, chartLeft, chartW, 1000, 100);
      const newEnd = zoomViewEnd(focalT, focalX, chartLeft, chartW, newWindow);
      const newWinStart = newEnd - newWindow;
      const projectedX =
        chartLeft + ((focalT - newWinStart) / newWindow) * chartW;
      expect(projectedX).toBeCloseTo(focalX, 9);
    },
  );

  it("anchors at the right edge when the focal is at the right edge", () => {
    // focal at right edge ⇒ right edge stays put regardless of window.
    const focalT = focalTime(200, 0, 200, 1000, 100); // 1100
    expect(zoomViewEnd(focalT, 200, 0, 200, 40)).toBe(1100);
  });
});
