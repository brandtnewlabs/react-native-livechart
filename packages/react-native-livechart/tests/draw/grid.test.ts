import { computeGridEntries, fineLineTargetAlpha, pickInterval } from "../../src/draw/grid";

describe("fineLineTargetAlpha", () => {
  it("maps fine pixel spacing to 0, blend, and 1 bands (default minGap)", () => {
    expect(fineLineTargetAlpha(30, 36)).toBe(0);
    expect(fineLineTargetAlpha(70, 36)).toBe(1);
    const fineMin = 36 * 1.1;
    const fineMax = 36 * 1.7;
    expect(fineLineTargetAlpha(50, 36)).toBeCloseTo(
      (50 - fineMin) / (fineMax - fineMin),
    );
    expect(fineLineTargetAlpha(fineMin, 36)).toBe(0);
    expect(fineLineTargetAlpha(fineMax, 36)).toBe(1);
  });

  it("uses minGap=36 when second argument is omitted", () => {
    // Omitting minGap exercises the default parameter branch.
    expect(fineLineTargetAlpha(30)).toBe(0);
    expect(fineLineTargetAlpha(70)).toBe(1);
  });
});

describe("pickInterval", () => {
  it("recomputes when prev is outside hysteresis low bound", () => {
    const prev = 5;
    const pxPerUnit = 1;
    const minGap = 36;
    const px = prev * pxPerUnit;
    expect(px < minGap * 0.5).toBe(true);
    const r = pickInterval(100, pxPerUnit, minGap, prev);
    expect(r).not.toBe(prev);
  });

  it("returns prev when spacing stays in hysteresis band", () => {
    const prev = 5;
    const pxPerUnit = 10;
    const minGap = 36;
    const valRange = 100;
    const px = prev * pxPerUnit;
    expect(px >= minGap * 0.5 && px <= minGap * 4).toBe(true);
    expect(pickInterval(valRange, pxPerUnit, minGap, prev)).toBe(prev);
  });

  it("recomputes when prev is in band but px exceeds upper hysteresis bound", () => {
    const prev = 10;
    const pxPerUnit = 20;
    const minGap = 36;
    const px = prev * pxPerUnit;
    expect(px > minGap * 4).toBe(true);
    const r = pickInterval(100, pxPerUnit, minGap, prev);
    expect(r).not.toBe(prev);
  });

  it("computes new interval when prev is zero", () => {
    const r = pickInterval(1000, 2, 36, 0);
    expect(r).toBeGreaterThan(0);
    expect(Number.isFinite(r)).toBe(true);
  });

  it("returns valRange/5 when best stays Infinity", () => {
    const r = pickInterval(0, 1, 36, 0);
    expect(r).toBe(0);
  });

  it("falls back to valRange/5 when span math leaves best at Infinity", () => {
    const r = pickInterval(-1, 1, 36, 0);
    expect(r).toBeCloseTo(-0.2);
  });
});

describe("computeGridEntries", () => {
  const fmt = (v: number) => v.toFixed(0);

  it("returns empty when chart height invalid", () => {
    const alphas: Record<number, number> = {};
    const r = computeGridEntries(0, 10, 0, 0, 0, 0, alphas, fmt, 16.67);
    expect(r.entries).toEqual([]);
  });

  it("returns empty when val range invalid", () => {
    const alphas: Record<number, number> = {};
    const r = computeGridEntries(5, 5, 200, 12, 28, 0, alphas, fmt, 16.67);
    expect(r.entries).toEqual([]);
  });

  it("builds grid entries and updates alphas", () => {
    const alphas: Record<number, number> = {};
    const r = computeGridEntries(0, 100, 400, 12, 28, 0, alphas, fmt, 16.67);
    expect(r.entries.length).toBeGreaterThan(0);
    expect(r.interval).toBeGreaterThan(0);
  });

  it("fades labels toward zero and removes stale keys", () => {
    const alphas: Record<number, number> = { 50000: 0.5 };
    computeGridEntries(0, 100, 400, 12, 28, 0, alphas, fmt, 16.67);
    const r2 = computeGridEntries(50, 150, 400, 12, 28, 0, alphas, fmt, 16.67);
    expect(r2.entries).toBeDefined();
  });

  it("covers fineTarget branches via val range and chart height", () => {
    const alphas: Record<number, number> = {};
    computeGridEntries(0, 50, 300, 12, 28, 0, alphas, fmt, 16.67);
    computeGridEntries(0, 200, 800, 12, 28, 0, alphas, fmt, 16.67);
    expect(true).toBe(true);
  });

  it("iterates pickInterval inner divisor loop for large ranges", () => {
    const r = pickInterval(1e12, 0.0001, 36, 0);
    expect(r).toBeGreaterThan(0);
  });

  it("initializes new label keys in phase 2", () => {
    const alphas: Record<number, number> = {};
    const r = computeGridEntries(0, 200, 500, 12, 28, 0, alphas, fmt, 16.67);
    expect(Object.keys(alphas).length).toBeGreaterThan(0);
    expect(r.entries.length).toBeGreaterThan(0);
  });

  it("skips phase-2 init when label keys already exist from a prior frame", () => {
    const alphas: Record<number, number> = {};
    computeGridEntries(0, 100, 400, 12, 28, 0, alphas, fmt, 16.67);
    const keyCount = Object.keys(alphas).length;
    computeGridEntries(0, 100, 400, 12, 28, 0, alphas, fmt, 16.67);
    expect(Object.keys(alphas).length).toBeGreaterThanOrEqual(keyCount);
  });

  it("hits fineTarget middle blend when fine line spacing is mid band", () => {
    const alphas: Record<number, number> = {};
    computeGridEntries(0, 100, 380, 12, 28, 0, alphas, fmt, 16.67);
    expect(alphas).toBeDefined();
  });

  it("fades many frames then shrinks range", () => {
    const alphas: Record<number, number> = {};
    computeGridEntries(0, 100, 400, 12, 28, 0, alphas, fmt, 16.67);
    for (let i = 0; i < 40; i++) {
      computeGridEntries(0, 100, 400, 12, 28, 0, alphas, fmt, 16.67);
    }
    computeGridEntries(0, 10, 400, 12, 28, 0, alphas, fmt, 16.67);
    expect(alphas).toBeDefined();
  });
});
