import type { SkFont } from "@shopify/react-native-skia";
import { resolveChartLayout } from "./resolveChartLayout";
import { resolveTheme } from "../theme";

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

  // ─── left badge ──────────────────────────────────────────────────────────

  it("auto-sizes left padding when badgeOnLeft and font are provided", () => {
    const font = mockFont(7);
    const { padding } = resolveChartLayout({
      palette,
      yAxis: false,
      badge: true,
      badgeOnLeft: true,
      font,
      formatValue: fmt,
      currentValue: 42,
    });
    // Right should shrink to default (badge not on right, no grid)
    expect(padding.right).toBe(12);
    // Left should be auto-sized to fit the badge
    expect(padding.left).toBeGreaterThan(12);
  });

  it("respects explicit insetsOverride.left", () => {
    const { padding } = resolveChartLayout({
      palette,
      insetsOverride: { left: 80 },
      yAxis: false,
      badge: true,
      badgeOnLeft: true,
    });
    expect(padding.left).toBe(80);
  });
});
