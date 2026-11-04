import {
  isResetButtonHit,
  isViewOffFitted,
  resetButtonRect,
} from "../../src/hooks/resetButtonLayout";

const padding = { left: 12, right: 68, top: 10, bottom: 60 };
// Plot rect: x 12..332, y 10..240.

describe("resetButtonRect", () => {
  it("centers the button above the time labels", () => {
    expect(resetButtonRect(400, 300, padding, "bottom-center", 12, 36, 36)).toEqual({
      x: 154,
      y: 192,
      width: 36,
      height: 36,
    });
  });

  it("tucks it into the bottom-right corner, clear of the price gutter", () => {
    expect(resetButtonRect(400, 300, padding, "bottom-right", 12, 36, 36)).toEqual({
      x: 284,
      y: 192,
      width: 36,
      height: 36,
    });
  });

  it("follows the measured size of a custom visual", () => {
    expect(resetButtonRect(400, 300, padding, "bottom-center", 0, 100, 20)).toEqual({
      x: 122,
      y: 220,
      width: 100,
      height: 20,
    });
  });
});

describe("isResetButtonHit", () => {
  const rect = { x: 154, y: 192, width: 36, height: 36 };

  it("accepts touches inside and on the edges of the rect", () => {
    expect(isResetButtonHit(160, 200, rect)).toBe(true);
    expect(isResetButtonHit(154, 192, rect)).toBe(true);
    expect(isResetButtonHit(190, 228, rect)).toBe(true);
  });

  it("rejects touches outside the rect and an unmeasured button", () => {
    expect(isResetButtonHit(153, 200, rect)).toBe(false);
    expect(isResetButtonHit(160, 229, rect)).toBe(false);
    expect(isResetButtonHit(160, 200, { ...rect, width: 0 })).toBe(false);
    expect(isResetButtonHit(160, 200, { ...rect, height: 0 })).toBe(false);
  });
});

describe("isViewOffFitted", () => {
  const all = [true, true, true, true] as const;

  it("is false on the fitted live view", () => {
    expect(isViewOffFitted(null, null, 1, false, ...all)).toBe(false);
    expect(isViewOffFitted(null, null, 1.0005, false, ...all)).toBe(false);
  });

  it("reports each manual state", () => {
    expect(isViewOffFitted(900, null, 1, false, ...all)).toBe(true);
    expect(isViewOffFitted(null, 45, 1, false, ...all)).toBe(true);
    expect(isViewOffFitted(null, null, 1.5, false, ...all)).toBe(true);
    expect(isViewOffFitted(null, null, 0.5, false, ...all)).toBe(true);
    expect(isViewOffFitted(null, null, 1, true, ...all)).toBe(true);
  });

  it("ignores states excluded by showFor", () => {
    expect(isViewOffFitted(900, null, 1, false, false, true, true, true)).toBe(false);
    expect(isViewOffFitted(null, 45, 1, false, true, false, true, true)).toBe(false);
    expect(isViewOffFitted(null, null, 2, false, true, true, false, true)).toBe(false);
    expect(isViewOffFitted(null, null, 1, true, true, true, true, false)).toBe(false);
    expect(isViewOffFitted(900, 45, 2, true, false, false, false, true)).toBe(true);
  });
});
