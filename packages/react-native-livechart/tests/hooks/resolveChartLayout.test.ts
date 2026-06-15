import {
  minPaddingRightForYAxisWithPulse,
  pulseRadialOutset,
} from "../../src/draw/line";

import type { SkFont } from "@shopify/react-native-skia";
import { resolveTheme } from "../../src/theme";
import { resolveChartLayout } from "../../src/hooks/resolveChartLayout";

const palette = resolveTheme("#3b82f6", "dark");

const mockFont = (charWidth = 7): SkFont =>
  ({
    getSize: () => 12,
    measureText: (text: string) => ({
      x: 0,
      y: 0,
      width: text.length * charWidth,
      height: 12,
    }),
  }) as unknown as SkFont;

const fmt = (v: number) => v.toFixed(2);

describe("resolveChartLayout", () => {
  // ─── strokeWidth ─────────────────────────────────────────────────

  it("uses palette lineWidth when no override", () => {
    const { strokeWidth } = resolveChartLayout({
      palette,
      yAxis: false,
      badge: false,
    });
    expect(strokeWidth).toBe(palette.lineWidth);
  });

  it("overrides lineWidth with prop", () => {
    const { strokeWidth } = resolveChartLayout({
      palette,
      lineWidthOverride: 4,
      yAxis: false,
      badge: false,
    });
    expect(strokeWidth).toBe(4);
  });

  // ─── static padding (no font) ───────────────────────────────────

  it("uses default padding when no features and no font", () => {
    const { padding } = resolveChartLayout({
      palette,
      yAxis: false,
      badge: false,
    });
    expect(padding).toEqual({ top: 12, right: 12, bottom: 28, left: 12 });
  });

  it("expands right padding for grid (static fallback)", () => {
    const { padding } = resolveChartLayout({
      palette,
      yAxis: true,
      badge: false,
    });
    expect(padding.right).toBe(44);
  });

  it("expands right padding for badge (static fallback)", () => {
    const { padding } = resolveChartLayout({
      palette,
      yAxis: false,
      badge: true,
    });
    // minPaddingRightForBadgeYAxisAlign(12, 49) = 12 + 14 + 20 + 49 + 4 = 99
    expect(padding.right).toBe(99);
  });

  it("badge takes precedence over grid (static fallback)", () => {
    const { padding } = resolveChartLayout({
      palette,
      yAxis: true,
      badge: true,
    });
    expect(padding.right).toBe(99);
  });

  it("respects explicit padding override over everything", () => {
    const { padding } = resolveChartLayout({
      palette,
      insetsOverride: { right: 100 },
      yAxis: true,
      badge: true,
      font: mockFont(),
      formatValue: fmt,
      currentValue: 42,
    });
    expect(padding.right).toBe(100);
    expect(padding.top).toBe(12);
  });

  // ─── dynamic padding (with font) ────────────────────────────────

  it("auto-sizes right padding from formatted value width (grid)", () => {
    const font = mockFont(7);
    const { padding } = resolveChartLayout({
      palette,
      yAxis: true,
      badge: false,
      font,
      formatValue: fmt,
      currentValue: 42,
    });
    // samples: "42.00"(5ch), "4.20"(4ch), "0.42"(4ch), "420.00"(6ch) → max 6ch×7=42px
    // yAxis: max(42+16, 44) = 58
    expect(padding.right).toBe(58);
  });

  it("uses minimal right padding when y-axis and badge are off (font path)", () => {
    const font = mockFont(7);
    const { padding } = resolveChartLayout({
      palette,
      yAxis: false,
      badge: false,
      font,
      formatValue: fmt,
      currentValue: 42,
    });
    expect(padding.right).toBe(12);
  });

  it("expands top/right/bottom for live dot pulse when y-axis and badge are off", () => {
    const font = mockFont(7);
    const { padding } = resolveChartLayout({
      palette,
      yAxis: false,
      badge: false,
      font,
      formatValue: fmt,
      currentValue: 42,
      pulse: { maxRadius: 21, strokeWidth: 1.5 },
    });
    const outlet = pulseRadialOutset(21, 1.5);
    expect(padding.right).toBe(outlet);
    expect(padding.top).toBe(outlet);
    expect(padding.bottom).toBe(28);
    expect(padding.left).toBe(12);
  });

  it("lets an explicit inset win over the pulse outlet floor, even when tighter (#128)", () => {
    // The caller opts into clipping the ring in exchange for full control of the
    // padding. Every side is set, so none gets floored up to the outlet.
    const { padding } = resolveChartLayout({
      palette,
      yAxis: false,
      badge: false,
      insetsOverride: { right: 6, top: 6, bottom: 6, left: 6 },
      pulse: { maxRadius: 20, strokeWidth: 2 },
    });
    expect(padding).toEqual({ right: 6, top: 6, bottom: 6, left: 6 });
  });

  it("reclaims bottom space when x-axis is hidden and bottom inset is 0 with pulse on (#128)", () => {
    const { padding } = resolveChartLayout({
      palette,
      yAxis: false,
      badge: false,
      xAxis: false,
      insetsOverride: { bottom: 0 },
      pulse: { maxRadius: 21, strokeWidth: 1.5 },
    });
    expect(padding.bottom).toBe(0);
  });

  it("still floors only the sides without an explicit inset (per-side, #128)", () => {
    const outlet = pulseRadialOutset(21, 1.5);
    const { padding } = resolveChartLayout({
      palette,
      yAxis: false,
      badge: false,
      insetsOverride: { bottom: 0 }, // only bottom is explicit
      pulse: { maxRadius: 21, strokeWidth: 1.5 },
    });
    expect(padding.bottom).toBe(0); // explicit → wins
    expect(padding.top).toBe(outlet); // unset → still floored to the ring
    expect(padding.right).toBe(outlet); // unset → still floored to the ring
  });

  it("auto-sizes right padding from formatted value width (badge)", () => {
    const font = mockFont(7);
    const { padding } = resolveChartLayout({
      palette,
      yAxis: true,
      badge: true,
      font,
      formatValue: fmt,
      currentValue: 42,
    });
    // samples: "42.00"(5ch), "4.20"(4ch), "0.42"(4ch), "420.00"(6ch) → max 6ch×7=42px
    // badge: 12 + 14 + 20 + 42 + 4 = 92
    expect(padding.right).toBe(92);
  });

  it("enforces minimum right padding for badge even with short labels", () => {
    const font = mockFont(7);
    const { padding } = resolveChartLayout({
      palette,
      yAxis: false,
      badge: true,
      font,
      formatValue: () => "1",
      currentValue: 1,
    });
    // all samples format to "1" → 1ch×7=7px → 12 + 14 + 20 + 7 + 4 = 57
    expect(padding.right).toBe(57);
  });

  it("grows right padding for wide labels (small decimals)", () => {
    const font = mockFont(7);
    const { padding } = resolveChartLayout({
      palette,
      yAxis: true,
      badge: true,
      font,
      formatValue: (v) => v.toPrecision(4),
      currentValue: 0.001234,
    });
    // samples via toPrecision(4): v/100=0.00001234→"0.00001234"(10ch) is widest → 10×7=70px
    // badge: 12 + 14 + 20 + 70 + 4 = 120
    expect(padding.right).toBe(120);
  });

  it("falls back to static when font is missing", () => {
    const { padding } = resolveChartLayout({
      palette,
      yAxis: true,
      badge: true,
      formatValue: fmt,
      currentValue: 42,
    });
    expect(padding.right).toBe(99);
  });

  it("falls back to static when formatValue is missing", () => {
    const { padding } = resolveChartLayout({
      palette,
      yAxis: true,
      badge: true,
      font: mockFont(),
      currentValue: 42,
    });
    expect(padding.right).toBe(99);
  });

  it("falls back to static when currentValue is missing", () => {
    const { padding } = resolveChartLayout({
      palette,
      yAxis: true,
      badge: true,
      font: mockFont(),
      formatValue: fmt,
    });
    expect(padding.right).toBe(99);
  });

  // ─── badge left of dot (no right gutter, no extra left inset) ─────────────

  it("does not inflate left padding when badge uses right gutter disabled", () => {
    const font = mockFont(7);
    const { padding } = resolveChartLayout({
      palette,
      yAxis: false,
      badge: true,
      badgeUsesRightGutter: false,
      font,
      formatValue: fmt,
      currentValue: 42,
    });
    expect(padding.right).toBe(12);
    expect(padding.left).toBe(12);
  });

  it("sizes right padding like grid-only when badge is on but not in right gutter", () => {
    const font = mockFont(7);
    const { padding } = resolveChartLayout({
      palette,
      yAxis: true,
      badge: true,
      badgeUsesRightGutter: false,
      font,
      formatValue: fmt,
      currentValue: 42,
    });
    expect(padding.right).toBe(58);
    expect(padding.left).toBe(12);
  });

  it("widens right padding when y-axis and pulse so the ring clears centered labels", () => {
    const font = mockFont(7);
    const pulse = { maxRadius: 21, strokeWidth: 1.5 };
    const outlet = pulseRadialOutset(pulse.maxRadius, pulse.strokeWidth);
    // Same grid width as "grid-only" without pulse (58) but pulse needs more gutter.
    const { padding } = resolveChartLayout({
      palette,
      yAxis: true,
      badge: true,
      badgeUsesRightGutter: false,
      font,
      formatValue: fmt,
      currentValue: 42,
      pulse,
    });
    const tw = 6 * 7; // widest sample "420.00"
    expect(padding.right).toBe(minPaddingRightForYAxisWithPulse(outlet, tw));
  });

  it("y-axis + pulse without font uses fallback label width for gutter math", () => {
    const pulse = { maxRadius: 21, strokeWidth: 1.5 };
    const outlet = pulseRadialOutset(pulse.maxRadius, pulse.strokeWidth);
    const { padding } = resolveChartLayout({
      palette,
      yAxis: true,
      badge: false,
      pulse,
    });
    expect(padding.right).toBe(minPaddingRightForYAxisWithPulse(outlet, 49));
  });

  it("respects explicit insetsOverride.left when badge omits right gutter", () => {
    const { padding } = resolveChartLayout({
      palette,
      insetsOverride: { left: 80 },
      yAxis: false,
      badge: true,
      badgeUsesRightGutter: false,
    });
    expect(padding.left).toBe(80);
  });

  // ─── badgeShowTail ─────────────────────────────────────────────────

  it("shrinks right padding when badgeShowTail is false (static fallback)", () => {
    const withTail = resolveChartLayout({
      palette,
      yAxis: false,
      badge: true,
    });
    const noTail = resolveChartLayout({
      palette,
      yAxis: false,
      badge: true,
      badgeShowTail: false,
    });
    expect(noTail.padding.right).toBeLessThan(withTail.padding.right);
    expect(withTail.padding.right - noTail.padding.right).toBe(5);
  });

  it("shrinks right padding when badgeShowTail is false (font path)", () => {
    const font = mockFont(7);
    const withTail = resolveChartLayout({
      palette,
      yAxis: true,
      badge: true,
      font,
      formatValue: fmt,
      currentValue: 42,
    });
    const noTail = resolveChartLayout({
      palette,
      yAxis: true,
      badge: true,
      badgeShowTail: false,
      font,
      formatValue: fmt,
      currentValue: 42,
    });
    expect(noTail.padding.right).toBeLessThan(withTail.padding.right);
    expect(withTail.padding.right - noTail.padding.right).toBe(5);
  });

  it("badgeShowTail defaults to true when omitted", () => {
    const explicit = resolveChartLayout({
      palette,
      yAxis: false,
      badge: true,
      badgeShowTail: true,
    });
    const implicit = resolveChartLayout({
      palette,
      yAxis: false,
      badge: true,
    });
    expect(explicit.padding.right).toBe(implicit.padding.right);
  });
});
