import {
  DEFAULT_PADDING,
  buildLinePoints,
  gutterCenteredTextLeftX,
  minPaddingRightForBadgeYAxisAlign,
  minPaddingRightForYAxisWithPulse,
  pulseRadialOutset,
  resolveAutoRight,
  resolvePadding,
} from "./line";

describe("gutterCenteredTextLeftX", () => {
  it("matches grid label placement", () => {
    expect(gutterCenteredTextLeftX(400, 130, 35)).toBe(317.5);
  });
});

describe("minPaddingRightForBadgeYAxisAlign", () => {
  it("returns DOT_GAP + tl + 2×PAD_X + textWidth + MARGIN_RIGHT (tl=14 for 12px font)", () => {
    // 12 + 14 + 20 + 35 + 4 = 85
    expect(minPaddingRightForBadgeYAxisAlign(12, 35)).toBe(85);
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
