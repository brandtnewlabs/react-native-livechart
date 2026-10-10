import type { SkFont } from "react-native-skia";
import {
  computeReferenceLineLayout,
  referenceBadgeRect,
} from "../../src/hooks/useReferenceLine";
import { axisBadgeBounds } from "../../src/math/axisBadgeLayout";
import type { ReferenceLine } from "../../src/types";

const font = {
  getSize: () => 12,
  measureText: (text: string) => ({
    x: 0,
    y: 0,
    width: text.length * 7,
    height: 12,
  }),
  getMetrics: () => ({ ascent: -9, descent: 3 }),
} as SkFont;
const padding = { top: 12, bottom: 28, left: 12, right: 80 };
const fmt = (v: number) => `$${v.toFixed(2)}`;
function layout(
  line: ReferenceLine,
  override?: number,
  axis?: Parameters<typeof axisBadgeBounds>[4],
) {
  return computeReferenceLineLayout(
    400,
    300,
    padding,
    line,
    fmt,
    font,
    0,
    100,
    0,
    30,
    override,
    undefined,
    undefined,
    0,
    font,
    font,
    axis,
  );
}

describe("reference value pills", () => {
  it("is opt-in and preserves the existing combined label", () => {
    const l = layout({
      value: 50,
      label: "Target",
      badge: true,
      showValue: true,
    });
    expect(l.valueBadge).toBeNull();
    expect(l.label).toBe("Target $50.00");
  });
  it("draws the connector between two pills and follows the UI drag override", () => {
    const line = { value: 50, label: "Target", badge: true, valueBadge: true };
    const l = layout(line, 75);
    expect(l.label).toBe("Target");
    expect(l.valueBadge?.text).toBe("$75.00");
    expect(l.y).toBe(77);
    expect(l.valueBadge!.y + l.valueBadge!.h / 2).toBe(l.y);
    expect(l.connStart).toBe(l.pillX + l.pillW + 4);
    expect(l.connEnd).toBe(l.valueBadge!.x - 4);
    expect(l.drawLine).toBe(false);
  });
  it("uses exactly the live badge's price-column bounds", () => {
    const l = layout({
      value: 50,
      badge: true,
      valueBadge: { position: "axis" },
    });
    const bounds = axisBadgeBounds(400, 80, 42, 12);
    expect(l.valueBadge!.x).toBe(bounds.left);
    expect(l.valueBadge!.x + l.valueBadge!.w).toBe(bounds.right);
    expect(l.valueBadge!.textX).toBe(bounds.textX);
  });
  it("aligns a floating price pill at the same canvas edge", () => {
    const axis = { float: true, offsetX: -3 };
    const l = layout(
      { value: 50, valueBadge: { position: "axis" } },
      undefined,
      axis,
    );
    const bounds = axisBadgeBounds(400, 80, 42, 12, axis);
    expect(l.valueBadge!.x).toBe(bounds.left);
    expect(l.valueBadge!.x + l.valueBadge!.w).toBe(bounds.right);
  });
  it("preserves showValue when a separate price pill is enabled", () => {
    const l = layout({
      value: 50,
      label: "Target",
      showValue: true,
      badge: true,
      valueBadge: true,
    });
    expect(l.label).toBe("Target $50.00");
    expect(l.valueBadge!.text).toBe("$50.00");
  });
  it.each(["right", "center"] as const)(
    "makes room for a %s name badge and matches its tap target",
    (position) => {
      const line = {
        value: 50,
        label: "Target",
        badge: { position, offsetX: 8 },
        valueBadge: true,
      };
      const l = layout(line);
      const target = referenceBadgeRect(l, font, line)!;
      expect(target.x + target.w + 8).toBeLessThanOrEqual(l.valueBadge!.x);
      expect(l.connEnd + 8).toBe(l.valueBadge!.x - 4);
    },
  );
  it.each([150, -50])("pins both pills together off-axis at %s", (value) => {
    const l = layout({ value, label: "Target", badge: true, valueBadge: true });
    expect(l.offAxis).toBe(true);
    expect(l.chevronUp).toBe(value > 100);
    expect(l.chevronCx).toBeGreaterThan(0);
    expect(l.valueBadge!.text).toBe(fmt(value));
    expect(l.valueBadge!.y + l.valueBadge!.h / 2).toBe(l.y);
  });
  it("supports a price-only pill without duplicating its plain label", () => {
    const l = layout({ value: 50, valueBadge: true });
    expect(l.badge).toBe(false);
    expect(l.label).toBe("");
    expect(l.valueBadge!.text).toBe("$50.00");
    const off = layout({ value: 150, valueBadge: true });
    expect(off.visible).toBe(true);
    expect(off.valueBadge!.chevronCx).toBeGreaterThan(0);
  });
  it("applies price-pill offsets to the geometry used by both drawing and taps", () => {
    const normal = layout({ value: 50, valueBadge: true }).valueBadge!;
    const moved = layout({
      value: 50,
      valueBadge: { offsetX: -9, offsetY: 7 },
    }).valueBadge!;
    expect(moved.x).toBe(normal.x - 9);
    expect(moved.y).toBe(normal.y + 7);
    expect(moved.textX).toBe(normal.textX - 9);
    expect(moved.textY).toBe(normal.textY + 7);
  });
  it("keeps fullWidth's stroke and disables the connector", () => {
    const l = layout({
      value: 50,
      badge: true,
      valueBadge: true,
      fullWidth: true,
    });
    expect(l.drawLine).toBe(true);
    expect(l.lineX1).toBe(0);
    expect(l.lineX2).toBe(400);
    expect(l.connStart).toBe(-1);
  });
  it.each([
    { series: [{ time: 0, value: 50 }] },
    { valueFrom: 30, valueTo: 70 },
    { from: -10, to: 0 },
  ])("does not add value pills to other reference forms: %j", (line) => {
    expect(layout({ ...line, valueBadge: true }).valueBadge).toBeNull();
  });
});


it("keeps an explicit plain label clear of the price connector", () => {
  const l = layout({ value: 50, label: "Target", valueBadge: true });
  expect(l.connStart).toBeGreaterThan(l.labelX + 6 * 7);
});

it("does not produce a badge or tap target in a collapsed plot", () => {
  const l = computeReferenceLineLayout(400, 20, padding,
    { value: 50, badge: true, valueBadge: true }, fmt, font, 0, 100, 0, 30);
  expect(l.visible).toBe(false);
  expect(l.valueBadge).toBeNull();
});

it("measures the value with its own font without moving the price-column anchor", () => {
  const bigFont = { ...font, getSize: () => 20,
    measureText: (s: string) => ({ width: s.length * 10 }),
    getMetrics: () => ({ ascent: -15, descent: 5 }) } as SkFont;
  const l = computeReferenceLineLayout(400, 300, padding,
    { value: 50, badge: true, valueBadge: { position: "axis", fontSize: 20 } },
    fmt, font, 0, 100, 0, 30, undefined, undefined, undefined, 0, font, bigFont, { fontSize: 12 });
  expect(l.valueBadge!.x).toBe(axisBadgeBounds(400, 80, 60, 12).left);
  expect(l.valueBadge!.h).toBe(26);
  expect(l.valueBadge!.y + l.valueBadge!.h / 2).toBe(l.y);
});
