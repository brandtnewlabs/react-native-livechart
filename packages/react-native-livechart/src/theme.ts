import type { LiveChartPalette, SeriesConfig, ThemeMode } from "./types";

/**
 * Derives a full light/dark palette from one accent color — same idea as liveline’s
 * theme system, implemented with static Tailwind-like hex literals (no CSS).
 *
 * @see https://github.com/benjitaylor/liveline
 */

/**
 * Tailwind CSS v3 default palette — literal hex only (no tailwindcss dependency).
 * Values match https://tailwindcss.com/docs/customizing-colors
 */
const TW = {
  white: "#ffffff",
  black: "#000000",
  neutral: {
    /** neutral-200 */
    200: "#e5e5e5",
    /** neutral-900 */
    900: "#171717",
    /** neutral-950 */
    950: "#0a0a0a",
  },
  zinc: {
    /** zinc-900 */
    900: "#18181b",
    /** zinc-950 */
    950: "#09090b",
  },
  green: {
    /** green-500 */
    500: "#22c55e",
    /** green-600 */
    600: "#16a34a",
  },
  red: {
    /** red-500 */
    500: "#ef4444",
    /** red-600 */
    600: "#dc2626",
  },
  blue: {
    /** blue-500 */
    500: "#3b82f6",
  },
  amber: {
    /** amber-500 */
    500: "#f59e0b",
  },
  violet: {
    /** violet-500 */
    500: "#8b5cf6",
  },
  pink: {
    /** pink-500 */
    500: "#ec4899",
  },
  cyan: {
    /** cyan-500 */
    500: "#06b6d4",
  },
  orange: {
    /** orange-500 */
    500: "#f97316",
  },
} as const;

/** Parse a CSS color string to [r, g, b]. Supports `#rgb`, `#rrggbb`, `rgb()`, and `rgba()`. */
export function parseColorRgb(color: string): [number, number, number] {
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgb = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  return [128, 128, 128];
}

function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Default left-edge fade gradient stops for `dstOut` blending: same RGB as the chart
 * background (`palette.bgRgb`), opacity 1 → 0. Matches the container `backgroundColor`.
 */
export function leftEdgeFadeColorsFromBgRgb(bgRgb: [number, number, number]): {
  startColor: string;
  endColor: string;
} {
  const [r, g, b] = bgRgb;
  return {
    startColor: rgba(r, g, b, 1),
    endColor: rgba(r, g, b, 0),
  };
}

function twAlpha(hex: string, a: number): string {
  const [r, g, b] = parseColorRgb(hex);
  return rgba(r, g, b, a);
}

/**
 * Derive a full palette from a single accent color + theme mode.
 * Momentum colors are always semantic green/red regardless of accent.
 */
export function resolveTheme(color: string, mode: ThemeMode): LiveChartPalette {
  const [r, g, b] = parseColorRgb(color);
  const isDark = mode === "dark";
  const [g5r, g5g, g5b] = parseColorRgb(TW.green[500]);
  const [g6r, g6g, g6b] = parseColorRgb(TW.green[600]);
  const [r5r, r5g, r5b] = parseColorRgb(TW.red[500]);
  const [r6r, r6g, r6b] = parseColorRgb(TW.red[600]);

  return {
    line: color,
    lineWidth: 2,

    fillTop: rgba(r, g, b, isDark ? 0.12 : 0.08),
    fillBottom: rgba(r, g, b, 0),

    // white/6, black/6 (Tailwind opacity on base)
    gridLine: isDark ? twAlpha(TW.white, 0.06) : twAlpha(TW.black, 0.06),
    gridLabel: isDark ? twAlpha(TW.white, 0.4) : twAlpha(TW.black, 0.35),

    dotUp: TW.green[500],
    dotDown: TW.red[500],
    dotFlat: color,
    glowUp: twAlpha(TW.green[500], 0.18),
    glowDown: twAlpha(TW.red[500], 0.18),
    glowFlat: rgba(r, g, b, 0.12),

    badgeOuterBg: isDark
      ? twAlpha(TW.zinc[900], 0.95)
      : twAlpha(TW.white, 0.95),
    badgeOuterShadow: isDark ? twAlpha(TW.black, 0.4) : twAlpha(TW.black, 0.15),
    badgeBg: color,
    badgeText: TW.white,

    candleUp: TW.green[500],
    candleDown: TW.red[500],
    wickUp: isDark ? rgba(g5r, g5g, g5b, 0.7) : rgba(g6r, g6g, g6b, 0.8),
    wickDown: isDark ? rgba(r5r, r5g, r5b, 0.7) : rgba(r6r, r6g, r6b, 0.8),

    dashLine: rgba(r, g, b, 0.4),

    refLine: isDark ? twAlpha(TW.white, 0.15) : twAlpha(TW.black, 0.12),
    refLabel: isDark ? twAlpha(TW.white, 0.45) : twAlpha(TW.black, 0.4),

    timeLabel: isDark ? twAlpha(TW.white, 0.35) : twAlpha(TW.black, 0.3),

    crosshairLine: isDark ? twAlpha(TW.white, 0.2) : twAlpha(TW.black, 0.12),
    crosshairDim: twAlpha(TW.black, 0.12),
    tooltipBg: isDark ? twAlpha(TW.zinc[950], 0.95) : twAlpha(TW.white, 0.95),
    tooltipText: isDark ? TW.neutral[200] : TW.neutral[900],
    tooltipBorder: isDark ? twAlpha(TW.white, 0.1) : twAlpha(TW.black, 0.08),

    bgRgb: isDark
      ? (parseColorRgb(TW.neutral[950]) as [number, number, number])
      : (parseColorRgb(TW.white) as [number, number, number]),

    labelFontSize: 11,
    valueFontSize: 11,
    badgeFontSize: 11,
  };
}

/**
 * Merge caller palette overrides on top of a derived palette. Only the keys
 * present on `override` are replaced; everything else keeps the derived value.
 * Returns the original palette unchanged when no override is supplied.
 */
export function applyPaletteOverride(
  palette: LiveChartPalette,
  override: Partial<LiveChartPalette> | undefined,
): LiveChartPalette {
  if (!override) return palette;
  return { ...palette, ...override };
}

/**
 * Default multi-series line colors — Tailwind 500 scale, order: blue, red, green,
 * amber, violet, pink, cyan, orange.
 */
export const SERIES_COLORS = [
  TW.blue[500],
  TW.red[500],
  TW.green[500],
  TW.amber[500],
  TW.violet[500],
  TW.pink[500],
  TW.cyan[500],
  TW.orange[500],
];

/** Derive per-series palettes from series definitions. */
export function resolveSeriesPalettes(
  series: SeriesConfig[],
  mode: ThemeMode,
): Map<string, LiveChartPalette> {
  const map = new Map<string, LiveChartPalette>();
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const color =
      s.color != null && s.color !== ""
        ? s.color
        : SERIES_COLORS[i % SERIES_COLORS.length];
    map.set(s.id, resolveTheme(color, mode));
  }
  return map;
}
