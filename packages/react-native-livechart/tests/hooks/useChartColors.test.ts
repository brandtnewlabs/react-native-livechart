import { DEFAULT_PADDING } from "../../src/draw/line";
import { renderHook } from "@testing-library/react-native";
import { resolveTheme } from "../../src/theme";
import { useChartColors } from "../../src/hooks/useChartColors";

const palette = resolveTheme("#3b82f6", "dark");

describe("useChartColors", () => {
  it("derives backgroundColor from palette.bgRgb", () => {
    const { result } = renderHook(() =>
      useChartColors(palette, null, "#3b82f6", 300, DEFAULT_PADDING),
    );
    expect(result.current.backgroundColor).toMatch(/^rgb\(/);
  });

  it("computes gradientEnd from layoutHeight minus bottom inset", () => {
    const { result } = renderHook(() =>
      useChartColors(palette, null, "#3b82f6", 300, DEFAULT_PADDING),
    );
    // layoutHeight=300, padding.bottom=28 → max(1, 272)
    expect(result.current.gradientEnd).toBe(272);
  });

  it("falls back to palette.fillTop when no custom topOpacity", () => {
    const { result } = renderHook(() =>
      useChartColors(
        palette,
        {
          topOpacity: undefined,
          bottomOpacity: undefined,
          colors: undefined,
          positions: undefined,
        },
        "#3b82f6",
        300,
        DEFAULT_PADDING,
      ),
    );
    expect(result.current.gradientTopColor).toBe(palette.fillTop);
    expect(result.current.gradientBottomColor).toBe(palette.fillBottom);
  });

  it("applies custom topOpacity as rgba string", () => {
    const { result } = renderHook(() =>
      useChartColors(
        palette,
        {
          topOpacity: 0.5,
          bottomOpacity: undefined,
          colors: undefined,
          positions: undefined,
        },
        "#3b82f6",
        300,
        DEFAULT_PADDING,
      ),
    );
    expect(result.current.gradientTopColor).toMatch(/^rgba\(.*0\.5\)$/);
    expect(result.current.gradientBottomColor).toBe(palette.fillBottom);
  });

  it("applies custom bottomOpacity as rgba string", () => {
    const { result } = renderHook(() =>
      useChartColors(
        palette,
        {
          topOpacity: undefined,
          bottomOpacity: 0.05,
          colors: undefined,
          positions: undefined,
        },
        "#3b82f6",
        300,
        DEFAULT_PADDING,
      ),
    );
    expect(result.current.gradientTopColor).toBe(palette.fillTop);
    expect(result.current.gradientBottomColor).toMatch(/^rgba\(.*0\.05\)$/);
  });

  it("clamps gradientEnd to 1 when layoutHeight equals bottom inset", () => {
    const { result } = renderHook(() =>
      useChartColors(palette, null, "#3b82f6", 0, DEFAULT_PADDING),
    );
    expect(result.current.gradientEnd).toBe(1);
  });

  it("falls back to a 2-stop gradient array when no custom colors", () => {
    const { result } = renderHook(() =>
      useChartColors(palette, null, "#3b82f6", 300, DEFAULT_PADDING),
    );
    expect(result.current.gradientColors).toEqual([
      result.current.gradientTopColor,
      result.current.gradientBottomColor,
    ]);
    expect(result.current.gradientPositions).toBeUndefined();
  });

  it("uses custom multi-color stops when colors has ≥2 entries", () => {
    const colors = ["rgba(51,35,230,0.45)", "rgba(168,85,247,0.25)", "rgba(0,0,0,0)"];
    const { result } = renderHook(() =>
      useChartColors(
        palette,
        {
          topOpacity: undefined,
          bottomOpacity: undefined,
          colors,
          positions: undefined,
        },
        "#3b82f6",
        300,
        DEFAULT_PADDING,
      ),
    );
    expect(result.current.gradientColors).toBe(colors);
    expect(result.current.gradientPositions).toBeUndefined();
  });

  it("ignores a single-entry colors array (falls back to 2-stop)", () => {
    const { result } = renderHook(() =>
      useChartColors(
        palette,
        {
          topOpacity: undefined,
          bottomOpacity: undefined,
          colors: ["rgba(51,35,230,0.45)"],
          positions: undefined,
        },
        "#3b82f6",
        300,
        DEFAULT_PADDING,
      ),
    );
    expect(result.current.gradientColors).toEqual([
      result.current.gradientTopColor,
      result.current.gradientBottomColor,
    ]);
  });

  it("keeps positions when their length matches colors", () => {
    const colors = ["#fff", "#000"];
    const positions = [0, 1];
    const { result } = renderHook(() =>
      useChartColors(
        palette,
        {
          topOpacity: undefined,
          bottomOpacity: undefined,
          colors,
          positions,
        },
        "#3b82f6",
        300,
        DEFAULT_PADDING,
      ),
    );
    expect(result.current.gradientColors).toBe(colors);
    expect(result.current.gradientPositions).toBe(positions);
  });

  it("drops positions when their length does not match colors", () => {
    const { result } = renderHook(() =>
      useChartColors(
        palette,
        {
          topOpacity: undefined,
          bottomOpacity: undefined,
          colors: ["#fff", "#888", "#000"],
          positions: [0, 1],
        },
        "#3b82f6",
        300,
        DEFAULT_PADDING,
      ),
    );
    expect(result.current.gradientPositions).toBeUndefined();
  });
});
