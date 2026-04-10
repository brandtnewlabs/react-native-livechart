import {
  matchFont,
  Skia,
  useFont,
  type SkFont,
} from "@shopify/react-native-skia";
import { useMemo } from "react";

import { resolveFontConfig } from "../core/resolveConfig";
import type { FontConfig } from "../types";

/**
 * Resolves Skia text for charts: optional bundled `typeface` via `useFont`, otherwise
 * `matchFont` with optional custom `fontManager`.
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

  const fallbackFont = useMemo(
    () =>
      matchFont(
        { fontFamily, fontSize, fontWeight },
        fontProp?.fontManager ?? Skia.FontMgr.System(),
      ),
    [fontFamily, fontSize, fontWeight, fontProp?.fontManager],
  );

  if (typefaceSource != null) {
    return customFont ?? fallbackFont;
  }
  return fallbackFont;
}
