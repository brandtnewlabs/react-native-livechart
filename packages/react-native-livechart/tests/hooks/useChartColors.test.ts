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
        { topOpacity: undefined, bottomOpacity: undefined },
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
        { topOpacity: 0.5, bottomOpacity: undefined },
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
        { topOpacity: undefined, bottomOpacity: 0.05 },
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
});
