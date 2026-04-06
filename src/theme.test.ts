import {
  SERIES_COLORS,
  leftEdgeFadeColorsFromBgRgb,
  parseColorRgb,
  resolveSeriesPalettes,
  resolveTheme,
} from "./theme";

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
    expect(p.bgRgb).toEqual([10, 10, 10]);
    expect(p.gridLine).toMatch(/^rgba\(/);
    expect(p.tooltipText).toBe("#e5e5e5");
  });

  it("builds light palette", () => {
    const p = resolveTheme("#00ff00", "light");
    expect(p.bgRgb).toEqual([255, 255, 255]);
    expect(p.gridLine).toMatch(/^rgba\(/);
    expect(p.tooltipText).toBe("#171717");
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
