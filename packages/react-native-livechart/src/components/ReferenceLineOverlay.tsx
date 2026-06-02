import {
  DashPathEffect,
  Group,
  Path,
  RoundedRect,
  Skia,
  Text as SkiaText,
  type SkFont,
  type SkPath,
} from "@shopify/react-native-skia";
import { useMemo, useRef } from "react";
import { useDerivedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { useReferenceLine } from "../hooks/useReferenceLine";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import { referenceLineForm } from "../math/referenceLines";
import type { LiveChartPalette, ReferenceLine } from "../types";

/** Translucent fill alpha for value / time bands. */
const BAND_FILL_OPACITY = 0.16;

/** Padding inside the off-axis badge pill, in px. */
const OFF_AXIS_PILL_PAD_X = 6;
const OFF_AXIS_PILL_PAD_Y = 3;
const OFF_AXIS_PILL_RADIUS = 5;

/**
 * Renders one reference line or band into the chart canvas. Handles all three
 * `ReferenceLine` forms (horizontal line, horizontal value band, vertical time
 * band) plus the off-axis badge for an off-screen Form-A value. Self-contained
 * so callers can `.map()` over a variable-length `referenceLines` array.
 */
export function ReferenceLineOverlay({
  engine,
  padding,
  line,
  palette,
  formatValue,
  font,
}: {
  engine: ChartEngineLayout;
  padding: ChartPadding;
  line: ReferenceLine;
  palette: LiveChartPalette;
  formatValue: (v: number) => string;
  font: SkFont;
}) {
  const form = referenceLineForm(line);
  const isBand = form === "value-band" || form === "time-band";
  const layout = useReferenceLine(engine, padding, line, formatValue, font);

  const color = line.color ?? palette.refLine;
  const labelColor = line.labelColor ?? line.color ?? palette.refLabel;
  const strokeWidth = line.strokeWidth ?? 1;
  const intervals = line.intervals ?? [4, 4];

  // Band fill + optional dashed border (border only when strokeWidth is set).
  const bandFillOpacity = line.fillOpacity ?? BAND_FILL_OPACITY;
  const hasBandBorder = isBand && line.strokeWidth !== undefined;

  // Off-axis target pill styling.
  const badgeBackground = line.badgeBackground ?? palette.tooltipBg;
  const badgeBorderColor = line.badgeBorderColor ?? color;
  const badgeRadius = line.badgeRadius ?? OFF_AXIS_PILL_RADIUS;

  const cacheRef = useRef<{
    lineA: SkPath;
    lineB: SkPath;
    lineT: boolean;
    bandA: SkPath;
    bandB: SkPath;
    bandT: boolean;
    borderA: SkPath;
    borderB: SkPath;
    borderT: boolean;
    offA: SkPath;
    offB: SkPath;
    offT: boolean;
    chevA: SkPath;
    chevB: SkPath;
    chevT: boolean;
  } | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = {
      lineA: Skia.Path.Make(),
      lineB: Skia.Path.Make(),
      lineT: false,
      bandA: Skia.Path.Make(),
      bandB: Skia.Path.Make(),
      bandT: false,
      borderA: Skia.Path.Make(),
      borderB: Skia.Path.Make(),
      borderT: false,
      offA: Skia.Path.Make(),
      offB: Skia.Path.Make(),
      offT: false,
      chevA: Skia.Path.Make(),
      chevB: Skia.Path.Make(),
      chevT: false,
    };
  }

  const linePath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.lineT = !cache.lineT;
    const p = cache.lineT ? cache.lineA : cache.lineB;
    p.reset();
    const l = layout.get();
    if (!l.visible || l.offAxis || isBand) return p;
    p.moveTo(l.x1, l.y);
    p.lineTo(l.x2, l.y);
    return p;
  });

  const bandPath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.bandT = !cache.bandT;
    const p = cache.bandT ? cache.bandA : cache.bandB;
    p.reset();
    const l = layout.get();
    if (!l.visible || !isBand) return p;
    p.moveTo(l.x1, l.y);
    p.lineTo(l.x2, l.y);
    p.lineTo(l.x2, l.yBottom);
    p.lineTo(l.x1, l.yBottom);
    p.close();
    return p;
  });

  const bandBorderPath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.borderT = !cache.borderT;
    const p = cache.borderT ? cache.borderA : cache.borderB;
    p.reset();
    const l = layout.get();
    if (!l.visible || !hasBandBorder) return p;
    if (form === "time-band") {
      // Vertical edges at the band's left / right.
      p.moveTo(l.x1, l.y);
      p.lineTo(l.x1, l.yBottom);
      p.moveTo(l.x2, l.y);
      p.lineTo(l.x2, l.yBottom);
    } else {
      // Horizontal edges at the band's top / bottom.
      p.moveTo(l.x1, l.y);
      p.lineTo(l.x2, l.y);
      p.moveTo(l.x1, l.yBottom);
      p.lineTo(l.x2, l.yBottom);
    }
    return p;
  });

  const offLinePath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.offT = !cache.offT;
    const p = cache.offT ? cache.offA : cache.offB;
    p.reset();
    const l = layout.get();
    if (!l.visible || !l.offAxis) return p;
    // Start the connector just past the badge pill's right edge so the dashed
    // line runs out to the chart edge rather than behind the badge.
    const pillRight =
      l.labelX + measureFontTextWidth(font, l.label) + OFF_AXIS_PILL_PAD_X;
    const start = pillRight + 4;
    if (start >= l.x2) return p;
    p.moveTo(start, l.y);
    p.lineTo(l.x2, l.y);
    return p;
  });

  const chevronPath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.chevT = !cache.chevT;
    const p = cache.chevT ? cache.chevA : cache.chevB;
    p.reset();
    const l = layout.get();
    if (!l.visible || !l.offAxis) return p;
    const cx = l.x1 + 6;
    const cy = l.y;
    const s = 4;
    if (l.chevronUp) {
      p.moveTo(cx - s, cy + s);
      p.lineTo(cx, cy - s);
      p.lineTo(cx + s, cy + s);
    } else {
      p.moveTo(cx - s, cy - s);
      p.lineTo(cx, cy + s);
      p.lineTo(cx + s, cy - s);
    }
    return p;
  });

  const lineOpacity = useDerivedValue(() =>
    layout.get().visible && !layout.get().offAxis && !isBand ? 1 : 0,
  );
  const bandOpacity = useDerivedValue(() =>
    layout.get().visible && isBand ? bandFillOpacity : 0,
  );
  const bandBorderOpacity = useDerivedValue(() =>
    layout.get().visible && hasBandBorder ? 1 : 0,
  );
  const offOpacity = useDerivedValue(() =>
    layout.get().visible && layout.get().offAxis ? 1 : 0,
  );
  const labelOpacity = useDerivedValue(() => (layout.get().visible ? 1 : 0));

  const labelX = useDerivedValue(() => layout.get().labelX);
  const labelY = useDerivedValue(() => layout.get().labelY);
  const labelText = useDerivedValue(() => layout.get().label);

  // Font metrics depend only on the (stable) font, so read them once instead of
  // on every frame inside the pill worklets (`getMetrics` allocates + crosses
  // JSI). The off-axis pill's ascent offset and height are then plain constants.
  const { ascent: fontAscent, height: pillH } = useMemo(() => {
    const fm = font.getMetrics();
    return {
      ascent: fm.ascent,
      height: fm.descent - fm.ascent + OFF_AXIS_PILL_PAD_Y * 2,
    };
  }, [font]);

  // Off-axis badge pill — a rounded background behind the chevron + label.
  const pillX = useDerivedValue(() => layout.get().x1 + 2);
  const pillY = useDerivedValue(
    () => layout.get().labelY + fontAscent - OFF_AXIS_PILL_PAD_Y,
  );
  const pillW = useDerivedValue(() => {
    const l = layout.get();
    const textW = measureFontTextWidth(font, l.label);
    return l.labelX + textW + OFF_AXIS_PILL_PAD_X - (l.x1 + 2);
  });

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

      <Group opacity={offOpacity}>
        <Path
          path={offLinePath}
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
      </Group>

      <Group opacity={labelOpacity}>
        <SkiaText
          x={labelX}
          y={labelY}
          text={labelText}
          font={font}
          color={labelColor}
        />
      </Group>
    </Group>
  );
}
