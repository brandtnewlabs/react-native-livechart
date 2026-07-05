import {
  sampleThresholdY,
  sampleThresholdYAt,
  thresholdLineY,
  thresholdSampleSpanX,
  thresholdSeriesVisible,
  thresholdSplitPositions,
  thresholdVisible,
} from "../../src/math/threshold";

// Common geometry: 300px canvas, 12px top inset, 28px bottom inset → 260px plot.
const H = 300;
const TOP = 12;
const BOT = 28;
const CHART_H = H - TOP - BOT; // 260

describe("thresholdLineY", () => {
  it("maps a mid-range value to the matching plot Y", () => {
    // value 50 of [0,100] → halfway down the plot.
    expect(thresholdLineY(50, 0, 100, H, TOP, BOT)).toBeCloseTo(
      TOP + 0.5 * CHART_H,
    );
  });

  it("maps the max value to the plot top, the min to the plot bottom", () => {
    expect(thresholdLineY(100, 0, 100, H, TOP, BOT)).toBeCloseTo(TOP);
    expect(thresholdLineY(0, 0, 100, H, TOP, BOT)).toBeCloseTo(H - BOT);
  });

  it("projects an out-of-range value to an off-plot (but finite) Y", () => {
    const y = thresholdLineY(150, 0, 100, H, TOP, BOT);
    expect(Number.isFinite(y)).toBe(true);
    expect(y).toBeLessThan(TOP);
  });

  it("returns NaN before layout (height 0)", () => {
    expect(thresholdLineY(50, 0, 100, 0, TOP, BOT)).toBeNaN();
  });

  it("returns NaN for a degenerate value range", () => {
    expect(thresholdLineY(50, 50, 50, H, TOP, BOT)).toBeNaN();
  });

  it("returns NaN when insets exceed the canvas height", () => {
    expect(thresholdLineY(50, 0, 100, 30, TOP, BOT)).toBeNaN();
  });
});

describe("thresholdVisible", () => {
  it("is true within the plot, false above / below it", () => {
    expect(thresholdVisible(TOP + 100, H, TOP, BOT)).toBe(true);
    expect(thresholdVisible(TOP - 1, H, TOP, BOT)).toBe(false);
    expect(thresholdVisible(H - BOT + 1, H, TOP, BOT)).toBe(false);
  });

  it("is inclusive of the plot edges", () => {
    expect(thresholdVisible(TOP, H, TOP, BOT)).toBe(true);
    expect(thresholdVisible(H - BOT, H, TOP, BOT)).toBe(true);
  });

  it("is false for NaN or an un-laid-out canvas", () => {
    expect(thresholdVisible(NaN, H, TOP, BOT)).toBe(false);
    expect(thresholdVisible(100, 0, TOP, BOT)).toBe(false);
  });
});

describe("thresholdSplitPositions", () => {
  it("places the hard stop at the threshold's canvas fraction", () => {
    expect(thresholdSplitPositions(150, H)).toEqual([0, 0.5, 0.5, 1]);
  });

  it("clamps to all-below when the threshold is above the canvas", () => {
    expect(thresholdSplitPositions(-20, H)).toEqual([0, 0, 0, 1]);
  });

  it("clamps to all-above when the threshold is below the canvas", () => {
    expect(thresholdSplitPositions(H + 20, H)).toEqual([0, 1, 1, 1]);
  });

  it("falls back to a valid ascending array for NaN / height 0", () => {
    expect(thresholdSplitPositions(NaN, H)).toEqual([0, 1, 1, 1]);
    expect(thresholdSplitPositions(150, 0)).toEqual([0, 1, 1, 1]);
  });
});

// Window/plot geometry for the series helpers: 400px wide canvas, 12px L/R
// insets → 376px plot; the 300px canvas / 12 top / 28 bottom → 260px plot height,
// value range [0,100]. now=1000, win=100 → winStart=900.
const W = 400;
const LEFT = 12;
const RIGHT = 12;
const NOW = 1000;
const WIN = 100;
// yOf(v) = TOP + (100 - v) * (260/100) — the value→pixel-Y mapping in the plot.
const yOf = (v: number) => TOP + (100 - v) * (CHART_H / 100);

describe("sampleThresholdY", () => {
  it("returns `count` samples, flat for a flat series", () => {
    const out = sampleThresholdY(
      [{ time: 900, value: 50 }, { time: 1000, value: 50 }],
      NOW, WIN, 0, 100, H, TOP, BOT, 5,
    );
    expect(out).toHaveLength(5);
    out.forEach((y) => expect(y).toBeCloseTo(yOf(50)));
  });

  it("tracks a rising series across the samples (monotonic Y up the screen)", () => {
    const out = sampleThresholdY(
      [{ time: 900, value: 20 }, { time: 1000, value: 80 }],
      NOW, WIN, 0, 100, H, TOP, BOT, 5,
    );
    // value rises 20→80 → Y decreases (screen-up); the time-anchored grid can
    // overhang the series' clamped ends, so ties are allowed there.
    for (let i = 1; i < out.length; i++)
      expect(out[i]).toBeLessThanOrEqual(out[i - 1]);
    expect(out[0]).toBeCloseTo(yOf(20));
    expect(out[out.length - 1]).toBeCloseTo(yOf(80));
  });

  it("keeps sample values stable while the window glides (fluid motion)", () => {
    // Fluidity regression (#187 follow-up): sample TIMES are anchored to an
    // absolute grid, so a step's samples must be IDENTICAL for nearby `now`s —
    // the step then translates via the gliding span instead of popping from one
    // fixed screen bin to the next while the data line glides beside it.
    // Step at 933.4 — chosen so a window-relative sampler (the old behavior,
    // times winStart + i/(count-1)·window = 900, 933.33, 966.67, 1000) sweeps a
    // sample time across the step under the +0.2s nudge and its values change,
    // while the absolute grid (900, 950, 1000, 1050) is nowhere near it.
    const step = [
      { time: 900, value: 30 },
      { time: 933.4, value: 30 },
      { time: 933.4, value: 70 },
      { time: 1000, value: 70 },
    ];
    // count 4 → spacing WIN/2 = 50s; a sub-spacing nudge must not re-anchor.
    const a = sampleThresholdY(step, NOW, WIN, 0, 100, H, TOP, BOT, 4);
    const b = sampleThresholdY(step, NOW + 0.2, WIN, 0, 100, H, TOP, BOT, 4);
    expect(b).toEqual(a);
    // The pixel span DOES glide with the nudge (same width, shifted left).
    const [a0, a1] = thresholdSampleSpanX(NOW, WIN, LEFT, W - RIGHT, 4);
    const [b0, b1] = thresholdSampleSpanX(NOW + 0.2, WIN, LEFT, W - RIGHT, 4);
    expect(b0).toBeLessThan(a0);
    expect(b1 - b0).toBeCloseTo(a1 - a0);
    // And the grid always covers the plot.
    expect(a0).toBeLessThanOrEqual(LEFT);
    expect(a1).toBeGreaterThanOrEqual(W - RIGHT);
  });

  it("fills with a far-below Y when the range is degenerate", () => {
    const out = sampleThresholdY(
      [{ time: 950, value: 50 }], NOW, WIN, 50, 50, H, TOP, BOT, 4,
    );
    expect(out).toHaveLength(4);
    out.forEach((y) => expect(y).toBeGreaterThan(H));
  });

  it("samples a single value when count is 1 (no divide-by-zero)", () => {
    const out = sampleThresholdY(
      [{ time: 900, value: 50 }, { time: 1000, value: 50 }],
      NOW, WIN, 0, 100, H, TOP, BOT, 1,
    );
    expect(out).toEqual([expect.closeTo(yOf(50))]);
  });

  it("uses a fixed far-below Y when the canvas has not laid out", () => {
    const out = sampleThresholdY(
      [{ time: 950, value: 50 }], NOW, WIN, 0, 100, 0, TOP, BOT, 3,
    );
    expect(out).toEqual([1e6, 1e6, 1e6]);
  });

  it("degrades NaN series values to the far-below fallback per sample", () => {
    // Bad data must not leak NaN into the shader uniform / band vertices.
    const out = sampleThresholdY(
      [{ time: 900, value: NaN }, { time: 1000, value: NaN }],
      NOW, WIN, 0, 100, H, TOP, BOT, 4,
    );
    expect(out).toHaveLength(4);
    out.forEach((y) => {
      expect(Number.isFinite(y)).toBe(true);
      expect(y).toBeGreaterThan(H);
    });
  });
});

describe("sampleThresholdYAt", () => {
  // 5 samples across the plot [100, 500] → spacing 100px: y = 80,60,60,40,40.
  const samples = [80, 60, 60, 40, 40];
  const PL = 100;
  const PR = 500;

  it("returns the exact sample value at a sample x", () => {
    expect(sampleThresholdYAt(samples, PL, PR, 100)).toBeCloseTo(80);
    expect(sampleThresholdYAt(samples, PL, PR, 300)).toBeCloseTo(60);
    expect(sampleThresholdYAt(samples, PL, PR, 500)).toBeCloseTo(40);
  });

  it("linearly interpolates between samples (matching the shader)", () => {
    expect(sampleThresholdYAt(samples, PL, PR, 150)).toBeCloseTo(70); // 80→60
    expect(sampleThresholdYAt(samples, PL, PR, 450)).toBeCloseTo(40); // flat 40→40
  });

  it("clamps to the first/last sample outside the plot", () => {
    expect(sampleThresholdYAt(samples, PL, PR, 0)).toBe(80);
    expect(sampleThresholdYAt(samples, PL, PR, 999)).toBe(40);
  });

  it("degrades safely for empty / single-sample / zero-span input", () => {
    expect(sampleThresholdYAt([], PL, PR, 200)).toBe(0);
    expect(sampleThresholdYAt([55], PL, PR, 200)).toBe(55);
    expect(sampleThresholdYAt(samples, PL, PL, 200)).toBe(80);
  });
});

describe("thresholdSeriesVisible", () => {
  it("is true when any vertex sits within the plot", () => {
    expect(thresholdSeriesVisible([LEFT, TOP + 100, W - RIGHT, TOP + 100], H, TOP, BOT)).toBe(true);
  });

  it("is false when the whole polyline is off-plot, empty, or un-laid-out", () => {
    expect(thresholdSeriesVisible([LEFT, -5, W - RIGHT, -5], H, TOP, BOT)).toBe(false);
    expect(thresholdSeriesVisible([], H, TOP, BOT)).toBe(false);
    expect(thresholdSeriesVisible([LEFT, 100], 0, TOP, BOT)).toBe(false);
  });

  it("is true for a step riser that crosses the plot between two vertices", () => {
    // Both endpoints outside the plot band, on opposite sides — the segment
    // still crosses the whole visible plot and must count as visible.
    expect(thresholdSeriesVisible([LEFT, -50, W - RIGHT, H + 200], H, TOP, BOT)).toBe(true);
    expect(thresholdSeriesVisible([LEFT, H + 200, W - RIGHT, -50], H, TOP, BOT)).toBe(true);
    // Same side (both above) stays invisible.
    expect(thresholdSeriesVisible([LEFT, -50, W - RIGHT, -5], H, TOP, BOT)).toBe(false);
    // A NaN vertex breaks the segment — no phantom crossing through the gap.
    expect(thresholdSeriesVisible([LEFT, -50, 200, NaN, W - RIGHT, H + 200], H, TOP, BOT)).toBe(false);
  });
});
