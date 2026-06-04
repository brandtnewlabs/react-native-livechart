import {
  blendPtsY,
  buildSquigglyPts,
  smoothstep,
  squigglifyPts,
  squigglyYAt,
} from "../../src/math/squiggly";

const padding = { top: 12, right: 80, bottom: 28, left: 12 };

// ─── squigglyYAt ─────────────────────────────────────────────────────────────

describe("squigglyYAt", () => {
  it("returns centerY when amplitude terms cancel (degenerate)", () => {
    // amplitude is always 8*(0.6+0.4*sin(...)) ∈ [3.2, 12.8]; result near centerY
    const y = squigglyYAt(0, 100, 0);
    // at x=0, t=0: sin(0)=0, sin(0)=0 → y = 100
    expect(y).toBeCloseTo(100);
  });

  it("produces different values at different x", () => {
    const y1 = squigglyYAt(10, 100, 1);
    const y2 = squigglyYAt(50, 100, 1);
    expect(y1).not.toBeCloseTo(y2);
  });

  it("produces different values at different t", () => {
    const y1 = squigglyYAt(30, 100, 0);
    const y2 = squigglyYAt(30, 100, Math.PI);
    expect(y1).not.toBeCloseTo(y2);
  });

  it("amplitude stays within expected range around centerY", () => {
    for (let t = 0; t < 10; t += 0.5) {
      for (let x = 0; x < 400; x += 20) {
        const y = squigglyYAt(x, 100, t);
        // max amplitude = 14*1 = 14, composite ≤ 1.45 → max deviation ≈ 20.3
        expect(Math.abs(y - 100)).toBeLessThanOrEqual(25);
      }
    }
  });
});

// ─── buildSquigglyPts ────────────────────────────────────────────────────────

describe("buildSquigglyPts", () => {
  it("returns empty for zero canvas", () => {
    expect(buildSquigglyPts(0, 0, padding, 0)).toEqual([]);
  });

  it("returns paired [x,y] flat array", () => {
    const pts = buildSquigglyPts(400, 300, padding, 1);
    expect(pts.length % 2).toBe(0);
    expect(pts.length).toBeGreaterThan(0);
  });

  it("X values span from padding.left to right chart edge", () => {
    const pts = buildSquigglyPts(400, 300, padding, 0);
    const xs = pts.filter((_, i) => i % 2 === 0);
    expect(xs[0]).toBeCloseTo(padding.left);
    expect(xs[xs.length - 1]).toBeCloseTo(400 - padding.right);
  });

  it("produces different shapes at different timestamps", () => {
    const pts1 = buildSquigglyPts(400, 300, padding, 0);
    const pts2 = buildSquigglyPts(400, 300, padding, 2);
    // Y values should differ
    const diff = pts1.some(
      (v, i) => i % 2 === 1 && Math.abs(v - pts2[i]) > 0.01,
    );
    expect(diff).toBe(true);
  });
});

// ─── squigglifyPts ───────────────────────────────────────────────────────────

describe("squigglifyPts", () => {
  it("preserves X, replaces Y", () => {
    const flatPts = [10, 50, 50, 60, 90, 55];
    const out = squigglifyPts(flatPts, 0, 100);
    // X values unchanged
    expect(out[0]).toBe(10);
    expect(out[2]).toBe(50);
    expect(out[4]).toBe(90);
    // Y values are squiggly — centered near 100 but not the original input values
    expect(out[1]).not.toBeCloseTo(50);
    expect(out[3]).not.toBeCloseTo(60);
    // All Y values should be within the squiggly amplitude range of centerY (100)
    expect(Math.abs(out[1] - 100)).toBeLessThanOrEqual(25);
    expect(Math.abs(out[3] - 100)).toBeLessThanOrEqual(25);
  });

  it("returns same length as input", () => {
    const pts = [10, 20, 30, 40, 50, 60, 70, 80];
    expect(squigglifyPts(pts, 1, 150).length).toBe(8);
  });
});

// ─── smoothstep ──────────────────────────────────────────────────────────────

describe("smoothstep", () => {
  it("returns 0 at t=0", () => expect(smoothstep(0)).toBe(0));
  it("returns 1 at t=1", () => expect(smoothstep(1)).toBe(1));
  it("returns 0.5 at t=0.5", () => expect(smoothstep(0.5)).toBe(0.5));
  it("clamps below 0", () => expect(smoothstep(-1)).toBe(0));
  it("clamps above 1", () => expect(smoothstep(2)).toBe(1));
  it("is monotonically increasing", () => {
    let prev = smoothstep(0);
    for (let t = 0.1; t <= 1; t += 0.1) {
      const cur = smoothstep(t);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

// ─── blendPtsY ───────────────────────────────────────────────────────────────

describe("blendPtsY", () => {
  const canvasWidth = 400;
  // chartCentreX = (12 + 400 - 80) / 2 = 166

  it("returns 'to' pts when morphT=1 (full reveal)", () => {
    const from = [12, 100, 166, 100, 320, 100];
    const to = [12, 50, 166, 60, 320, 55];
    const result = blendPtsY(from, to, 1, padding, canvasWidth);
    // All weights should be smoothstep((1 - dist*0.5)/0.5) ≥ some value
    // Centre point (dist=0): weight = smoothstep(2) = 1 → blendedY = toY
    expect(result[3]).toBeCloseTo(60); // centre Y
  });

  it("centre point reveals before edge points at morphT=0.5", () => {
    const centreX = (padding.left + canvasWidth - padding.right) / 2;
    const from = [centreX, 100, 320, 100];
    const to = [centreX, 0, 320, 0];
    const result = blendPtsY(from, to, 0.5, padding, canvasWidth);
    // Centre (dist=0): weight=smoothstep(1)=1 → blendedY=0
    expect(result[1]).toBeCloseTo(0);
    // Edge (dist=1): weight=smoothstep(0)=0 → blendedY=100
    expect(result[3]).toBeCloseTo(100);
  });

  it("returns 'to' X values regardless of morphT", () => {
    const from = [10, 100, 50, 100];
    const to = [10, 50, 50, 50];
    const result = blendPtsY(from, to, 0, padding, canvasWidth);
    expect(result[0]).toBe(10);
    expect(result[2]).toBe(50);
  });

  it("returns 'to' when from is empty", () => {
    const to = [10, 20, 30, 40];
    expect(blendPtsY([], to, 0.5, padding, canvasWidth)).toEqual(to);
  });

  it("handles zero chart width without division by zero", () => {
    // canvasWidth = padding.left + padding.right → halfChartW = 0
    const zeroW = padding.left + padding.right;
    const from = [12, 100, 80, 100];
    const to = [12, 50, 80, 60];
    const result = blendPtsY(from, to, 0.5, padding, zeroW);
    expect(result).toHaveLength(from.length);
  });
});
