import {
  DashPathEffect,
  Group,
  Path,
  RoundedRect,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { usePathBuilder } from "../hooks/usePathBuilder";
import { useReferenceLine } from "../hooks/useReferenceLine";
import { referenceLineForm, resolveReferenceBadge } from "../math/referenceLines";
import type { LiveChartPalette, ReferenceLine } from "../types";

/** Translucent fill alpha for value / time bands. */
const BAND_FILL_OPACITY = 0.16;

/** Vertical padding inside the badge pill, in px (kept in sync with the layout). */
const BADGE_PILL_PAD_Y = 3;
const BADGE_PILL_RADIUS = 5;

/**
 * Renders one reference line or band into the chart canvas. Handles all three
 * `ReferenceLine` forms (horizontal line, horizontal value band, vertical time
 * band) plus the Form-A pill badge (in-range tag + off-screen chevron pin).
 * Self-contained so callers can `.map()` over a variable-length array.
 */
export function ReferenceLineOverlay({
  engine,
  padding,
  line,
  palette,
  formatValue,
  font,
  badgeLayer = false,
  suppressTag = false,
  groupHidden,
  dragValues,
  index = 0,
}: {
  engine: ChartEngineLayout;
  padding: ChartPadding;
  line: ReferenceLine;
  palette: LiveChartPalette;
  formatValue: (v: number) => string;
  font: SkFont;
  /**
   * Render only the badge + label (`true`) or only the lines / bands (`false`,
   * default). The caller draws the base pass behind the chart content and the
   * badge pass **above** the left-edge fade, so badges/labels stay crisp instead
   * of being erased by the fade's `dstOut` blend.
   */
  badgeLayer?: boolean;
  /**
   * Suppress the built-in tag (badge pill + connector + chevron + icon + gutter
   * label) for this line — used when a custom `renderReferenceLine` element owns
   * the tag. The line / band stroke still draws. No effect on the base pass.
   */
  suppressTag?: boolean;
  /**
   * Per-frame grouping flags (index-aligned): when this line's slot is `true` it's
   * collapsed into a group count handle, so its tag is suppressed (the line / band
   * stroke still draws).
   */
  groupHidden?: SharedValue<boolean[]>;
  /** Per-line live value overrides (dragged values), index-aligned with `referenceLines`. */
  dragValues?: SharedValue<number[]>;
  /** This line's index into {@link dragValues}. */
  index?: number;
}) {
  const form = referenceLineForm(line);
  const isBand = form === "value-band" || form === "time-band";
  const layout = useReferenceLine(
    engine,
    padding,
    line,
    formatValue,
    font,
    dragValues,
    index,
  );

  const color = line.color ?? palette.refLine;
  const labelColor = line.labelColor ?? line.color ?? palette.refLabel;
  const strokeWidth = line.strokeWidth ?? 1;
  const intervals = line.intervals ?? [4, 4];

  // Band fill + optional dashed border (border only when strokeWidth is set).
  const bandFillOpacity = line.fillOpacity ?? BAND_FILL_OPACITY;
  const hasBandBorder = isBand && line.strokeWidth !== undefined;

  // Resolved badge appearance (badge config → fallback flat fields → theme).
  const badge = resolveReferenceBadge(line);
  const badgeBackground = badge?.background ?? palette.tooltipBg;
  const badgeBorderColor = badge?.borderColor ?? color;
  const badgeRadius = badge?.radius ?? BADGE_PILL_RADIUS;

  const lineBuilder = usePathBuilder();
  const bandBuilder = usePathBuilder();
  const borderBuilder = usePathBuilder();
  const connBuilder = usePathBuilder();
  const chevBuilder = usePathBuilder();

  const linePath = useDerivedValue(() => {
    const b = lineBuilder.value;
    const l = layout.get();
    // A plain horizontal line, drawn at the line extent (full-width when opted in).
    // A non-full-width badge instead draws a pill + connector to the edge, below.
    if (l.visible && l.drawLine && !isBand) {
      b.moveTo(l.lineX1, l.y);
      b.lineTo(l.lineX2, l.y);
    }
    return b.detach();
  });

  const bandPath = useDerivedValue(() => {
    const b = bandBuilder.value;
    const l = layout.get();
    if (l.visible && isBand) {
      b.moveTo(l.lineX1, l.y);
      b.lineTo(l.lineX2, l.y);
      b.lineTo(l.lineX2, l.yBottom);
      b.lineTo(l.lineX1, l.yBottom);
      b.close();
    }
    return b.detach();
  });

  const bandBorderPath = useDerivedValue(() => {
    const b = borderBuilder.value;
    const l = layout.get();
    if (l.visible && hasBandBorder) {
      if (form === "time-band") {
        // Vertical edges at the band's left / right.
        b.moveTo(l.lineX1, l.y);
        b.lineTo(l.lineX1, l.yBottom);
        b.moveTo(l.lineX2, l.y);
        b.lineTo(l.lineX2, l.yBottom);
      } else {
        // Horizontal edges at the band's top / bottom.
        b.moveTo(l.lineX1, l.y);
        b.lineTo(l.lineX2, l.y);
        b.moveTo(l.lineX1, l.yBottom);
        b.lineTo(l.lineX2, l.yBottom);
      }
    }
    return b.detach();
  });

  // Badge connector — the dashed line from the pill out to the opposite edge.
  const connPath = useDerivedValue(() => {
    const b = connBuilder.value;
    const l = layout.get();
    if (l.visible && l.badge && l.connStart >= 0) {
      b.moveTo(l.connStart, l.y);
      b.lineTo(l.connEnd, l.y);
    }
    return b.detach();
  });

  const chevronPath = useDerivedValue(() => {
    const b = chevBuilder.value;
    const l = layout.get();
    if (l.visible && l.offAxis && l.chevronCx >= 0) {
      const cx = l.chevronCx;
      const cy = l.y;
      const s = 4;
      if (l.chevronUp) {
        b.moveTo(cx - s, cy + s);
        b.lineTo(cx, cy - s);
        b.lineTo(cx + s, cy + s);
      } else {
        b.moveTo(cx - s, cy - s);
        b.lineTo(cx, cy + s);
        b.lineTo(cx + s, cy - s);
      }
    }
    return b.detach();
  });

  const lineOpacity = useDerivedValue(() => {
    const l = layout.get();
    return l.visible && l.drawLine && !isBand ? 1 : 0;
  });
  const bandOpacity = useDerivedValue(() =>
    layout.get().visible && isBand ? bandFillOpacity : 0,
  );
  const bandBorderOpacity = useDerivedValue(() =>
    layout.get().visible && hasBandBorder ? 1 : 0,
  );
  const badgeOpacity = useDerivedValue(() => {
    const l = layout.get();
    const grouped = groupHidden ? groupHidden.get()[index] === true : false;
    return !suppressTag && !grouped && l.visible && l.badge ? 1 : 0;
  });
  // Text + icon ride in the badge pass too, so they stay crisp above the fade.
  const labelOpacity = useDerivedValue(() => {
    const l = layout.get();
    const grouped = groupHidden ? groupHidden.get()[index] === true : false;
    return !suppressTag && !grouped && l.visible && l.label.length > 0 ? 1 : 0;
  });
  const iconOpacity = useDerivedValue(() => {
    const l = layout.get();
    return l.visible && l.icon.length > 0 ? 1 : 0;
  });

  const labelX = useDerivedValue(() => layout.get().labelX);
  const labelY = useDerivedValue(() => layout.get().labelY);
  const labelText = useDerivedValue(() => layout.get().label);
  const iconX = useDerivedValue(() => layout.get().iconX);
  const iconText = useDerivedValue(() => layout.get().icon);

  // Font metrics depend only on the (stable) font, so read them once instead of
  // on every frame inside the pill worklet (`getMetrics` allocates + crosses JSI).
  const { ascent: fontAscent, height: pillH } = (() => {
    const fm = font.getMetrics();
    return {
      ascent: fm.ascent,
      height: fm.descent - fm.ascent + BADGE_PILL_PAD_Y * 2,
    };
  })();

  // Pill rect — position/size from the layout; vertically centered on the line.
  const pillX = useDerivedValue(() => layout.get().pillX);
  const pillW = useDerivedValue(() => layout.get().pillW);
  const pillY = useDerivedValue(
    () => layout.get().labelY + fontAscent - BADGE_PILL_PAD_Y,
  );

  return (
    <Group>
      {/* Base pass — bands + lines, drawn behind the chart content (and faded at
          the left edge like the rest of the content). */}
      {!badgeLayer && isBand && (
        <Group opacity={bandOpacity}>
          <Path path={bandPath} style="fill" color={color} />
        </Group>
      )}

      {!badgeLayer && hasBandBorder && (
        <Group opacity={bandBorderOpacity}>
          <Path
            path={bandBorderPath}
            style="stroke"
            strokeWidth={strokeWidth}
            color={color}
          >
            <DashPathEffect intervals={intervals} />
          </Path>
        </Group>
      )}

      {!badgeLayer && !isBand && (
        <Group opacity={lineOpacity}>
          <Path
            path={linePath}
            style="stroke"
            strokeWidth={strokeWidth}
            color={color}
          >
            <DashPathEffect intervals={intervals} />
          </Path>
        </Group>
      )}

      {/* Badge pass — connector + pill + chevron + icon, above the left-edge fade. */}
      {badgeLayer && (
        <Group opacity={badgeOpacity}>
          <Path
            path={connPath}
            style="stroke"
            strokeWidth={strokeWidth}
            color={color}
          >
            <DashPathEffect intervals={intervals} />
          </Path>
          <RoundedRect
            x={pillX}
            y={pillY}
            width={pillW}
            height={pillH}
            r={badgeRadius}
            color={badgeBackground}
          />
          <RoundedRect
            x={pillX}
            y={pillY}
            width={pillW}
            height={pillH}
            r={badgeRadius}
            color={badgeBorderColor}
            style="stroke"
            strokeWidth={1}
          />
          <Path
            path={chevronPath}
            style="stroke"
            strokeWidth={1.5}
            color={color}
            strokeCap="round"
            strokeJoin="round"
          />
          <Group opacity={iconOpacity}>
            <SkiaText
              x={iconX}
              y={labelY}
              text={iconText}
              font={font}
              color={labelColor}
            />
          </Group>
        </Group>
      )}

      {/* Labels ride in the badge pass too, so they stay crisp above the fade. */}
      {badgeLayer && (
        <Group opacity={labelOpacity}>
          <SkiaText
            x={labelX}
            y={labelY}
            text={labelText}
            font={font}
            color={labelColor}
          />
        </Group>
      )}
    </Group>
  );
}
