import {
  BADGE_DOT_GAP,
  BADGE_MARGIN_RIGHT,
  BADGE_PILL_PAD_X,
  BADGE_TAIL_LEN,
  DEFAULT_PADDING,
  badgeTailAndCap,
  buildLinePoints,
  gutterCenteredTextLeftX,
  gutterRightAlignedTextLeftX,
  minPaddingLeftForBadge,
  minPaddingRightForBadgeYAxisAlign,
  minPaddingRightForYAxisWithPulse,
  pulseRadialOutset,
  resolveAutoLeft,
  resolveAutoRight,
  resolvePadding,
} from "../../src/draw/line";
import { BADGE_METRICS_DEFAULTS } from "../../src/constants";

describe("gutterCenteredTextLeftX", () => {
  it("matches grid label placement", () => {
    expect(gutterCenteredTextLeftX(400, 130, 35)).toBe(317.5);
  });
});

describe("gutterRightAlignedTextLeftX", () => {
  it("places text flush to the right with margin", () => {
    expect(gutterRightAlignedTextLeftX(400, 100, 8)).toBe(292);
    expect(gutterRightAlignedTextLeftX(400, 100)).toBe(296);
  });
});

describe("minPaddingLeftForBadge", () => {
  it("includes margin, pill padding, text width, and dot gap", () => {
    expect(minPaddingLeftForBadge(40)).toBe(
      Math.ceil(BADGE_MARGIN_RIGHT + 2 * BADGE_PILL_PAD_X + 40 + BADGE_DOT_GAP),
    );
  });
});

describe("resolveAutoLeft", () => {
  it("widens left inset for left badge", () => {
    expect(resolveAutoLeft(true)).toBe(minPaddingLeftForBadge(49));
    expect(resolveAutoLeft(false)).toBe(DEFAULT_PADDING.left);
  });
});

describe("badgeTailAndCap", () => {
  it("includes BADGE_TAIL_LEN when showTail is true (default)", () => {
    expect(badgeTailAndCap(12)).toBe(badgeTailAndCap(12, true));
    expect(badgeTailAndCap(12, true)).toBe(BADGE_TAIL_LEN + 9); // 5 + (12+6)/2
  });

  it("omits BADGE_TAIL_LEN when showTail is false", () => {
    expect(badgeTailAndCap(12, false)).toBe(9); // (12+6)/2
    expect(badgeTailAndCap(12, true) - badgeTailAndCap(12, false)).toBe(
      BADGE_TAIL_LEN,
    );
  });
});

describe("minPaddingRightForBadgeYAxisAlign", () => {
  it("returns DOT_GAP + tl + 2×PAD_X + textWidth + MARGIN_RIGHT (tl=14 for 12px font)", () => {
    // 12 + 14 + 20 + 35 + 4 = 85
    expect(minPaddingRightForBadgeYAxisAlign(12, 35)).toBe(85);
  });

  it("returns smaller padding when showTail is false", () => {
    // 12 + 9 + 20 + 35 + 4 = 80
    expect(minPaddingRightForBadgeYAxisAlign(12, 35, false)).toBe(80);
    expect(
      minPaddingRightForBadgeYAxisAlign(12, 35, true) -
        minPaddingRightForBadgeYAxisAlign(12, 35, false),
    ).toBe(BADGE_TAIL_LEN);
  });
});

describe("pulseRadialOutset", () => {
  it("ceil(maxRadius + strokeWidth/2) for default pulse-like values", () => {
    expect(pulseRadialOutset(21, 1.5)).toBe(22);
  });

  it("handles integer sum without fractional waste", () => {
    expect(pulseRadialOutset(20, 2)).toBe(21);
  });

  it("uses maxRadius alone when strokeWidth is zero", () => {
    expect(pulseRadialOutset(15, 0)).toBe(15);
  });

  it("rounds up fractional totals", () => {
    expect(pulseRadialOutset(10, 1)).toBe(11);
    expect(pulseRadialOutset(9, 1)).toBe(10);
  });
});

describe("minPaddingRightForYAxisWithPulse", () => {
  it("is 2×outlet + label width + gap (default gap 8)", () => {
    // outlet 22, tw 42 → 44 + 42 + 8 = 94
    expect(minPaddingRightForYAxisWithPulse(22, 42)).toBe(94);
  });
});

describe("resolveAutoRight", () => {
  it("prefers badge width (fallback ~7 chars × 7px label)", () => {
    // minPaddingRightForBadgeYAxisAlign(12, 49) = 12 + 14 + 20 + 49 + 4 = 99
    expect(resolveAutoRight(true, true)).toBe(99);
  });

  it("uses smaller badge width when showTail is false", () => {
    // minPaddingRightForBadgeYAxisAlign(12, 49, false) = 12 + 9 + 20 + 49 + 4 = 94
    expect(resolveAutoRight(true, true, false)).toBe(94);
  });

  it("uses grid width when no badge", () => {
    expect(resolveAutoRight(true, false)).toBe(44);
  });

  it("falls back to default right", () => {
    expect(resolveAutoRight(false, false)).toBe(DEFAULT_PADDING.right);
  });
});

describe("resolvePadding", () => {
  it("returns defaults with auto right when undefined", () => {
    expect(resolvePadding(undefined, false, false)).toEqual({
      ...DEFAULT_PADDING,
      right: DEFAULT_PADDING.right,
    });
    expect(resolvePadding(undefined, true, false).right).toBe(44);
    expect(resolvePadding(undefined, true, true).right).toBe(99);
  });

  it("merges partial overrides", () => {
    expect(resolvePadding({ top: 1 }, false, false)).toEqual({
      top: 1,
      right: DEFAULT_PADDING.right,
      bottom: DEFAULT_PADDING.bottom,
      left: DEFAULT_PADDING.left,
    });
    expect(resolvePadding({ top: 1 }, true, false).right).toBe(44);
    expect(resolvePadding({ top: 1 }, true, true).right).toBe(99);
    expect(resolvePadding({ right: 99 }, true, true).right).toBe(99);
  });

  it("uses auto right when override omits right", () => {
    expect(resolvePadding({ left: 40 }, true, false).right).toBe(44);
    expect(resolvePadding({ left: 40 }, false, false).right).toBe(
      DEFAULT_PADDING.right,
    );
  });

  it("uses default grid and badge flags when those args are omitted", () => {
    const r = resolvePadding({ left: 40 });
    expect(r.left).toBe(40);
    expect(r.right).toBe(DEFAULT_PADDING.right);
  });

  it("widens left padding when badgeOnLeft is true", () => {
    const r = resolvePadding(undefined, false, false, true);
    expect(r.left).toBe(resolveAutoLeft(true));
  });
});

describe("buildLinePoints", () => {
  const pad = DEFAULT_PADDING;

  it("returns empty when valRange is zero", () => {
    const pts = buildLinePoints(
      [{ time: 0, value: 5 }],
      5,
      100,
      30,
      5,
      5,
      200,
      100,
      pad,
    );
    expect(pts).toEqual([]);
  });

  it("returns empty when chart dimensions invalid", () => {
    const pts = buildLinePoints(
      [{ time: 0, value: 1 }],
      1,
      100,
      30,
      0,
      10,
      0,
      100,
      pad,
    );
    expect(pts).toEqual([]);
  });

  it("returns empty when data empty", () => {
    const pts = buildLinePoints([], 1, 100, 30, 0, 10, 200, 100, pad);
    expect(pts).toEqual([]);
  });

  it("builds points and live tip", () => {
    const now = 100;
    const data = [
      { time: now - 20, value: 0 },
      { time: now - 10, value: 10 },
    ];
    const out = buildLinePoints(data, 5, now, 30, 0, 20, 200, 120, pad);
    expect(out.length % 2).toBe(0);
    expect(out.length).toBeGreaterThanOrEqual(4);
  });

  it("uses startIdx lo-1 when lo > 0", () => {
    const now = 1000;
    const data = [
      { time: now - 100, value: 0 },
      { time: now - 50, value: 5 },
      { time: now - 1, value: 8 },
    ];
    const out = buildLinePoints(data, 8, now, 30, 0, 10, 200, 120, pad);
    expect(out.length).toBeGreaterThan(0);
  });

  it("stops at points after now", () => {
    const now = 100;
    const data = [
      { time: now - 5, value: 1 },
      { time: now + 10, value: 99 },
    ];
    const out = buildLinePoints(data, 1, now, 30, 0, 10, 200, 120, pad);
    const n = out.length >> 1;
    expect(n).toBeGreaterThan(0);
  });
});

describe("badge geometry metrics overrides", () => {
  it("badgeTailAndCap honors custom tailLength and padY", () => {
    const m = { ...BADGE_METRICS_DEFAULTS, tailLength: 12, padY: 5 };
    // tailLength + (fontSize + padY*2)/2 = 12 + (12 + 10)/2 = 12 + 11 = 23
    expect(badgeTailAndCap(12, true, m)).toBe(23);
    // showTail=false drops the tail term -> (12 + 10)/2 = 11
    expect(badgeTailAndCap(12, false, m)).toBe(11);
  });

  it("minPaddingRightForBadgeYAxisAlign honors custom dotGap/padX/marginEdge", () => {
    const base = minPaddingRightForBadgeYAxisAlign(12, 35);
    const wider = minPaddingRightForBadgeYAxisAlign(12, 35, true, {
      ...BADGE_METRICS_DEFAULTS,
      dotGap: BADGE_DOT_GAP + 10,
    });
    expect(wider - base).toBe(10);
  });

  it("minPaddingLeftForBadge honors custom geometry", () => {
    const m = { ...BADGE_METRICS_DEFAULTS, padX: BADGE_PILL_PAD_X + 5 };
    const base = minPaddingLeftForBadge(40);
    // padX appears twice in the formula -> +10
    expect(minPaddingLeftForBadge(40, m) - base).toBe(10);
  });

  it("resolvePadding threads badge metrics into the auto right gutter", () => {
    const wide = resolvePadding(
      undefined,
      true,
      true,
      false,
      true,
      true,
      { ...BADGE_METRICS_DEFAULTS, marginEdge: BADGE_MARGIN_RIGHT + 8 },
    );
    const base = resolvePadding(undefined, true, true, false, true, true);
    expect(wide.right - base.right).toBe(8);
  });
});

describe("buildLinePoints decimation", () => {
  const pad = DEFAULT_PADDING;
  const canvasW = 400;
  const canvasH = 200;
  const chartW = canvasW - pad.left - pad.right; // 376

  it("keeps the exact per-sample path below ~2 points per pixel", () => {
    const data = Array.from({ length: 50 }, (_, i) => ({ time: i, value: i }));
    const out = buildLinePoints(data, 49, 49, 50, 0, 50, canvasW, canvasH, pad);
    // 50 visible samples + the live tip, no decimation.
    expect(out.length / 2).toBe(51);
  });

  it("decimates a dense window to ~pixel resolution", () => {
    const N = 2000;
    const data = Array.from({ length: N }, (_, i) => ({ time: i, value: 1 }));
    const out = buildLinePoints(data, 1, N - 1, N, 0, 100, canvasW, canvasH, pad);
    const count = out.length / 2;
    expect(count).toBeLessThan(N); // far fewer than the sample count
    expect(count).toBeLessThanOrEqual(chartW * 2 + 4); // bounded by ~2/pixel + tip
  });

  it("preserves volatility spikes through decimation (min/max per column)", () => {
    const N = 2000;
    const data = Array.from({ length: N }, (_, i) => ({ time: i, value: 1 }));
    data[1000].value = 100; // single tall spike mid-window
    const out = buildLinePoints(data, 1, N - 1, N, 0, 100, canvasW, canvasH, pad);
    // The spike (value 100 => y at padding.top) must survive as the column max.
    let minY = Infinity;
    for (let i = 1; i < out.length; i += 2) minY = Math.min(minY, out[i]);
    expect(minY).toBeCloseTo(pad.top, 0);
  });
});
