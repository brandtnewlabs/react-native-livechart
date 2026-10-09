import { useMemo, useRef } from "react";
import type { SkFont } from "@shopify/react-native-skia";
import { useAnimatedReaction, type SharedValue } from "react-native-reanimated";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { measureFontTextWidth, type TextWidthCache } from "../lib/measureFontTextWidth";
import type { AxisBadgeConfig } from "../math/axisBadgeLayout";
import { classifyReferenceEdge, referenceLineForm, resolveReferenceBadge } from "../math/referenceLines";
import { EMPTY_TAG_STACK, stackReferenceTags, type ReferenceTag, type ReferenceTagStack, type TagRect } from "../math/referenceTagStack";
import type { FontConfig, ReferenceLine } from "../types";
import { computeScrubDotY } from "./crosshairShared";
import { referenceBadgeFont } from "./referenceBadgeFont";
import { computeReferenceLineLayout, referenceBadgeRect } from "./useReferenceLine";

export type CustomTagSizes = Record<string, { width: number; height: number }>;

/** One shared geometry result drives built-in/custom rendering and hit targets. */
export function useReferenceTagStack({
  enabled, radius, engine, padding, lines, keys, custom, offAxisCustom,
  customSizes, font, fontProp, formatValue, dragValues, valueAxis, obstacle, output,
}: {
  enabled: boolean; radius: number; engine: ChartEngineLayout; padding: ChartPadding;
  lines: ReferenceLine[]; keys: string[]; custom: boolean[]; offAxisCustom: boolean[];
  customSizes: SharedValue<CustomTagSizes>; font: SkFont; fontProp?: FontConfig;
  formatValue: (value: number) => string; dragValues: SharedValue<number[]>;
  valueAxis: AxisBadgeConfig; obstacle: SharedValue<TagRect | null> | null;
  output: SharedValue<ReferenceTagStack>;
}) {
  const fonts = useMemo(() => enabled ? lines.map(line => ({
    name: referenceBadgeFont(font, fontProp, resolveReferenceBadge(line) ?? undefined),
    value: referenceBadgeFont(font, fontProp, typeof line.valueBadge === "object" ? line.valueBadge : undefined),
  })) : [], [enabled, lines, font, fontProp]);
  const caches = useRef<TextWidthCache[]>([]);
  const valueCaches = useRef<TextWidthCache[]>([]);
  useAnimatedReaction(() => {
    if (!enabled) return EMPTY_TAG_STACK;
    const w = engine.canvasWidth.get(), h = engine.canvasHeight.get();
    const min = engine.displayMin.get(), max = engine.displayMax.get();
    const tags: ReferenceTag[] = [];
    const values = dragValues.get();
    const sizes = customSizes.get();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (referenceLineForm(line) !== "line" || line.value === undefined) continue;
      const value = values[i] ?? line.value;
      const offAxis = classifyReferenceEdge(value, min, max) !== "in";
      if (custom[i] || (offAxisCustom[i] && offAxis)) {
        const size = sizes[keys[i]];
        if (!size || w <= 0 || h - padding.top - padding.bottom <= 0) continue;
        const anchor = resolveReferenceBadge(line)?.position ?? line.labelPosition ?? "left";
        const y = Math.min(h - padding.bottom - 12, Math.max(padding.top + 12,
          computeScrubDotY(value, min, max, h, padding.top, padding.bottom)));
        const x = anchor === "right" ? w - padding.right - 2 - size.width
          : anchor === "center" ? (padding.left + w - padding.right - size.width) / 2 : padding.left + 2;
        tags.push({ index: i, lineId: line.id, key: keys[i] + ":custom", kind: "custom", x, y: y - size.height / 2, w: size.width, h: size.height, lineY: y });
        continue;
      }
      const nameCache = caches.current[i] ?? (caches.current[i] = {});
      const valueCache = valueCaches.current[i] ?? (valueCaches.current[i] = {});
      const layout = computeReferenceLineLayout(w, h, padding, line, formatValue, fonts[i].name,
        min, max, 0, 1, value, undefined, undefined, 0, font, fonts[i].value, valueAxis, nameCache, valueCache);
      if (!layout.visible) continue;
      let name = referenceBadgeRect(layout, fonts[i].name, line);
      if (!name && layout.label) {
        const fm = fonts[i].name.getMetrics();
        name = { x: layout.labelX, y: layout.labelY + fm.ascent,
          w: measureFontTextWidth(fonts[i].name, layout.label, nameCache), h: fm.descent - fm.ascent };
      }
      if (name) tags.push({ ...name, index: i, lineId: line.id, key: keys[i] + ":name", kind: "name", lineY: layout.y });
      if (layout.valueBadge) tags.push({ ...layout.valueBadge, index: i, lineId: line.id, key: keys[i] + ":value", kind: "value", lineY: layout.y });
    }
    return stackReferenceTags(tags, padding.top, h - padding.bottom, radius, obstacle?.get() ?? null);
  }, (next, previous) => {
    // Avoid waking every tag mapper when the engine ticks but geometry is steady.
    if (previous && next.tags.length === previous.tags.length && next.tags.every((t, i) => {
      const p = previous.tags[i];
      return t.key === p.key && t.index === p.index && t.x === p.x && t.y === p.y && t.w === p.w && t.h === p.h && t.offsetY === p.offsetY && t.lineY === p.lineY;
    })) return;
    output.set(next);
  });
}
