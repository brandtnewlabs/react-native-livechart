import { matchFont, useFont, type SkFont } from "@shopify/react-native-skia";
import { renderHook } from "@testing-library/react-native";

import { useChartSkiaFont } from "../../src/hooks/useChartSkiaFont";

/** Repo-root font; jest-expo’s asset transformer maps any `.ttf` to module id `1`. */
const googleSansCodeRegular = require("../../../../assets/fonts/GoogleSansCode-Regular.ttf");

describe("useChartSkiaFont", () => {
  const mockUseFont = jest.mocked(useFont);
  const mockMatchFont = jest.mocked(matchFont);

  beforeEach(() => {
    mockUseFont.mockClear();
    mockMatchFont.mockClear();
  });

  it("passes Metro require() module id and resolved fontSize to useFont", () => {
    const fontFromAsset = { tag: "from-useFont" } as unknown as SkFont;
    mockUseFont.mockReturnValue(fontFromAsset);

    /** Simulates `require('./Font.ttf')` — a numeric asset module id in RN / Metro. */
    const metroModuleId = 91011;

    const { result } = renderHook(() =>
      useChartSkiaFont({ typeface: metroModuleId, fontSize: 13 }, "Menlo", 11),
    );

    expect(mockUseFont).toHaveBeenCalledWith(metroModuleId, 13);
    expect(result.current).toBe(fontFromAsset);
  });

  it("forwards require(assets/fonts/GoogleSansCode-Regular.ttf) to useFont", () => {
    const fontFromAsset = { tag: "googleSansCode" } as unknown as SkFont;
    mockUseFont.mockReturnValue(fontFromAsset);

    const { result } = renderHook(() =>
      useChartSkiaFont(
        { typeface: googleSansCodeRegular, fontSize: 14 },
        "Menlo",
        11,
      ),
    );

    expect(mockUseFont).toHaveBeenCalledWith(googleSansCodeRegular, 14);
    expect(result.current).toBe(fontFromAsset);
  });

  it("calls useFont with null when typeface is omitted", () => {
    mockUseFont.mockReturnValue({} as SkFont);

    renderHook(() => useChartSkiaFont({ fontSize: 12 }, "Courier", 11));

    expect(mockUseFont).toHaveBeenCalledWith(null, 12);
  });

  it("falls back to matchFont when typeface is set but useFont is still null", () => {
    const fallback = { tag: "fallback" } as unknown as SkFont;
    mockUseFont.mockReturnValue(null as unknown as SkFont);
    mockMatchFont.mockReturnValue(fallback);

    const metroModuleId = 42;
    const { result } = renderHook(() =>
      useChartSkiaFont({ typeface: metroModuleId }, "Menlo", 11),
    );

    expect(mockUseFont).toHaveBeenCalledWith(metroModuleId, 11);
    expect(mockMatchFont).toHaveBeenCalled();
    expect(result.current).toBe(fallback);
  });
});
