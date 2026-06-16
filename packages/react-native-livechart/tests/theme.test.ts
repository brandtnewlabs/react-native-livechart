import {
  SERIES_COLORS,
  applyPaletteOverride,
  leftEdgeFadeColorsFromBgRgb,
  parseColorRgb,
  parseColorRgba,
  resolveSeriesPalettes,
  resolveTheme,
} from "../src/theme";

describe("applyPaletteOverride", () => {
  it("returns the original palette when no override is given", () => {
    const base = resolveTheme("#3b82f6", "dark");
    expect(applyPaletteOverride(base, undefined)).toBe(base);
  });

  it("replaces only the overridden keys", () => {
    const base = resolveTheme("#3b82f6", "dark");
    const merged = applyPaletteOverride(base, {
      gridLine: "#123456",
      refLine: "#abcdef",
    });
    expect(merged.gridLine).toBe("#123456");
    expect(merged.refLine).toBe("#abcdef");
    expect(merged.line).toBe(base.line);
  });
});

describe("parseColorRgb", () => {
  it("parses 6-digit hex", () => {
    expect(parseColorRgb("#3b82f6")).toEqual([59, 130, 246]);
  });

  it("expands 3-digit hex", () => {
    expect(parseColorRgb("#abc")).toEqual([170, 187, 204]);
  });

  it("parses rgb()", () => {
    expect(parseColorRgb("rgb(1, 2, 3)")).toEqual([1, 2, 3]);
  });

  it("parses rgba()", () => {
    expect(parseColorRgb("rgba(10, 20, 30, 0.5)")).toEqual([10, 20, 30]);
  });

  it("falls back for unknown strings", () => {
    expect(parseColorRgb("not-a-color")).toEqual([128, 128, 128]);
  });
});

describe("parseColorRgba", () => {
  it("extracts the alpha from rgba()", () => {
    expect(parseColorRgba("rgba(10, 20, 30, 0.5)")).toEqual([10, 20, 30, 0.5]);
  });

  it("defaults alpha to 1 for rgb()", () => {
    expect(parseColorRgba("rgb(1, 2, 3)")).toEqual([1, 2, 3, 1]);
  });

  it("defaults alpha to 1 for hex", () => {
    expect(parseColorRgba("#3b82f6")).toEqual([59, 130, 246, 1]);
  });
});

describe("leftEdgeFadeColorsFromBgRgb", () => {
  it("matches background rgb with alpha ramp", () => {
    expect(leftEdgeFadeColorsFromBgRgb([10, 20, 30])).toEqual({
      startColor: "rgba(10, 20, 30, 1)",
      endColor: "rgba(10, 20, 30, 0)",
    });
  });
});

describe("resolveTheme", () => {
  it("builds dark palette", () => {
    const p = resolveTheme("#ff0000", "dark");
    expect(p.line).toBe("#ff0000");
    expect(p.bgRgb).toEqual([9, 9, 11]);
    expect(p.gridLine).toMatch(/^rgba\(/);
    expect(p.tooltipText).toBe("#e4e4e7");
  });

  it("builds light palette", () => {
    const p = resolveTheme("#00ff00", "light");
    expect(p.bgRgb).toEqual([250, 250, 250]);
    expect(p.gridLine).toMatch(/^rgba\(/);
    expect(p.tooltipText).toBe("#18181b");
  });
});

describe("resolveSeriesPalettes", () => {
  it("uses explicit series colors", () => {
    const m = resolveSeriesPalettes(
      [{ id: "a", data: [], value: 0, color: "#111111" }],
      "dark",
    );
    expect(m.get("a")?.line).toBe("#111111");
  });

  it("falls back to SERIES_COLORS by index", () => {
    const m = resolveSeriesPalettes(
      [{ id: "x", data: [], value: 0, color: "" }],
      "dark",
    );
    expect(m.get("x")?.line).toBe(SERIES_COLORS[0]);
  });

  it("cycles SERIES_COLORS with modulo", () => {
    const series = Array.from({ length: SERIES_COLORS.length + 1 }, (_, i) => ({
      id: `s${i}`,
      data: [],
      value: 0,
      color: "",
    }));
    const m = resolveSeriesPalettes(series, "light");
    expect(m.get(`s${SERIES_COLORS.length}`)?.line).toBe(SERIES_COLORS[0]);
  });
});
