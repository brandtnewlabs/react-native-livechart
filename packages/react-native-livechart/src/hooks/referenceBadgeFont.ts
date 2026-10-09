import { matchFont, Skia, type SkFont } from "@shopify/react-native-skia";
import { resolveFontConfig } from "../core/resolveConfig";
import { MONO_FONT_FAMILY } from "../lib/monoFontFamily";
import type { BadgeStyleConfig, FontConfig } from "../types";
import { matchSystemFont } from "./useChartSkiaFont";

/** Resolve the same font for a rendered pill and its hit target, on the JS thread. */
export function referenceBadgeFont(
  base: SkFont,
  prop: FontConfig | undefined,
  style: BadgeStyleConfig | undefined,
): SkFont {
  if (
    style?.fontSize == null &&
    style?.fontFamily == null &&
    style?.fontWeight == null
  )
    return base;
  const config = {
    ...prop,
    fontSize: style.fontSize ?? prop?.fontSize,
    fontFamily: style.fontFamily ?? prop?.fontFamily,
    fontWeight: style.fontWeight ?? prop?.fontWeight,
  };
  const { fontSize, fontFamily, fontWeight } = resolveFontConfig(
    config,
    MONO_FONT_FAMILY,
    base.getSize(),
  );
  if (prop?.typeface)
    return Skia.Font(base.getTypeface() ?? undefined, fontSize);
  return prop?.fontManager
    ? matchFont({ fontSize, fontFamily, fontWeight }, prop.fontManager)
    : matchSystemFont(fontFamily, fontSize, fontWeight);
}
