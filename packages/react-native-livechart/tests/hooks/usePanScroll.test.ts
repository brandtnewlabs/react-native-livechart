import {
  flingVelocity,
  nextViewEnd,
  panLowerBound,
} from "../../src/hooks/usePanScroll";

describe("panLowerBound", () => {
  it("keeps the window's left edge from passing minTime", () => {
    // left edge = rightEdge - window ⇒ smallest right edge = minTime + window.
    expect(panLowerBound(900, 30, 1000)).toBe(930);
  });

  it("clamps to the live edge when history is shorter than the window", () => {
    // minTime + window (1020) would exceed the live edge ⇒ clamp to 1000.
    expect(panLowerBound(990, 30, 1000)).toBe(1000);
  });
});

describe("nextViewEnd", () => {
  it("moves the right edge back when dragging right (changeX > 0)", () => {
    // 1000 - (20/200)*30 = 997
    expect(nextViewEnd(1000, 20, 200, 30, 1000, 930)).toBe(997);
  });

  it("returns null once the drag reaches the live edge", () => {
    // 997 - (-20/200)*30 = 1000 ⇒ caught up ⇒ follow.
    expect(nextViewEnd(997, -20, 200, 30, 1000, 930)).toBeNull();
  });

  it("clamps to the lower bound (oldest history)", () => {
    // 940 - (200/200)*30 = 910, below lo 930 ⇒ 930.
    expect(nextViewEnd(940, 200, 200, 30, 1000, 930)).toBe(930);
  });

  it("clamps a forward overshoot to the live edge and follows", () => {
    // 997 + 30 = 1027 > liveEdge ⇒ clamp 1000 ⇒ null.
    expect(nextViewEnd(997, -200, 200, 30, 1000, 930)).toBeNull();
  });
});

describe("flingVelocity", () => {
  it("maps a rightward fling to a negative (back-in-time) edge velocity", () => {
    expect(flingVelocity(200, 200, 30)).toBe(-30);
  });

  it("maps a leftward fling toward the live edge (positive)", () => {
    expect(flingVelocity(-100, 200, 30)).toBe(15);
  });
});
