import {
  axisBandTop,
  flingVelocity,
  nextViewEnd,
  panLowerBound,
  panUpperBound,
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

  it("lets the left edge pass minTime by the overscroll fraction", () => {
    // minTime + window*(1 - 0.5) = 900 + 15 ⇒ blank history space on the left.
    expect(panLowerBound(900, 30, 1000, 0.5)).toBe(915);
  });

  it("still clamps to the live edge with overscroll when history is short", () => {
    // 990 + 30*(1 - 0.5) = 1005 exceeds the live edge ⇒ clamp to 1000.
    expect(panLowerBound(990, 30, 1000, 0.5)).toBe(1000);
  });
});

describe("panUpperBound", () => {
  it("is the live edge when overscroll is 0", () => {
    expect(panUpperBound(30, 1000, 0)).toBe(1000);
  });

  it("extends past the live edge by the overscroll fraction of the window", () => {
    expect(panUpperBound(30, 1000, 0.5)).toBe(1015);
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

  it("keeps a forward overdrag from the live edge in follow mode", () => {
    // onChange resolves a null viewEnd to the live edge (1000); dragging toward
    // the future must remain null instead of entering a transient scroll state.
    expect(nextViewEnd(1000, -20, 200, 30, 1000, 930)).toBeNull();
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

describe("nextViewEnd with overscroll", () => {
  it("does NOT null (resume follow) when the drag crosses the live edge", () => {
    // 997 + 3 = 1000 = liveEdge. Mid-drag, onChange re-derives `cur` from
    // `viewEnd ?? liveEdge` each frame — a null here would re-anchor every
    // per-frame delta at the live edge and the drag couldn't escape it in
    // either direction. Re-attach happens only in the release decay callback.
    expect(nextViewEnd(997, -20, 200, 30, 1000, 930, 0.5)).toBe(1000);
  });

  it("travels into blank future space past the live edge", () => {
    // 1000 + 3 = 1003, within the upper bound 1000 + 30*0.5 = 1015.
    expect(nextViewEnd(1000, -20, 200, 30, 1000, 930, 0.5)).toBe(1003);
  });

  it("clamps a forward overshoot to the overscroll upper bound", () => {
    // 1000 + 30 = 1030 > 1015 ⇒ 1015 (still a number — never null mid-drag).
    expect(nextViewEnd(1000, -200, 200, 30, 1000, 930, 0.5)).toBe(1015);
  });

  it("clamps to the caller's (overscroll-widened) lower bound", () => {
    // 920 - 30 = 890, below lo 915 ⇒ 915.
    expect(nextViewEnd(920, 200, 200, 30, 1000, 915, 0.5)).toBe(915);
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

describe("axisBandTop", () => {
  it("widens a thin axis padding to the minimum touch target", () => {
    // padBottom 28 < 44 ⇒ band height clamps to 44 ⇒ top at 300 - 44.
    expect(axisBandTop(300, 28)).toBe(256);
  });

  it("uses the axis padding when it already exceeds the minimum", () => {
    expect(axisBandTop(300, 60)).toBe(240);
  });
});
