import {
  matchFont,
  Skia,
  useFont,
  type SkFont,
  type SkFontMgr,
} from "@shopify/react-native-skia";

import { resolveFontConfig } from "../core/resolveConfig";
import type { FontConfig } from "../types";

/**
 * System-font match cache. `matchFont` walks the platform font manager to
 * resolve a typeface — a few ms per call — and every chart resolves several
 * fonts per render, so a screen full of sparklines would otherwise re-match
 * the same `{family, size, weight}` dozens of times. `SkFont` instances are
 * immutable and safe to share across canvases. Custom `fontManager`s bypass
 * the cache (their identity isn't part of the key).
 */
const systemFontCache = new Map<string, SkFont>();
let systemFontMgr: SkFontMgr | null = null;

function matchSystemFont(
  fontFamily: string,
  fontSize: number,
  fontWeight: NonNullable<FontConfig["fontWeight"]>,
): SkFont {
  const key = `${fontFamily}|${fontSize}|${fontWeight}`;
  const cached = systemFontCache.get(key);
  if (cached) return cached;
  systemFontMgr ??= Skia.FontMgr.System();
  const font = matchFont({ fontFamily, fontSize, fontWeight }, systemFontMgr);
  systemFontCache.set(key, font);
  return font;
}

/**
 * Resolves Skia text for charts: optional bundled `typeface` via `useFont`, otherwise
 * `matchFont` with optional custom `fontManager`. System-font matches are cached
 * module-wide, so many charts sharing a family/size/weight resolve it once.
 */
export function useChartSkiaFont(
  fontProp: FontConfig | undefined,
  defaultFamily: string,
  defaultSize: number,
): SkFont {
  const resolved = resolveFontConfig(fontProp, defaultFamily, defaultSize);
  const { fontFamily, fontSize, fontWeight } = resolved;
  const typefaceSource = fontProp?.typeface ?? null;
  const customFont = useFont(typefaceSource, fontSize);

  const fallbackFont = fontProp?.fontManager
    ? matchFont({ fontFamily, fontSize, fontWeight }, fontProp.fontManager)
    : matchSystemFont(fontFamily, fontSize, fontWeight);

  if (typefaceSource != null) {
    return customFont ?? fallbackFont;
  }
  return fallbackFont;
}
