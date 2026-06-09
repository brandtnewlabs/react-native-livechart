import type { ResolvedSegment } from "../../src/core/resolveSegment";
import { segmentBandX, segmentLineGradient } from "../../src/math/segments";

// Window [100, 130] (winStart=100, win=30) projected into plot [x1=10, x2=210].
const WIN_START = 100;
const WIN = 30;
const X1 = 10;
const X2 = 210;

function mkSeg(partial: Partial<ResolvedSegment> = {}): ResolvedSegment {
  return {
    color: "#fff",
    recolorLine: true,
    mutedColor: "#abcdef",
    active: false,
    divider: false,
    dividerColor: "#fff",
    labelPosition: "left",
    ...partial,
  };
}

describe("segmentBandX", () => {
  it("returns invisible for a non-positive window", () => {
    expect(segmentBandX(110, 120, WIN_START, 0, X1, X2).visible).toBe(false);
  });

  it("returns invisible for a degenerate plot (x2 <= x1)", () => {
    expect(segmentBandX(110, 120, WIN_START, WIN, 10, 10).visible).toBe(false);
  });

  it("projects an in-window range", () => {
    const b = segmentBandX(110, 120, WIN_START, WIN, X1, X2);
    expect(b.visible).toBe(true);
    expect(b.bx1).toBeCloseTo(10 + (10 / 30) * 200); // ≈ 76.67
    expect(b.bx2).toBeCloseTo(10 + (20 / 30) * 200); // ≈ 143.33
    expect(b.bx2).toBeGreaterThan(b.bx1);
  });

  it("extends to the left edge when `from` is omitted", () => {
    const b = segmentBandX(undefined, 120, WIN_START, WIN, X1, X2);
    expect(b.visible).toBe(true);
    expect(b.bx1).toBe(X1);
  });

  it("extends to the live edge when `to` is omitted", () => {
    const b = segmentBandX(110, undefined, WIN_START, WIN, X1, X2);
    expect(b.visible).toBe(true);
    expect(b.bx2).toBe(X2);
  });

  it("culls a range entirely left of the window", () => {
    expect(segmentBandX(50, 70, WIN_START, WIN, X1, X2).visible).toBe(false);
  });

  it("culls a range entirely right of the window", () => {
    expect(segmentBandX(140, 160, WIN_START, WIN, X1, X2).visible).toBe(false);
  });

  it("clamps a range overflowing the left edge", () => {
    const b = segmentBandX(80, 120, WIN_START, WIN, X1, X2);
    expect(b.visible).toBe(true);
    expect(b.bx1).toBe(X1);
  });

  it("clamps a range overflowing the right edge", () => {
    const b = segmentBandX(110, 200, WIN_START, WIN, X1, X2);
    expect(b.visible).toBe(true);
    expect(b.bx2).toBe(X2);
  });

  it("normalizes a reversed range (from > to)", () => {
    const fwd = segmentBandX(110, 120, WIN_START, WIN, X1, X2);
    const rev = segmentBandX(120, 110, WIN_START, WIN, X1, X2);
    expect(rev.visible).toBe(true);
    expect(rev.bx1).toBeCloseTo(fwd.bx1);
    expect(rev.bx2).toBeCloseTo(fwd.bx2);
  });
});

describe("segmentLineGradient", () => {
  const CW = 220;
  const PL = 10;
  const PR = 210;
  const BASE = "#0000ff"; // base line color (the focused / at-rest color)

  // Two adjacent sessions: A = px[43.3, 110], B = px[110, 176.7].
  const A = () => mkSeg({ from: 105, to: 115, mutedColor: "#aaaaaa" });
  const B = () => mkSeg({ from: 115, to: 125, mutedColor: "#bbbbbb" });
  const SCRUB_IN_A = 70;
  const SCRUB_IN_B = 150;
  const SCRUB_IN_GAP = 20; // left of A (a non-segment gap)

  function nonDecreasing(positions: number[]): boolean {
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] < positions[i - 1]) return false;
    }
    return true;
  }

  // ── focus-mode gating ───────────────────────────────────────────────────────

  it("returns null at rest — not scrubbing and nothing active (uniform line)", () => {
    expect(
      segmentLineGradient([A(), B()], WIN_START, WIN, CW, PL, PR, BASE, false, -1),
    ).toBeNull();
  });

  it("returns null when the scrubbed segment is the only one (nothing to dim)", () => {
    expect(
      segmentLineGradient(
        [A()],
        WIN_START,
        WIN,
        CW,
        PL,
        PR,
        BASE,
        true,
        SCRUB_IN_A,
      ),
    ).toBeNull();
  });

  // ── degenerate guards ─────────────────────────────────────────────────────────

  it("returns null for a non-positive window", () => {
    expect(
      segmentLineGradient([A(), B()], WIN_START, 0, CW, PL, PR, BASE, true, SCRUB_IN_A),
    ).toBeNull();
  });

  it("returns null for a non-positive canvas width", () => {
    expect(
      segmentLineGradient([A(), B()], WIN_START, WIN, 0, PL, PR, BASE, true, SCRUB_IN_A),
    ).toBeNull();
  });

  it("returns null for a degenerate plot (plotRight <= plotLeft)", () => {
    expect(
      segmentLineGradient([A(), B()], WIN_START, WIN, CW, 200, 100, BASE, true, SCRUB_IN_A),
    ).toBeNull();
  });

  it("ignores a non-recolor segment", () => {
    expect(
      segmentLineGradient(
        [mkSeg({ from: 105, to: 115, recolorLine: false }), B()],
        WIN_START,
        WIN,
        CW,
        PL,
        PR,
        BASE,
        true,
        SCRUB_IN_B, // focus B → the only other (A) is non-recolor → nothing to dim
      ),
    ).toBeNull();
  });

  // ── scrub focus ───────────────────────────────────────────────────────────────

  it("de-emphasizes the other segment while scrubbing one", () => {
    const g = segmentLineGradient(
      [A(), B()],
      WIN_START,
      WIN,
      CW,
      PL,
      PR,
      BASE,
      true,
      SCRUB_IN_A,
    )!;
    expect(g.colors).toContain(BASE);
    expect(g.colors).toContain("#bbbbbb"); // B dimmed
    expect(g.colors).not.toContain("#aaaaaa"); // A (focused) stays base
    expect(nonDecreasing(g.positions)).toBe(true);
    g.positions.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });

  it("dims the first segment when the other is scrubbed", () => {
    const g = segmentLineGradient(
      [A(), B()],
      WIN_START,
      WIN,
      CW,
      PL,
      PR,
      BASE,
      true,
      SCRUB_IN_B,
    )!;
    expect(g.colors).toContain("#aaaaaa"); // A dimmed
    expect(g.colors).not.toContain("#bbbbbb"); // B (focused) stays base
  });

  it("dims every segment when scrubbing a gap between them", () => {
    const g = segmentLineGradient(
      [A(), B()],
      WIN_START,
      WIN,
      CW,
      PL,
      PR,
      BASE,
      true,
      SCRUB_IN_GAP,
    )!;
    expect(g.colors).toContain("#aaaaaa");
    expect(g.colors).toContain("#bbbbbb");
  });

  // ── active focus (no scrub) ─────────────────────────────────────────────────

  it("an active segment stays full and de-emphasizes the others", () => {
    const g = segmentLineGradient(
      [mkSeg({ from: 105, to: 115, mutedColor: "#aaaaaa", active: true }), B()],
      WIN_START,
      WIN,
      CW,
      PL,
      PR,
      BASE,
      false,
      -1,
    )!;
    expect(g.colors).toContain("#bbbbbb"); // B dimmed
    expect(g.colors).not.toContain("#aaaaaa"); // active A stays base
  });

  it("handles open-ended dim segments (omitted from / to)", () => {
    const g = segmentLineGradient(
      [
        mkSeg({ to: 110, mutedColor: "#aaaaaa" }), // pre-market: from omitted → left edge
        mkSeg({ from: 110, to: 120, mutedColor: "#cccccc", active: true }), // focused
        mkSeg({ from: 120, mutedColor: "#bbbbbb" }), // after-hours: to omitted → live edge
      ],
      WIN_START,
      WIN,
      CW,
      PL,
      PR,
      BASE,
      false,
      -1,
    )!;
    expect(g.colors).toContain("#aaaaaa"); // pre-market dimmed
    expect(g.colors).toContain("#bbbbbb"); // after-hours dimmed
    expect(g.colors).not.toContain("#cccccc"); // focused (active) session stays base
    expect(nonDecreasing(g.positions)).toBe(true);
  });

  // ── dim color rendering ───────────────────────────────────────────────────────

  it("preserves an alpha dim color so the line is faded, not overlaid", () => {
    const g = segmentLineGradient(
      [A(), mkSeg({ from: 115, to: 125, mutedColor: "rgba(154,160,166,0.45)" })],
      WIN_START,
      WIN,
      CW,
      PL,
      PR,
      BASE,
      true,
      SCRUB_IN_A, // focus A → B dimmed with its alpha color
    )!;
    expect(g.colors).toContain("rgba(154,160,166,0.45)");
  });

  it("spreads a gradient dim segment's colors across its sub-range", () => {
    const g = segmentLineGradient(
      [A(), mkSeg({ from: 115, to: 125, mutedColors: ["#b00000", "#0000b0"] })],
      WIN_START,
      WIN,
      CW,
      PL,
      PR,
      BASE,
      true,
      SCRUB_IN_A,
    )!;
    expect(g.colors).toContain("#b00000");
    expect(g.colors).toContain("#0000b0");
    expect(nonDecreasing(g.positions)).toBe(true);
  });

  it("prefers mutedColors over mutedColor for the dim color", () => {
    const g = segmentLineGradient(
      [
        A(),
        mkSeg({ from: 115, to: 125, mutedColor: "#bbbbbb", mutedColors: ["#111", "#222"] }),
      ],
      WIN_START,
      WIN,
      CW,
      PL,
      PR,
      BASE,
      true,
      SCRUB_IN_A,
    )!;
    expect(g.colors).toContain("#111");
    expect(g.colors).toContain("#222");
    expect(g.colors).not.toContain("#bbbbbb");
  });

  // ── geometry edge cases ───────────────────────────────────────────────────────

  it("culls an off-screen dim segment", () => {
    // Focus B (active); the other segment is off-screen → nothing to dim → null.
    expect(
      segmentLineGradient(
        [mkSeg({ from: 50, to: 70, mutedColor: "#aaaaaa" }), mkSeg({ from: 115, to: 125, active: true })],
        WIN_START,
        WIN,
        CW,
        PL,
        PR,
        BASE,
        false,
        -1,
      ),
    ).toBeNull();
  });

  it("skips a zero-width dim segment (from === to)", () => {
    expect(
      segmentLineGradient(
        [mkSeg({ from: 115, to: 115, mutedColor: "#aaaaaa" }), mkSeg({ from: 118, to: 125, active: true })],
        WIN_START,
        WIN,
        CW,
        PL,
        PR,
        BASE,
        false,
        -1,
      ),
    ).toBeNull();
  });

  it("clamps an edge-overflowing dim segment to [0,1]", () => {
    const g = segmentLineGradient(
      [
        mkSeg({ from: 80, to: 200, mutedColor: "#cccccc" }), // overflows both edges
        mkSeg({ from: 118, to: 125, active: true }), // focus
      ],
      WIN_START,
      WIN,
      CW,
      PL,
      PR,
      BASE,
      false,
      -1,
    )!;
    expect(nonDecreasing(g.positions)).toBe(true);
    g.positions.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });

  it("normalizes a reversed dim segment (from > to)", () => {
    const fwd = segmentLineGradient(
      [A(), mkSeg({ from: 115, to: 125, mutedColor: "#bbbbbb" })],
      WIN_START,
      WIN,
      CW,
      PL,
      PR,
      BASE,
      true,
      SCRUB_IN_A,
    )!;
    const rev = segmentLineGradient(
      [A(), mkSeg({ from: 125, to: 115, mutedColor: "#bbbbbb" })],
      WIN_START,
      WIN,
      CW,
      PL,
      PR,
      BASE,
      true,
      SCRUB_IN_A,
    )!;
    expect(rev.positions).toEqual(fwd.positions);
    expect(nonDecreasing(rev.positions)).toBe(true);
  });

  it("keeps positions non-decreasing for overlapping dim segments", () => {
    const g = segmentLineGradient(
      [
        mkSeg({ from: 105, to: 122, mutedColor: "#aaaaaa" }),
        mkSeg({ from: 110, to: 128, mutedColor: "#bbbbbb" }),
      ],
      WIN_START,
      WIN,
      CW,
      PL,
      PR,
      BASE,
      true,
      SCRUB_IN_GAP, // both dimmed
    )!;
    expect(g).not.toBeNull();
    expect(nonDecreasing(g.positions)).toBe(true);
  });
});
