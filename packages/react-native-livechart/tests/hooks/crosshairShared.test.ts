import { type SkFont } from "@shopify/react-native-skia";

import {
  computeActionBadgeLayout,
  computeScrubDotY,
  computeTimeBadgeLayout,
  computeValueAtY,
  pointInRect,
  snapPrice,
} from "../../src/hooks/crosshairShared";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as unknown as SkFont;

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
