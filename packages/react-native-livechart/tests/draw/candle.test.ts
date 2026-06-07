import type { CandlePoint } from "../../src/types";
import { buildCandleGeometry } from "../../src/draw/candle";

const pad = { top: 10, right: 10, bottom: 10, left: 10 };

function makeCandle(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
): CandlePoint {
  return { time, open, high, low, close };
}

describe("buildCandleGeometry", () => {
  it("returns empty when valRange is zero", () => {
    const result = buildCandleGeometry(
      [],
      null,
      pad,
      200,
      100,
      0,
      60,
      50,
      50,
      10,
    );
    expect(result.bodies).toEqual([]);
    expect(result.wicks).toEqual([]);
  });

  it("returns empty when chart dimensions are zero", () => {
    const c = [makeCandle(10, 100, 110, 90, 105)];
    const result = buildCandleGeometry(
      c,
      null,
      pad,
      0,
      100,
      0,
      60,
      90,
      110,
      10,
    );
    expect(result.bodies).toEqual([]);
  });

  it("computes bodies and wicks for a single candle", () => {
    const c = [makeCandle(30, 100, 120, 80, 110)];
    const result = buildCandleGeometry(
      c,
      null,
      pad,
      200,
      100,
      0, // winStart
      120, // windowSecs
      80, // displayMin
      120, // displayMax
      60, // candleWidthSecs
    );
    expect(result.bodies).toHaveLength(1);
    expect(result.wicks).toHaveLength(1);
    expect(result.bodies[0].up).toBe(true);
  });

  it("classifies a down candle correctly", () => {
    const c = [makeCandle(0, 110, 120, 80, 90)];
    const result = buildCandleGeometry(
      c,
      null,
      pad,
      200,
      100,
      0,
      60,
      80,
      120,
      60,
    );
    expect(result.bodies[0].up).toBe(false);
    expect(result.wicks[0].up).toBe(false);
  });

  it("includes the live candle", () => {
    const committed = [makeCandle(0, 100, 110, 90, 105)];
    const live = makeCandle(60, 105, 115, 95, 112);
    const result = buildCandleGeometry(
      committed,
      live,
      pad,
      200,
      100,
      0,
      120,
      80,
      120,
      60,
    );
    expect(result.bodies).toHaveLength(2);
    expect(result.wicks).toHaveLength(2);
  });

  it("excludes candles outside the visible window", () => {
    const c = [
      makeCandle(0, 100, 110, 90, 105),
      makeCandle(60, 105, 115, 95, 112),
      makeCandle(120, 112, 125, 100, 120),
    ];
    // winStart=200, window=60 => visible [200, 260]. All candles end at t<=180, so none visible.
    const result = buildCandleGeometry(
      c,
      null,
      pad,
      200,
      100,
      200,
      60,
      80,
      130,
      60,
    );
    expect(result.bodies).toHaveLength(0);
  });

  it("handles doji (open === close) with minimum body height", () => {
    const c = [makeCandle(0, 100, 110, 90, 100)];
    const result = buildCandleGeometry(
      c,
      null,
      pad,
      200,
      100,
      0,
      60,
      90,
      110,
      60,
    );
    expect(result.bodies[0].h).toBeGreaterThanOrEqual(1);
    expect(result.bodies[0].up).toBe(true);
  });

  it("clamps candle body to chart left edge", () => {
    const c = [makeCandle(-25, 100, 110, 90, 105)];
    const result = buildCandleGeometry(
      c,
      null,
      pad,
      200,
      100,
      0,
      60,
      90,
      110,
      60,
    );
    if (result.bodies.length > 0) {
      expect(result.bodies[0].x).toBeGreaterThanOrEqual(pad.left);
    }
  });

  it("clamps candle body to chart right edge", () => {
    const c = [makeCandle(55, 100, 110, 90, 105)];
    const result = buildCandleGeometry(
      c,
      null,
      pad,
      200,
      100,
      0,
      60,
      90,
      110,
      60,
    );
    if (result.bodies.length > 0) {
      expect(result.bodies[0].x + result.bodies[0].w).toBeLessThanOrEqual(
        200 - pad.right,
      );
    }
  });

  it("positions body X centered on candle midpoint", () => {
    const c = [makeCandle(0, 100, 110, 90, 105)];
    const result = buildCandleGeometry(
      c,
      null,
      pad,
      200,
      100,
      0,
      60,
      90,
      110,
      60,
    );
    const chartW = 200 - 10 - 10;
    const xCenter = 10 + ((0 + 30) / 60) * chartW;
    expect(result.bodies[0].x).toBeCloseTo(xCenter - result.bodies[0].w / 2, 1);
  });
});

describe("candle geometry metrics overrides", () => {
  const c = [makeCandle(0, 100, 110, 90, 105)];

  it("caps body width at maxBodyPx", () => {
    const def = buildCandleGeometry(c, null, pad, 1000, 210, 0, 60, 90, 110, 60);
    expect(def.bodies[0].w).toBe(40); // default maxBodyPx
    const narrow = buildCandleGeometry(c, null, pad, 1000, 210, 0, 60, 90, 110, 60, {
      minBodyPx: 1,
      maxBodyPx: 20,
      bodyWidthRatio: 0.8,
    });
    expect(narrow.bodies[0].w).toBe(20);
  });

  it("scales body width by bodyWidthRatio", () => {
    // chartW = 60 - 20 = 40, slotPx = 40; ratio binds below maxBodyPx.
    const def = buildCandleGeometry(c, null, pad, 60, 210, 0, 60, 90, 110, 60);
    expect(def.bodies[0].w).toBe(32); // 40 * 0.8
    const thin = buildCandleGeometry(c, null, pad, 60, 210, 0, 60, 90, 110, 60, {
      minBodyPx: 1,
      maxBodyPx: 40,
      bodyWidthRatio: 0.5,
    });
    expect(thin.bodies[0].w).toBe(20); // 40 * 0.5
  });

  it("floors body height at minBodyPx for a doji", () => {
    const doji = [makeCandle(0, 100, 110, 90, 100)]; // open === close
    const def = buildCandleGeometry(doji, null, pad, 1000, 210, 0, 60, 90, 110, 60);
    expect(def.bodies[0].h).toBe(1); // default minBodyPx
    const tall = buildCandleGeometry(doji, null, pad, 1000, 210, 0, 60, 90, 110, 60, {
      minBodyPx: 6,
      maxBodyPx: 40,
      bodyWidthRatio: 0.8,
    });
    expect(tall.bodies[0].h).toBe(6);
  });
});
