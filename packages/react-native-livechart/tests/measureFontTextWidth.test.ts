import type { SkFont } from "@shopify/react-native-skia";

import { measureFontTextWidth } from "../src/lib/measureFontTextWidth";

describe("measureFontTextWidth", () => {
  it("reuses a measurement for the same font and text", () => {
    const measureText = jest.fn(() => ({ width: 42 }));
    const font = { measureText } as unknown as SkFont;
    const cache = {};

    expect(measureFontTextWidth(font, "$1,234", cache)).toBe(42);
    expect(measureFontTextWidth(font, "$1,234", cache)).toBe(42);
    expect(measureText).toHaveBeenCalledTimes(1);
  });

  it("does not share measurements between font instances", () => {
    const firstMeasure = jest.fn(() => ({ width: 10 }));
    const secondMeasure = jest.fn(() => ({ width: 20 }));
    const firstFont = { measureText: firstMeasure } as unknown as SkFont;
    const secondFont = { measureText: secondMeasure } as unknown as SkFont;

    expect(measureFontTextWidth(firstFont, "same")).toBe(10);
    expect(measureFontTextWidth(secondFont, "same")).toBe(20);
  });
});
