import {
  matchFont,
  useFont,
  type SkFont,
  type SkFontMgr,
} from "@shopify/react-native-skia";
import { renderHook } from "@testing-library/react-native";

import { useChartSkiaFont } from "../../src/hooks/useChartSkiaFont";
import type { FontConfig } from "../../src/types";

/** Repo-root font; jest-expo’s asset transformer maps any `.ttf` to module id `1`. */
const googleSansCodeRegular = require("../../../../assets/fonts/GoogleSansCode-Regular.ttf");

describe("useChartSkiaFont", () => {
  const mockUseFont = jest.mocked(useFont);
  const mockMatchFont = jest.mocked(matchFont);

  beforeEach(() => {
    mockUseFont.mockReset().mockReturnValue(null);
    // A new object per match makes redundant native font allocations observable.
    mockMatchFont.mockReset().mockImplementation(() => ({}) as SkFont);
  });

  it("passes Metro require() module id and resolved fontSize to useFont", async () => {
    const fontFromAsset = { tag: "from-useFont" } as unknown as SkFont;
    mockUseFont.mockReturnValue(fontFromAsset);

    /** Simulates `require('./Font.ttf')` — a numeric asset module id in RN / Metro. */
    const metroModuleId = 91011;

    const { result } = await renderHook(() =>
      useChartSkiaFont({ typeface: metroModuleId, fontSize: 13 }, "Menlo", 11),
    );

    expect(mockUseFont).toHaveBeenCalledWith(metroModuleId, 13);
    expect(result.current).toBe(fontFromAsset);
  });

  it("forwards require(assets/fonts/GoogleSansCode-Regular.ttf) to useFont", async () => {
    const fontFromAsset = { tag: "googleSansCode" } as unknown as SkFont;
    mockUseFont.mockReturnValue(fontFromAsset);

    const { result } = await renderHook(() =>
      useChartSkiaFont(
        { typeface: googleSansCodeRegular, fontSize: 14 },
        "Menlo",
        11,
      ),
    );

    expect(mockUseFont).toHaveBeenCalledWith(googleSansCodeRegular, 14);
    expect(result.current).toBe(fontFromAsset);
  });

  it("calls useFont with null when typeface is omitted", async () => {
    mockUseFont.mockReturnValue({} as SkFont);

    await renderHook(() => useChartSkiaFont({ fontSize: 12 }, "Courier", 11));

    expect(mockUseFont).toHaveBeenCalledWith(null, 12);
  });

  it("falls back to matchFont when typeface is set but useFont is still null", async () => {
    const fallback = { tag: "fallback" } as unknown as SkFont;
    mockUseFont.mockReturnValue(null as unknown as SkFont);
    mockMatchFont.mockReturnValue(fallback);

    const metroModuleId = 42;
    const { result } = await renderHook(() =>
      useChartSkiaFont({ typeface: metroModuleId }, "Menlo", 11),
    );

    expect(mockUseFont).toHaveBeenCalledWith(metroModuleId, 11);
    expect(mockMatchFont).toHaveBeenCalled();
    expect(result.current).toBe(fallback);
  });

  it("reuses a custom-manager font across equivalent prop objects", async () => {
    const fontManager = {} as SkFontMgr;
    const font: FontConfig = {
      fontManager,
      fontFamily: "Custom",
      fontSize: 13,
      fontWeight: "bold",
    };
    const { result, rerender } = await renderHook(
      (props: FontConfig) => useChartSkiaFont(props, "Menlo", 11),
      { initialProps: font },
    );
    const firstFont = result.current;

    for (let render = 1; render < 100; render += 1) {
      await rerender({ ...font });
      expect(result.current).toBe(firstFont);
    }

    expect(mockMatchFont).toHaveBeenCalledTimes(1);
    expect(mockMatchFont).toHaveBeenCalledWith(
      { fontFamily: "Custom", fontSize: 13, fontWeight: "bold" },
      fontManager,
    );
  });

  it.each<[string, FontConfig]>([
    ["manager", { fontManager: {} as SkFontMgr }],
    ["family", { fontFamily: "Other" }],
    ["size", { fontSize: 18 }],
    ["weight", { fontWeight: "bold" }],
  ])("rematches when the font %s changes", async (_name, changed) => {
    const font: FontConfig = {
      fontManager: {} as SkFontMgr,
      fontFamily: "Custom",
      fontSize: 13,
      fontWeight: "normal",
    };
    const { result, rerender } = await renderHook(
      (props: FontConfig) => useChartSkiaFont(props, "Menlo", 11),
      { initialProps: font },
    );
    const firstFont = result.current;
    const next = { ...font, ...changed };

    await rerender(next);

    expect(result.current).not.toBe(firstFont);
    expect(mockMatchFont).toHaveBeenCalledTimes(2);
    expect(mockMatchFont).toHaveBeenLastCalledWith(
      {
        fontFamily: next.fontFamily,
        fontSize: next.fontSize,
        fontWeight: next.fontWeight,
      },
      next.fontManager,
    );
    const nextFont = result.current;
    await rerender({ ...next });
    expect(result.current).toBe(nextFont);
    expect(mockMatchFont).toHaveBeenCalledTimes(2);
  });

  it("rematches when the resolved default family or size changes", async () => {
    const fontManager = {} as SkFontMgr;
    const { result, rerender } = await renderHook(
      ({ family, size }: { family: string; size: number }) =>
        useChartSkiaFont({ fontManager }, family, size),
      { initialProps: { family: "First", size: 11 } },
    );
    const firstFont = result.current;
    await rerender({ family: "Second", size: 11 });
    expect(result.current).not.toBe(firstFont);
    const secondFont = result.current;
    await rerender({ family: "Second", size: 16 });
    expect(result.current).not.toBe(secondFont);
    expect(mockMatchFont).toHaveBeenCalledTimes(3);
    expect(mockMatchFont).toHaveBeenLastCalledWith(
      expect.objectContaining({ fontFamily: "Second", fontSize: 16 }),
      fontManager,
    );
  });

  it.each([undefined, {} as SkFontMgr])(
    "does not match an unused fallback for a loaded typeface (manager: %s)",
    async (fontManager) => {
      const loaded = {} as SkFont;
      mockUseFont.mockReturnValue(loaded);
      const { result } = await renderHook(() =>
        useChartSkiaFont({ typeface: 42, fontManager }, "LoadedTypeface", 11),
      );

      expect(result.current).toBe(loaded);
      expect(mockMatchFont).not.toHaveBeenCalled();
    },
  );

  it("reuses a pending fallback and follows typeface load, replacement, and removal", async () => {
    const fontManager = {} as SkFontMgr;
    const font: FontConfig = { fontManager, typeface: 42 };
    const { result, rerender } = await renderHook(
      (props: FontConfig) => useChartSkiaFont(props, "Custom", 11),
      { initialProps: font },
    );
    const fallback = result.current;
    await rerender({ ...font });
    expect(result.current).toBe(fallback);
    expect(mockMatchFont).toHaveBeenCalledTimes(1);

    const loaded = {} as SkFont;
    mockUseFont.mockReturnValue(loaded);
    await rerender({ ...font });
    expect(result.current).toBe(loaded);
    expect(mockMatchFont).toHaveBeenCalledTimes(1);

    const replacement = {} as SkFont;
    mockUseFont.mockReturnValue(replacement);
    await rerender({ ...font, typeface: 43 });
    expect(mockUseFont).toHaveBeenLastCalledWith(43, 11);
    expect(result.current).toBe(replacement);
    expect(mockMatchFont).toHaveBeenCalledTimes(1);

    mockUseFont.mockReturnValue(null);
    await rerender({ fontManager });
    expect(mockUseFont).toHaveBeenLastCalledWith(null, 11);
    expect(result.current).toBe(mockMatchFont.mock.results[1].value);
    expect(mockMatchFont).toHaveBeenCalledTimes(2);
  });

  it("returns to the shared system cache when a custom manager is removed", async () => {
    const { result: system } = await renderHook(() =>
      useChartSkiaFont(undefined, "SharedSystemFallback", 11),
    );
    const { result, rerender } = await renderHook(
      (props: FontConfig) => useChartSkiaFont(props, "SharedSystemFallback", 11),
      { initialProps: { fontManager: {} as SkFontMgr } as FontConfig },
    );
    expect(result.current).not.toBe(system.current);

    await rerender({});

    expect(result.current).toBe(system.current);
    expect(mockMatchFont).toHaveBeenCalledTimes(2);
  });
});
