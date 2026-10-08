import { type SkFont } from "@shopify/react-native-skia";

import {
  computeActionBadgeLayout,
  computeScrubDotY,
  computeTimeBadgeLayout,
  computeValueAtY,
  pinnedPlotY,
  pointInRect,
  snapPrice,
  snapPriceOutward,
  snapPriceWithin,
  snapScrubXToCandleCenter,
} from "../../src/hooks/crosshairShared";
import type { CandlePoint } from "../../src/types";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as unknown as SkFont;

describe("pinnedPlotY", () => {
  // 0–100 on a 300 px canvas with 12 / 28 px padding: the plot runs y 12 → 272.
  it("is the projected Y for a value in range", () => {
    // 12 + (100 − 50) / 100 × 260
    expect(pinnedPlotY(50, 0, 100, 300, 12, 28)).toBe(142);
  });

  it("pins a value far above the range to the top edge", () => {
    expect(computeScrubDotY(200, 0, 100, 300, 12, 28)).toBeLessThan(0);
    expect(pinnedPlotY(200, 0, 100, 300, 12, 28)).toBe(12);
  });

  it("pins a value below the range to the bottom edge", () => {
    expect(pinnedPlotY(-100, 0, 100, 300, 12, 28)).toBe(272);
  });

  it("pins a valid projection of exactly -1 rather than treating it as missing layout", () => {
    expect(computeScrubDotY(105, 0, 100, 300, 12, 28)).toBe(-1);
    expect(pinnedPlotY(105, 0, 100, 300, 12, 28)).toBe(12);
  });

  it("preserves the centered flat range and NaN projection", () => {
    expect(pinnedPlotY(50, 50, 50, 300, 12, 28)).toBe(142);
    expect(pinnedPlotY(NaN, 0, 100, 300, 12, 28)).toBeNaN();
  });

  it("is -1 when there is no plot height", () => {
    expect(pinnedPlotY(50, 0, 100, 40, 12, 28)).toBe(-1);
    expect(pinnedPlotY(50, 0, 100, 0, 12, 28)).toBe(-1);
  });
});

describe("computeValueAtY", () => {
  it("returns null when the canvas is not laid out (chartH <= 0)", () => {
    expect(computeValueAtY(50, 0, 100, 0, 12, 28)).toBeNull();
  });

  it("returns displayMin for a degenerate (zero) range", () => {
    expect(computeValueAtY(50, 42, 42, 300, 12, 28)).toBe(42);
  });

  it("maps the top edge to displayMax, bottom to displayMin, mid to mid", () => {
    const padTop = 12;
    const padBottom = 28;
    const h = 300;
    expect(computeValueAtY(padTop, 0, 100, h, padTop, padBottom)).toBeCloseTo(100);
    expect(
      computeValueAtY(h - padBottom, 0, 100, h, padTop, padBottom),
    ).toBeCloseTo(0);
    const mid = padTop + (h - padTop - padBottom) / 2;
    expect(computeValueAtY(mid, 0, 100, h, padTop, padBottom)).toBeCloseTo(50);
  });

  it("clamps a Y below the plot to displayMin", () => {
    expect(computeValueAtY(99999, 0, 100, 300, 12, 28)).toBeCloseTo(0);
  });

  it("clamps a Y above the plot to displayMax", () => {
    expect(computeValueAtY(-50, 0, 100, 300, 12, 28)).toBeCloseTo(100);
  });

  it("round-trips with computeScrubDotY (the forward mapping)", () => {
    const v = 37.5;
    const y = computeScrubDotY(v, 0, 100, 300, 12, 28);
    expect(computeValueAtY(y, 0, 100, 300, 12, 28)).toBeCloseTo(v);
  });

  it("price-stable lock: a frozen price keeps its value while its Y tracks the range", () => {
    // Old (buggy) model derived the price from a FIXED pixel each frame, so the
    // reported price drifted as the axis rescaled:
    const pixelY = 150;
    const drift1 = computeValueAtY(pixelY, 0, 100, 300, 12, 28);
    const drift2 = computeValueAtY(pixelY, 20, 120, 300, 12, 28);
    expect(drift2).not.toBeCloseTo(drift1 as number); // the drift the fix removes

    // New model freezes the price once (the source of truth) and re-derives the
    // line's Y from it: the value stays constant, the line moves to keep tracking
    // that price as displayMin/Max shift.
    const frozen = drift1 as number;
    const yUnchanged = computeScrubDotY(frozen, 0, 100, 300, 12, 28);
    const yShifted = computeScrubDotY(frozen, 20, 120, 300, 12, 28);
    expect(yUnchanged).toBeCloseTo(pixelY); // same range → same pixel
    expect(yShifted).not.toBeCloseTo(yUnchanged); // shifted range → line moves
  });
});

describe("snapPrice", () => {
  it("is a no-op without a positive increment", () => {
    expect(snapPrice(64.237)).toBe(64.237);
    expect(snapPrice(64.237, 0)).toBe(64.237);
    expect(snapPrice(64.237, -1)).toBe(64.237);
  });

  it("rounds to the nearest increment", () => {
    expect(snapPrice(64.3, 0.5)).toBe(64.5);
    expect(snapPrice(64.1, 0.5)).toBe(64);
    expect(snapPrice(64.236, 0.01)).toBeCloseTo(64.24);
  });
});

describe("snapPriceWithin", () => {
  it("rounds like snapPrice inside the range", () => {
    expect(snapPriceWithin(64.237, undefined, 60, 70)).toBe(64.237);
    expect(snapPriceWithin(64.3, 0.5, 60, 70)).toBe(64.5);
    expect(snapPriceWithin(64.1, 0.5, 60, 70)).toBe(64);
  });

  it("rounds one increment inward instead of past either edge", () => {
    expect(snapPriceWithin(101.23, 0.05, 89.96, 101.23)).toBeCloseTo(101.2);
    expect(snapPriceWithin(89.96, 0.05, 89.96, 101.23)).toBeCloseTo(90);
  });

  it("returns the edge when only float noise puts the rounding past it", () => {
    // 90.05 / 0.05 rounds back to 90.05000000000001.
    expect(snapPrice(90.05, 0.05)).toBeGreaterThan(90.05);
    expect(snapPriceWithin(90.05, 0.05, 80, 90.05)).toBe(90.05);
    expect(snapPriceWithin(90.05, 0.05, 90.05, 100)).toBeCloseTo(90.05);
  });

  it("scales the float-noise allowance with the price", () => {
    // At 100,000 the rounding is off by more than a billionth of a cent.
    expect(snapPrice(100000.01, 0.01)).toBeGreaterThan(100000.01);
    expect(snapPriceWithin(100000.01, 0.01, 99990, 100000.01)).toBe(100000.01);
  });

  it("leaves the rounding alone when no increment fits inside the range", () => {
    expect(snapPriceWithin(100.02, 0.05, 100.01, 100.03)).toBeCloseTo(100);
  });
});

describe("snapPriceOutward", () => {
  it("rounds to the nearest increment for side 0 or without an increment", () => {
    expect(snapPriceOutward(106.3, 1, 0)).toBe(106);
    expect(snapPriceOutward(106.3, undefined, 1)).toBe(106.3);
  });

  it("rounds up for side 1 and down for side -1", () => {
    expect(snapPriceOutward(106.3, 1, 1)).toBe(107);
    expect(snapPriceOutward(106.7, 1, 1)).toBe(107);
    expect(snapPriceOutward(93.7, 1, -1)).toBe(93);
  });

  it("keeps a price already on the grid, float noise included", () => {
    expect(snapPriceOutward(106, 1, 1)).toBe(106);
    expect(snapPriceOutward(90.05, 0.05, -1)).toBeCloseTo(90.05);
    expect(snapPriceOutward(100000.01, 0.01, 1)).toBeCloseTo(100000.01);
  });
});

describe("snapScrubXToCandleCenter", () => {
  const candle = (time: number): CandlePoint => ({
    time,
    open: 1,
    high: 2,
    low: 0,
    close: 1,
  });

  // chartW = 320 - 10 - 10 = 300 px over windowSecs = 300 s (1 px/s), so with
  // timestamp = 1000 the window starts at t = 700 and x maps to t = 690 + x.
  const padding = { top: 12, right: 10, bottom: 28, left: 10 };
  const canvasWidth = 320;
  const timestamp = 1000;
  const windowSecs = 300;
  const candleWidthSecs = 60;
  // Committed buckets [700, 760) and [760, 820), a gap [820, 880), then
  // [880, 940); the live candle owns [940, 1000).
  const candles = [candle(700), candle(760), candle(880)];
  const live = candle(940);

  const snap = (x: number, width = canvasWidth, win = windowSecs) =>
    snapScrubXToCandleCenter(
      x,
      candles,
      live,
      candleWidthSecs,
      padding,
      width,
      timestamp,
      win,
    );

  it("quantizes every X over a bucket to that candle's center", () => {
    // Bucket [700, 760): center 730 → x = 40.
    expect(snap(15)).toBeCloseTo(40);
    expect(snap(40)).toBeCloseTo(40);
    expect(snap(69)).toBeCloseTo(40);
    // Bucket [760, 820): center 790 → x = 100.
    expect(snap(75)).toBeCloseTo(100);
    expect(snap(129)).toBeCloseTo(100);
  });

  it("snaps to the live candle's center", () => {
    // Live bucket [940, 1000): center 970 → x = 280.
    expect(snap(255)).toBeCloseTo(280);
  });

  it("passes the raw X through in a gap between candles", () => {
    // t = 830 falls in the empty [820, 880) bucket.
    expect(snap(140)).toBe(140);
  });

  it("snaps an explicit no-trade gap to its empty bucket center", () => {
    expect(
      snapScrubXToCandleCenter(
        140,
        candles,
        live,
        candleWidthSecs,
        padding,
        canvasWidth,
        timestamp,
        windowSecs,
        [{ from: 820, to: 880, kind: "no-trades" }],
      ),
    ).toBeCloseTo(160);
  });

  it("passes the raw X through before the first candle", () => {
    // t = 695 predates the oldest bucket.
    expect(snap(5)).toBe(5);
  });

  it("guards a plot without horizontal extent", () => {
    expect(snap(40, padding.left + padding.right)).toBe(40); // chartW = 0
    expect(snap(40, 0)).toBe(40); // chartW < 0
  });

  it("guards a zero-length time window", () => {
    expect(snap(40, canvasWidth, 0)).toBe(40);
  });
});

describe("computeActionBadgeLayout", () => {
  it("is hidden when not locked", () => {
    const l = computeActionBadgeLayout(false, 100, "64.20", "+", 400, 360, font, 4, 10, 3);
    expect(l.visible).toBe(false);
  });

  it("is hidden when the canvas is not laid out", () => {
    const l = computeActionBadgeLayout(true, 100, "64.20", "+", 0, 0, font, 4, 10, 3);
    expect(l.visible).toBe(false);
  });

  it("lays out a circular icon button + a right-anchored price pill, text centered", () => {
    const l = computeActionBadgeLayout(true, 150, "64.20", "+", 400, 320, font, 4, 10, 3);
    expect(l.visible).toBe(true);
    expect(l.hasIcon).toBe(true);
    expect(l.hasPrice).toBe(true);
    // Pill height = fontSize + 2*padY = 18; centered on lockY=150.
    expect(l.h).toBe(18);
    expect(l.y).toBeCloseTo(150 - 9);
    expect(l.iconCy).toBe(150);
    expect(l.iconR).toBe(9); // circle radius = pillH/2
    // Price pill is rightmost (right edge = canvasWidth - marginEdge = 396).
    expect(l.priceX + l.priceW).toBeCloseTo(396);
    // Icon sits left of the price pill with the 2px gap.
    expect(l.iconCx + l.iconR).toBeCloseTo(l.priceX - 2);
    // Union spans both, right edge at the gutter.
    expect(l.x + l.w).toBeCloseTo(396);
    expect(l.x).toBeCloseTo(l.iconCx - l.iconR);
    expect(l.priceText).toBe("64.20");
    // Price text is horizontally centered in the pill (text center = pill center).
    const textW = "64.20".length * 7; // mock measureText width
    expect(l.priceTextX + textW / 2).toBeCloseTo(l.priceX + l.priceW / 2);
  });

  it("anchors an icon-only badge to the plot edge (attached to the line)", () => {
    const l = computeActionBadgeLayout(true, 150, "", "+", 400, 320, font, 4, 10, 3);
    expect(l.visible).toBe(true);
    expect(l.hasIcon).toBe(true);
    expect(l.hasPrice).toBe(false);
    // Icon centered on the plot's right edge (320), not the gutter edge (396),
    // so it stays attached to the level line, left of the Y-axis labels.
    expect(l.iconCx).toBeCloseTo(320);
    // Union hit rect is just the icon circle.
    expect(l.x).toBeCloseTo(320 - l.iconR);
    expect(l.x + l.w).toBeCloseTo(320 + l.iconR);
  });

  it("is hidden when both icon and price are empty", () => {
    const l = computeActionBadgeLayout(true, 150, "", "", 400, 360, font, 4, 10, 3);
    expect(l.visible).toBe(false);
  });

  it("sizes the price pill from the text's measured width", () => {
    const l = computeActionBadgeLayout(true, 150, "64.20", "+", 400, 360, font, 4, 10, 3);
    expect(l.visible).toBe(true);
    expect(l.w).toBeGreaterThan(0);
  });
});

describe("computeTimeBadgeLayout", () => {
  // signature: (locked, lockX, timeText, canvasWidth, labelBaselineY, font, padX, padY, marginEdge)
  const BASELINE = 291; // plot bottom (272) + X_AXIS_LABEL_OFFSET_Y (19)

  it("is hidden when not locked / not laid out / empty text", () => {
    expect(
      computeTimeBadgeLayout(false, 200, "13:00", 400, BASELINE, font, 10, 3, 4)
        .visible,
    ).toBe(false);
    expect(
      computeTimeBadgeLayout(true, 200, "13:00", 0, BASELINE, font, 10, 3, 4)
        .visible,
    ).toBe(false);
    expect(
      computeTimeBadgeLayout(true, 200, "", 400, BASELINE, font, 10, 3, 4)
        .visible,
    ).toBe(false);
  });

  it("centers a capsule under the reticle X, sitting on the axis-label baseline", () => {
    const l = computeTimeBadgeLayout(true, 200, "13:00", 400, BASELINE, font, 10, 3, 4);
    expect(l.visible).toBe(true);
    // Pill height = fontSize + 2*padY = 18.
    expect(l.h).toBe(18);
    // Text baseline aligns with the x-axis labels; pill is centered on that text
    // (font metrics ascent -9.6 / descent 2.4 → center offset -3.6).
    expect(l.textY).toBeCloseTo(BASELINE);
    expect(l.y + l.h / 2).toBeCloseTo(BASELINE + (-9.6 + 2.4) / 2);
    // Width = text + 2*padX; "13:00" → 5*7 + 20 = 55. Centered on x=200.
    expect(l.w).toBeCloseTo(55);
    expect(l.x + l.w / 2).toBeCloseTo(200);
    // Text is horizontally centered in the pill.
    const textW = "13:00".length * 7;
    expect(l.textX + textW / 2).toBeCloseTo(l.x + l.w / 2);
  });

  it("clamps the pill into the gutter at the left and right edges", () => {
    // Far-left reticle: pill can't spill past marginEdge.
    const left = computeTimeBadgeLayout(true, 2, "13:00", 400, BASELINE, font, 10, 3, 4);
    expect(left.x).toBeCloseTo(4);
    // Far-right reticle: pill right edge clamps to canvasWidth - marginEdge.
    const right = computeTimeBadgeLayout(true, 398, "13:00", 400, BASELINE, font, 10, 3, 4);
    expect(right.x + right.w).toBeCloseTo(396);
  });
});

describe("pointInRect", () => {
  const rect = { x: 100, y: 50, w: 60, h: 18 };

  it("is true for a point inside", () => {
    expect(pointInRect(120, 59, rect)).toBe(true);
  });

  it("is false for a point outside on either axis", () => {
    expect(pointInRect(50, 59, rect)).toBe(false);
    expect(pointInRect(120, 200, rect)).toBe(false);
  });

  it("honors slop inflation for a comfortable touch target", () => {
    expect(pointInRect(97, 59, rect)).toBe(false);
    expect(pointInRect(97, 59, rect, 6)).toBe(true);
  });
});
