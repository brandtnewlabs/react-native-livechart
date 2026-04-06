import type { SkFont } from "@shopify/react-native-skia";

/**
 * Horizontal layout width for `text` via Skia `measureText` (replaces deprecated `getTextWidth`).
 * Marked worklet for use inside Reanimated `useDerivedValue`.
 */
export function measureFontTextWidth(font: SkFont, text: string): number {
  "worklet";
  return font.measureText(text).width;
}
