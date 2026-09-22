import type { SkFont } from "@shopify/react-native-skia";

/** Caller-owned last-value cache for repeated UI-thread text measurement. */
export interface TextWidthCache {
  /** Font used for the cached measurement. */
  font?: SkFont;
  /** Text used for the cached measurement. */
  text?: string;
  /** Cached width. */
  width?: number;
}

/**
 * Horizontal layout width for `text` via Skia `measureText` (replaces deprecated `getTextWidth`).
 * Marked worklet for use inside Reanimated `useDerivedValue`.
 */
export function measureFontTextWidth(
  font: SkFont,
  text: string,
  cache?: TextWidthCache,
): number {
  "worklet";
  if (cache?.font === font && cache.text === text && cache.width !== undefined) {
    return cache.width;
  }

  const width = font.measureText(text).width;
  if (cache) {
    cache.font = font;
    cache.text = text;
    cache.width = width;
  }
  return width;
}
