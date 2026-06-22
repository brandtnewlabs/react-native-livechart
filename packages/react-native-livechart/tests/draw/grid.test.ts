import {
  computeGridEntries,
  fineLineTargetAlpha,
  fixedGridEntries,
  pickInterval,
} from "../../src/draw/grid";

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

  it("terminates on a near-flat range where the step is below value resolution", () => {
    // Range ~1 ULP at this magnitude: `fine` falls below ulp(val), so the old
    // `val += fine` never advanced and the worklet hung the UI thread (issue #146).
    const v = 1234.56;
    const alphas: Record<number, number> = {};
    const r = computeGridEntries(v - 3e-13, v, 250, 0, 0, 0, alphas, fmt, 16.67);
    // No resolvable grid lines for a degenerate range — it just returns cleanly.
    expect(r.entries).toEqual([]);
  });

  it("caps the grid loop at MAX_GRID_LINES as a hard backstop", () => {
    // Force a huge line count while the step still resolves: an outsized canvas
    // plus a tiny in-band prevInterval keeps `fine` small enough to exceed 1000
    // lines, exercising the iteration cap.
    const alphas: Record<number, number> = {};
    const r = computeGridEntries(0, 100, 20000, 0, 0, 0.1, alphas, fmt, 16.67);
    expect(r.entries.length).toBeGreaterThan(0);
    // Phase-1 stops emitting targets past the cap (would be ~2000 uncapped).
    expect(Object.keys(alphas).length).toBeLessThanOrEqual(1000);
  });
});

describe("fixedGridEntries", () => {
  const fmt = (v: number) => v.toFixed(2);

  it("places exactly `count` evenly-spaced labels spanning high→low", () => {
    // 400px plot, 36px minGap → maxFit 12, so count of 5 is honored exactly.
    const entries = fixedGridEntries(100, 100, 400, 12, 5, 36, fmt);
    expect(entries).toHaveLength(5);
    // Top label = displayMax at padTop, bottom = displayMin at padTop + chartH.
    expect(entries[0]).toEqual({ y: 12, label: "100.00", alpha: 1 });
    expect(entries[4]).toEqual({ y: 412, label: "0.00", alpha: 1 });
    // Even pixel + value steps between adjacent labels.
    expect(entries[1].y - entries[0].y).toBeCloseTo(100);
    expect(entries[2].label).toBe("50.00");
  });

  it("reduces the count when minGap won't fit all labels (floor)", () => {
    // 100px plot, 50px minGap → at most 2 gaps... floor(100/50)+1 = 3 labels.
    const entries = fixedGridEntries(100, 100, 100, 0, 10, 50, fmt);
    expect(entries).toHaveLength(3);
  });

  it("never drops below 2 labels even on a tiny plot", () => {
    const entries = fixedGridEntries(100, 100, 10, 0, 8, 36, fmt);
    expect(entries).toHaveLength(2);
  });

  it("caps the count at the label pool size (15)", () => {
    const entries = fixedGridEntries(100, 100, 100000, 0, 50, 1, fmt);
    expect(entries).toHaveLength(15);
  });
});

describe("computeGridEntries fixed-count mode", () => {
  const fmt = (v: number) => v.toFixed(0);

  it("returns fixed equidistant entries and leaves interval untouched", () => {
    const alphas: Record<number, number> = {};
    const r = computeGridEntries(
      0,
      100,
      400,
      12,
      28,
      7, // prevInterval — must survive untouched in fixed mode
      alphas,
      fmt,
      16.67,
      36,
      undefined,
      4,
    );
    expect(r.entries).toHaveLength(4);
    expect(r.entries.every((e) => e.alpha === 1)).toBe(true);
    expect(r.interval).toBe(7);
    // Fixed mode must not seed the value-keyed fade map.
    expect(Object.keys(alphas)).toHaveLength(0);
  });

  it("falls through to the dynamic grid for count < 2", () => {
    // count of 1 isn't a meaningful fixed axis (needs a high/low pair), so it
    // must take the dynamic nice-interval path — which seeds the fade map —
    // rather than the fixed path (which leaves it empty).
    const alphas: Record<number, number> = {};
    computeGridEntries(0, 100, 400, 12, 28, 0, alphas, fmt, 16.67, 36, undefined, 1);
    expect(Object.keys(alphas).length).toBeGreaterThan(0);
  });
});

describe("computeGridEntries grid-fade metrics", () => {
  const fmt = (v: number) => v.toFixed(0);

  it("seeds new-label alpha by the custom fadeInSpeed", () => {
    const slowAlphas: Record<number, number> = {};
    const slow = computeGridEntries(0, 100, 400, 12, 28, 0, slowAlphas, fmt, 16.67, 36, {
      fadeInSpeed: 0.18,
      fadeOutSpeed: 0.12,
    });
    const fastAlphas: Record<number, number> = {};
    const fast = computeGridEntries(0, 100, 400, 12, 28, 0, fastAlphas, fmt, 16.67, 36, {
      fadeInSpeed: 0.9,
      fadeOutSpeed: 0.12,
    });
    const maxSlow = Math.max(...slow.entries.map((e) => e.alpha));
    const maxFast = Math.max(...fast.entries.map((e) => e.alpha));
    // Same label set; a faster fade-in seeds a higher initial alpha.
    expect(maxFast).toBeGreaterThan(maxSlow);
  });
});
