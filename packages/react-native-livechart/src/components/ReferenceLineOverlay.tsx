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
import type { YAxisEntry } from "../draw/grid";
import type { ChartPadding } from "../draw/line";
import { useChartSkiaFont } from "../hooks/useChartSkiaFont";
import { usePathBuilder } from "../hooks/usePathBuilder";
import {
  useReferenceLine,
  type ReferenceLineLayout,
} from "../hooks/useReferenceLine";
import { MONO_FONT_FAMILY } from "../lib/monoFontFamily";
import { referenceLineForm, resolveReferenceBadge } from "../math/referenceLines";
import type { FontConfig, LiveChartPalette, ReferenceLine } from "../types";

/** Translucent fill alpha for value / time bands. */
const BAND_FILL_OPACITY = 0.16;

/** Vertical padding inside the badge pill, in px (kept in sync with the layout). */
const BADGE_PILL_PAD_Y = 3;
const BADGE_PILL_RADIUS = 5;
/** Gap between a badge's outer edge and its dashed connector, in px. */
const CONNECTOR_GAP = 4;
/** Badge inset from its plot edge, in px (matches useReferenceLine). */
const BADGE_EDGE_INSET = 2;

/**
 * Renders one reference line or band into the chart canvas. Handles all three
 * `ReferenceLine` forms (horizontal line, horizontal value band, vertical time
 * band) plus the Form-A pill badge (in-range tag + off-screen chevron pin).
 * Self-contained so callers can `.map()` over a variable-length array.
 */
type ReferenceLineOverlayProps = {
  engine: ChartEngineLayout;
  padding: ChartPadding;
  line: ReferenceLine;
  palette: LiveChartPalette;
  formatValue: (v: number) => string;
  font: SkFont;
  /**
   * The chart's raw font config — used to build a per-badge font when the line's
   * {@link ReferenceLineBadgeConfig} sets `fontSize` / `fontFamily` / `fontWeight`.
   * When no badge font knob is set, the resolved `font` is used as-is.
   */
  fontProp?: FontConfig;
  /**
   * Render only the badge + label (`true`) or only the lines / bands (`false`,
   * default). The caller draws the base pass behind the chart content and the
   * badge pass **above** the left-edge fade, so badges/labels stay crisp instead
   * of being erased by the fade's `dstOut` blend.
   */
  badgeLayer?: boolean;
  /**
   * Suppress the built-in tag (badge pill + chevron + icon + gutter label) for
   * this line — used when a custom `renderReferenceLine` element owns the tag.
   * The line / band stroke and a badged line's dashed connector still draw. No
   * effect on the base pass.
  */
  suppressTag?: boolean;
  /**
   * Suppress the built-in tag only while the line is off-axis. Used by
   * `renderOffAxisReferenceLine`, so the normal in-range tag remains intact.
   */
  suppressTagWhenOffAxis?: boolean;
  /**
   * Measured widths of custom reference-line tags, index-aligned with their
   * `referenceLines`. When present for a suppressed badged tag, the built-in
   * connector begins after the custom element instead of the hidden Skia pill.
   */
  customTagWidths?: SharedValue<number[]>;
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
  /** Y-axis entries used to match a right-anchored grid endpoint. */
  yAxisEntries?: SharedValue<YAxisEntry[]>;
  /** Enables clipping to the right-anchored Y-axis label column. */
  labelRightMargin?: number;
  /** Gap between the drawn line endpoint and the label column. */
  gridEndGap?: number;
};

export function ReferenceLineOverlay({
  engine,
  padding,
  line,
  palette,
  formatValue,
  font,
  fontProp,
  badgeLayer = false,
  suppressTag = false,
  suppressTagWhenOffAxis = false,
  customTagWidths,
  groupHidden,
  dragValues,
  index = 0,
  yAxisEntries,
  labelRightMargin,
  gridEndGap,
}: ReferenceLineOverlayProps) {
  const form = referenceLineForm(line);
  const isBand = form === "value-band" || form === "time-band";

  const color = line.color ?? palette.refLine;

  // Resolved badge appearance (badge config → fallback flat fields → theme).
  const badge = resolveReferenceBadge(line);

  // Per-badge font (size/family/weight) override; reuses the chart `font` when no
  // badge font knob is set, so plain lines and gutter labels are unchanged. The
  // built font drives pill measurement (via useReferenceLine) and the badge text.
  const badgeHasFontOverride =
    badge != null &&
    (badge.fontSize != null ||
      badge.fontFamily != null ||
      badge.fontWeight != null);
  const badgeFontOverride = useChartSkiaFont(
    badgeHasFontOverride
      ? {
          ...fontProp,
          fontFamily: badge?.fontFamily ?? fontProp?.fontFamily,
          fontSize: badge?.fontSize ?? fontProp?.fontSize,
          fontWeight: badge?.fontWeight ?? fontProp?.fontWeight,
        }
      : fontProp,
    MONO_FONT_FAMILY,
    palette.labelFontSize,
  );
  const badgeFont = badgeHasFontOverride ? badgeFontOverride : font;

  const layout = useReferenceLine(
    engine,
    padding,
    line,
    formatValue,
    badgeFont,
    dragValues,
    index,
    yAxisEntries,
    labelRightMargin,
    gridEndGap,
    font,
  );

  const labelColor =
    badge?.textColor ?? line.labelColor ?? line.color ?? palette.refLabel;
  const strokeWidth = line.strokeWidth ?? 1;
  const intervals = line.intervals ?? [4, 4];

  // Band fill + optional dashed border (border only when strokeWidth is set).
  const bandFillOpacity = line.fillOpacity ?? BAND_FILL_OPACITY;
  const hasBandBorder = isBand && line.strokeWidth !== undefined;

  const badgeBackground = badge?.background ?? palette.tooltipBg;
  const badgeBorderColor = badge?.borderColor ?? color;
  const badgeBorderWidth = badge?.borderWidth ?? 1;
  const badgeRadius = badge?.radius ?? BADGE_PILL_RADIUS;
  // Nudge the whole badge (connector + pill + chevron + icon + label) off its anchor.
  const badgeOffsetX = badge?.offsetX ?? 0;
  const badgeOffsetY = badge?.offsetY ?? 0;
  const badgeTransform =
    badgeOffsetX !== 0 || badgeOffsetY !== 0
      ? [{ translateX: badgeOffsetX }, { translateY: badgeOffsetY }]
      : undefined;

  if (!badgeLayer) {
    return (
      <ReferenceLineBasePass
        layout={layout}
        color={color}
        strokeWidth={strokeWidth}
        intervals={intervals}
        isBand={isBand}
        isTimeBand={form === "time-band"}
        bandFillOpacity={bandFillOpacity}
        hasBandBorder={hasBandBorder}
      />
    );
  }

  return (
    <ReferenceLineBadgePass
      layout={layout}
      color={color}
      strokeWidth={strokeWidth}
      intervals={intervals}
      badgeFont={badgeFont}
      badgePosition={badge?.position}
      labelColor={labelColor}
      badgeBackground={badgeBackground}
      badgeBorderColor={badgeBorderColor}
      badgeBorderWidth={badgeBorderWidth}
      badgeRadius={badgeRadius}
      badgeOffsetX={badgeOffsetX}
      badgeOffsetY={badgeOffsetY}
      suppressTag={suppressTag}
      suppressTagWhenOffAxis={suppressTagWhenOffAxis}
      customTagWidths={customTagWidths}
      groupHidden={groupHidden}
      index={index}
    />
  );
}

/** Base stroke / band pass, kept behind the chart content. */
function ReferenceLineBasePass({
  layout,
  color,
  strokeWidth,
  intervals,
  isBand,
  isTimeBand,
  bandFillOpacity,
  hasBandBorder,
}: {
  layout: SharedValue<ReferenceLineLayout>;
  color: string;
  strokeWidth: number;
  intervals: [number, number];
  isBand: boolean;
  isTimeBand: boolean;
  bandFillOpacity: number;
  hasBandBorder: boolean;
}) {
  const lineBuilder = usePathBuilder();
  const bandBuilder = usePathBuilder();
  const borderBuilder = usePathBuilder();

  const linePath = useDerivedValue(() => {
    const b = lineBuilder.value;
    const l = layout.get();
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
      if (isTimeBand) {
        b.moveTo(l.lineX1, l.y);
        b.lineTo(l.lineX1, l.yBottom);
        b.moveTo(l.lineX2, l.y);
        b.lineTo(l.lineX2, l.yBottom);
      } else {
        b.moveTo(l.lineX1, l.y);
        b.lineTo(l.lineX2, l.y);
        b.moveTo(l.lineX1, l.yBottom);
        b.lineTo(l.lineX2, l.yBottom);
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

  return (
    <Group>
      {isBand && (
        <Group opacity={bandOpacity}>
          <Path path={bandPath} style="fill" color={color} />
        </Group>
      )}
      {hasBandBorder && (
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
      {!isBand && (
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
    </Group>
  );
}

/** Badge, connector, and label pass, painted above the chart's left-edge fade. */
function ReferenceLineBadgePass({
  layout,
  color,
  strokeWidth,
  intervals,
  badgeFont,
  badgePosition,
  labelColor,
  badgeBackground,
  badgeBorderColor,
  badgeBorderWidth,
  badgeRadius,
  badgeOffsetX,
  badgeOffsetY,
  suppressTag,
  suppressTagWhenOffAxis,
  customTagWidths,
  groupHidden,
  index,
}: {
  layout: SharedValue<ReferenceLineLayout>;
  color: string;
  strokeWidth: number;
  intervals: [number, number];
  badgeFont: SkFont;
  badgePosition: "left" | "center" | "right" | undefined;
  labelColor: string;
  badgeBackground: string;
  badgeBorderColor: string;
  badgeBorderWidth: number;
  badgeRadius: number;
  badgeOffsetX: number;
  badgeOffsetY: number;
  suppressTag: boolean;
  suppressTagWhenOffAxis: boolean;
  customTagWidths?: SharedValue<number[]>;
  groupHidden?: SharedValue<boolean[]>;
  index: number;
}) {
  const connBuilder = usePathBuilder();
  const chevBuilder = usePathBuilder();
  const badgeTransform =
    badgeOffsetX !== 0 || badgeOffsetY !== 0
      ? [{ translateX: badgeOffsetX }, { translateY: badgeOffsetY }]
      : undefined;
  const connPath = useDerivedValue(() => {
    const b = connBuilder.value;
    const l = layout.get();
    if (l.visible && l.badge && l.connStart >= 0) {
      let start = l.connStart;
      let end = l.connEnd;
      const customTagActive =
        suppressTag || (suppressTagWhenOffAxis && l.offAxis);
      const customWidth = customTagActive
        ? customTagWidths?.get()[index] ?? 0
        : 0;
      if (customWidth > 0) {
        if (badgePosition === "left") {
          start = l.x1 + BADGE_EDGE_INSET + customWidth + CONNECTOR_GAP;
          end = l.x2;
        } else if (badgePosition === "right") {
          start = l.x1;
          end = l.x2 - BADGE_EDGE_INSET - customWidth - CONNECTOR_GAP;
        }
      }
      if (end > start) {
        b.moveTo(start, l.y);
        b.lineTo(end, l.y);
      }
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
  const badgeOpacity = useDerivedValue(() => {
    const l = layout.get();
    const grouped = groupHidden ? groupHidden.get()[index] === true : false;
    const customTagActive =
      suppressTag || (suppressTagWhenOffAxis && l.offAxis);
    return !customTagActive && !grouped && l.visible && l.badge ? 1 : 0;
  });
  const connectorOpacity = useDerivedValue(() => {
    const l = layout.get();
    const grouped = groupHidden ? groupHidden.get()[index] === true : false;
    return !grouped && l.visible && l.badge && l.connStart >= 0 ? 1 : 0;
  });
  const labelOpacity = useDerivedValue(() => {
    const l = layout.get();
    const grouped = groupHidden ? groupHidden.get()[index] === true : false;
    const customTagActive =
      suppressTag || (suppressTagWhenOffAxis && l.offAxis);
    return !customTagActive && !grouped && l.visible && l.label.length > 0 ? 1 : 0;
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
  const { ascent: fontAscent, height: pillH } = (() => {
    const fm = badgeFont.getMetrics();
    return {
      ascent: fm.ascent,
      height: fm.descent - fm.ascent + BADGE_PILL_PAD_Y * 2,
    };
  })();
  const pillX = useDerivedValue(() => layout.get().pillX);
  const pillW = useDerivedValue(() => layout.get().pillW);
  const pillY = useDerivedValue(
    () => layout.get().labelY + fontAscent - BADGE_PILL_PAD_Y,
  );

  return (
    <Group>
      <Group opacity={connectorOpacity} transform={badgeTransform}>
        <Path
          path={connPath}
          style="stroke"
          strokeWidth={strokeWidth}
          color={color}
        >
          <DashPathEffect intervals={intervals} />
        </Path>
      </Group>
      <Group opacity={badgeOpacity} transform={badgeTransform}>
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
          strokeWidth={badgeBorderWidth}
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
            font={badgeFont}
            color={labelColor}
          />
        </Group>
      </Group>
      <Group opacity={labelOpacity} transform={badgeTransform}>
        <SkiaText
          x={labelX}
          y={labelY}
          text={labelText}
          font={badgeFont}
          color={labelColor}
        />
      </Group>
    </Group>
  );
}
