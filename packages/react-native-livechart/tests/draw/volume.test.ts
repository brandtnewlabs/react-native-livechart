import type { CandlePoint } from "../../src/types";
import { buildVolumeGeometry } from "../../src/draw/volume";

// bottom (30) already includes a 20px band in these fixtures, mirroring how
// resolveChartLayout inflates padding.bottom. canvas 200×100.
const pad = { top: 10, right: 10, bottom: 30, left: 10 };

function vc(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume?: number,
): CandlePoint {
  return { time, open, high, low, close, volume };
}

describe("buildVolumeGeometry", () => {
  it("returns empty when bandHeight is 0", () => {
    const r = buildVolumeGeometry(
      [vc(0, 1, 2, 0, 1, 5)],
      null,
      pad,
      200,
      100,
      0,
      60,
      0, // bandHeight
      60,
    );
    expect(r.bars).toEqual([]);
  });

  it("returns empty when chart width is non-positive", () => {
    // canvasW 10 - left/right 20 = -10
    const r = buildVolumeGeometry(
      [vc(0, 1, 2, 0, 1, 5)],
      null,
      pad,
      10,
      100,
      0,
      60,
      20,
      60,
    );
    expect(r.bars).toEqual([]);
  });

  it("returns empty when no visible candle carries volume", () => {
    const r = buildVolumeGeometry(
      [{ time: 0, open: 1, high: 2, low: 0, close: 1 }],
      null,
      pad,
      200,
      100,
      0,
      60,
      20,
      60,
    );
    expect(r.bars).toEqual([]);
  });

  it("fills the band for the max-volume candle", () => {
    const r = buildVolumeGeometry(
      [vc(0, 1, 2, 0, 1, 5)],
      null,
      pad,
      200,
      100,
      0,
      60,
      20,
      60,
    );
    expect(r.bars).toHaveLength(1);
    expect(r.bars[0].h).toBeCloseTo(20, 5); // fills the band
    const baseline = 100 - 30 + 20; // 90 (x-axis line)
    expect(r.bars[0].y).toBeCloseTo(baseline - 20, 5); // band top = 70
    expect(r.bars[0].w).toBe(40); // default maxBodyPx
  });

  it("normalizes bar heights to the max visible volume", () => {
    const r = buildVolumeGeometry(
      [vc(0, 1, 2, 0, 1, 10), vc(60, 1, 2, 0, 1, 5)],
      null,
      pad,
      200,
      100,
      0,
      120, // window covers both
      20,
      60,
    );
    expect(r.bars).toHaveLength(2);
    expect(r.bars[0].h).toBeCloseTo(20, 5); // max → full band
    expect(r.bars[1].h).toBeCloseTo(10, 5); // half volume → half band
  });

  it("classifies up vs down bars by close vs open", () => {
    const up = buildVolumeGeometry(
      [vc(0, 1, 2, 0, 2, 5)],
      null,
      pad,
      200,
      100,
      0,
      60,
      20,
      60,
    );
    expect(up.bars[0].up).toBe(true);
    const down = buildVolumeGeometry(
      [vc(0, 2, 2, 0, 1, 5)],
      null,
      pad,
      200,
      100,
      0,
      60,
      20,
      60,
    );
    expect(down.bars[0].up).toBe(false);
  });

  it("includes the live candle and uses it for normalization", () => {
    const r = buildVolumeGeometry(
      [vc(0, 1, 2, 0, 1, 5)],
      vc(60, 1, 2, 0, 1, 10), // bigger volume → fills band
      pad,
      200,
      100,
      0,
      120,
      20,
      60,
    );
    expect(r.bars).toHaveLength(2);
    expect(r.bars[0].h).toBeCloseTo(10, 5); // committed 5/10 → half band
    expect(r.bars[1].h).toBeCloseTo(20, 5); // live fills band
  });

  it("aligns the bar x with the candle body center", () => {
    const r = buildVolumeGeometry(
      [vc(0, 1, 2, 0, 1, 5)],
      null,
      pad,
      200,
      100,
      0,
      60,
      20,
      60,
    );
    const chartW = 180;
    const xCenter = 10 + ((0 + 30) / 60) * chartW; // 100
    expect(r.bars[0].x).toBeCloseTo(xCenter - r.bars[0].w / 2, 5);
  });

  it("clamps a bar to the chart left edge", () => {
    const r = buildVolumeGeometry(
      [vc(-25, 1, 2, 0, 1, 5)],
      null,
      pad,
      200,
      100,
      0,
      60,
      20,
      60,
    );
    expect(r.bars[0].x).toBeGreaterThanOrEqual(pad.left);
  });

  it("clamps a bar to the chart right edge", () => {
    // time 30 → center lands exactly on the right edge, so the body pokes past
    // it and is clamped (rather than skipped like a far-right center would be).
    const r = buildVolumeGeometry(
      [vc(30, 1, 2, 0, 1, 5)],
      null,
      pad,
      200,
      100,
      0,
      60,
      20,
      60,
    );
    expect(r.bars).toHaveLength(1);
    expect(r.bars[0].x + r.bars[0].w).toBeLessThanOrEqual(200 - pad.right);
  });

  it("excludes candles entirely outside the visible window", () => {
    // window [200, 260]; candle ends at 60, far before
    const r = buildVolumeGeometry(
      [vc(0, 1, 2, 0, 1, 5)],
      null,
      pad,
      200,
      100,
      200,
      60,
      20,
      60,
    );
    expect(r.bars).toEqual([]);
  });

  it("ignores a live candle after the window", () => {
    const r = buildVolumeGeometry(
      [vc(0, 1, 2, 0, 1, 5)],
      vc(1000, 1, 2, 0, 1, 99), // way past the window → ignored
      pad,
      200,
      100,
      0,
      60,
      20,
      60,
    );
    expect(r.bars).toHaveLength(1);
    expect(r.bars[0].h).toBeCloseTo(20, 5); // normalized to the only visible vol
  });

  it("ignores a live candle before the window", () => {
    const r = buildVolumeGeometry(
      [vc(0, 1, 2, 0, 1, 5)],
      vc(-1000, 1, 2, 0, 1, 99), // ends well before winStart → ignored
      pad,
      200,
      100,
      0,
      60,
      20,
      60,
    );
    expect(r.bars).toHaveLength(1);
  });

  it("skips zero- and undefined-volume candles while keeping the rest", () => {
    const r = buildVolumeGeometry(
      // undefined volume, explicit 0, then a real bar
      [vc(0, 1, 2, 0, 1), vc(60, 1, 2, 0, 1, 0), vc(120, 1, 2, 0, 1, 5)],
      null,
      pad,
      200,
      100,
      0,
      180,
      20,
      60,
    );
    expect(r.bars).toHaveLength(1);
  });

  it("skips candles whose center falls far outside the plot (both edges)", () => {
    // -59.5 overlaps the window (time+cw = 0.5 ≥ 0) but its center is far left;
    // 59.9 overlaps (time ≤ winEnd) but its center is far right. Only time-0 draws.
    const r = buildVolumeGeometry(
      [vc(-59.5, 1, 2, 0, 1, 5), vc(0, 1, 2, 0, 1, 10), vc(59.9, 1, 2, 0, 1, 5)],
      null,
      pad,
      200,
      100,
      0,
      60,
      20,
      60,
    );
    expect(r.bars).toHaveLength(1);
    expect(r.bars[0].x).toBeCloseTo(100 - r.bars[0].w / 2, 5);
  });

  it("respects a custom bodyWidthRatio for bar width", () => {
    const r = buildVolumeGeometry(
      [vc(0, 1, 2, 0, 1, 5)],
      null,
      pad,
      60, // chartW = 40, slotPx = 40
      100,
      0,
      60,
      20,
      60,
      {
        minBodyPx: 1,
        maxBodyPx: 40,
        bodyWidthRatio: 0.5,
        bodyRadius: 0,
        wickWidth: 1,
      },
    );
    expect(r.bars[0].w).toBe(20); // 40 * 0.5
  });
});
