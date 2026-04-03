import { resolveChartLayout } from './useChartLayout'
import { resolveTheme } from '../theme'
import type { SkFont } from '@shopify/react-native-skia'

const palette = resolveTheme('#3b82f6', 'dark')

const mockFont = (charWidth = 7): SkFont =>
  ({
    getTextWidth: (text: string) => text.length * charWidth,
    getSize: () => 12,
  }) as unknown as SkFont

const fmt = (v: number) => v.toFixed(2)

describe('resolveChartLayout', () => {
  // ─── strokeWidth ─────────────────────────────────────────────────

  it('uses palette lineWidth when no override', () => {
    const { strokeWidth } = resolveChartLayout({
      palette,
      grid: false,
      badge: false,
    })
    expect(strokeWidth).toBe(palette.lineWidth)
  })

  it('overrides lineWidth with prop', () => {
    const { strokeWidth } = resolveChartLayout({
      palette,
      lineWidthOverride: 4,
      grid: false,
      badge: false,
    })
    expect(strokeWidth).toBe(4)
  })

  // ─── static padding (no font) ───────────────────────────────────

  it('uses default padding when no features and no font', () => {
    const { padding } = resolveChartLayout({
      palette,
      grid: false,
      badge: false,
    })
    expect(padding).toEqual({ top: 12, right: 12, bottom: 28, left: 12 })
  })

  it('expands right padding for grid (static fallback)', () => {
    const { padding } = resolveChartLayout({
      palette,
      grid: true,
      badge: false,
    })
    expect(padding.right).toBe(44)
  })

  it('expands right padding for badge (static fallback)', () => {
    const { padding } = resolveChartLayout({
      palette,
      grid: false,
      badge: true,
    })
    expect(padding.right).toBe(64)
  })

  it('badge takes precedence over grid (static fallback)', () => {
    const { padding } = resolveChartLayout({
      palette,
      grid: true,
      badge: true,
    })
    expect(padding.right).toBe(64)
  })

  it('respects explicit padding override over everything', () => {
    const { padding } = resolveChartLayout({
      palette,
      paddingOverride: { right: 100 },
      grid: true,
      badge: true,
      font: mockFont(),
      formatValue: fmt,
      currentValue: 42,
    })
    expect(padding.right).toBe(100)
    expect(padding.top).toBe(12)
  })

  // ─── dynamic padding (with font) ────────────────────────────────

  it('auto-sizes right padding from formatted value width (grid)', () => {
    const font = mockFont(7)
    const { padding } = resolveChartLayout({
      palette,
      grid: true,
      badge: false,
      font,
      formatValue: fmt,
      currentValue: 42,
    })
    // max(fmt(42)="42.00"=5ch, fmt(4.2)="4.20"=4ch) → 5*7=35 + 16 = 51
    // min for grid = 42, so max(51, 42) = 51
    expect(padding.right).toBe(51)
  })

  it('auto-sizes right padding from formatted value width (badge)', () => {
    const font = mockFont(7)
    const { padding } = resolveChartLayout({
      palette,
      grid: true,
      badge: true,
      font,
      formatValue: fmt,
      currentValue: 42,
    })
    // max(fmt(42)="42.00"=5ch, fmt(4.2)="4.20"=4ch) → 5*7=35 + 38 = 73
    // min for badge = 60, so max(73, 60) = 73
    expect(padding.right).toBe(73)
  })

  it('enforces minimum right padding for badge even with short labels', () => {
    const font = mockFont(7)
    const { padding } = resolveChartLayout({
      palette,
      grid: false,
      badge: true,
      font,
      formatValue: () => '1',
      currentValue: 1,
    })
    // max("1"=1ch, "1"=1ch) → 1*7=7 + 38 = 45
    // min for badge = 60, so max(45, 60) = 60
    expect(padding.right).toBe(60)
  })

  it('grows right padding for wide labels (small decimals)', () => {
    const font = mockFont(7)
    const { padding } = resolveChartLayout({
      palette,
      grid: true,
      badge: true,
      font,
      formatValue: (v) => v.toPrecision(4),
      currentValue: 0.001234,
    })
    // max(toPrecision(4)(0.001234)="0.001234"=8ch, toPrecision(4)(0.0001234)="0.0001234"=9ch) → 9*7=63 + 38 = 101
    // min for badge = 60, so max(101, 60) = 101
    expect(padding.right).toBe(101)
  })

  it('falls back to static when font is missing', () => {
    const { padding } = resolveChartLayout({
      palette,
      grid: true,
      badge: true,
      formatValue: fmt,
      currentValue: 42,
    })
    expect(padding.right).toBe(64)
  })

  it('falls back to static when formatValue is missing', () => {
    const { padding } = resolveChartLayout({
      palette,
      grid: true,
      badge: true,
      font: mockFont(),
      currentValue: 42,
    })
    expect(padding.right).toBe(64)
  })

  it('falls back to static when currentValue is missing', () => {
    const { padding } = resolveChartLayout({
      palette,
      grid: true,
      badge: true,
      font: mockFont(),
      formatValue: fmt,
    })
    expect(padding.right).toBe(64)
  })
})
