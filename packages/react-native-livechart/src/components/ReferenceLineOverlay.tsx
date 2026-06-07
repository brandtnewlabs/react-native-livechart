import {
  DashPathEffect,
  Group,
  Path,
  RoundedRect,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { usePathBuilder } from "../hooks/usePathBuilder";
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

  const lineBuilder = usePathBuilder();
  const bandBuilder = usePathBuilder();
  const borderBuilder = usePathBuilder();
  const offBuilder = usePathBuilder();
  const chevBuilder = usePathBuilder();

  const linePath = useDerivedValue(() => {
    const b = lineBuilder.value;
    const l = layout.get();
    if (l.visible && !l.offAxis && !isBand) {
      b.moveTo(l.x1, l.y);
      b.lineTo(l.x2, l.y);
    }
    return b.detach();
  });

  const bandPath = useDerivedValue(() => {
    const b = bandBuilder.value;
    const l = layout.get();
    if (l.visible && isBand) {
      b.moveTo(l.x1, l.y);
      b.lineTo(l.x2, l.y);
      b.lineTo(l.x2, l.yBottom);
      b.lineTo(l.x1, l.yBottom);
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
        b.moveTo(l.x1, l.y);
        b.lineTo(l.x1, l.yBottom);
        b.moveTo(l.x2, l.y);
        b.lineTo(l.x2, l.yBottom);
      } else {
        // Horizontal edges at the band's top / bottom.
        b.moveTo(l.x1, l.y);
        b.lineTo(l.x2, l.y);
        b.moveTo(l.x1, l.yBottom);
        b.lineTo(l.x2, l.yBottom);
      }
    }
    return b.detach();
  });

  const offLinePath = useDerivedValue(() => {
    const b = offBuilder.value;
    const l = layout.get();
    if (l.visible && l.offAxis) {
      // Start the connector just past the badge pill's right edge so the dashed
      // line runs out to the chart edge rather than behind the badge.
      const pillRight =
        l.labelX + measureFontTextWidth(font, l.label) + OFF_AXIS_PILL_PAD_X;
      const start = pillRight + 4;
      if (start < l.x2) {
        b.moveTo(start, l.y);
        b.lineTo(l.x2, l.y);
      }
    }
    return b.detach();
  });

  const chevronPath = useDerivedValue(() => {
    const b = chevBuilder.value;
    const l = layout.get();
    if (l.visible && l.offAxis) {
      const cx = l.x1 + 6;
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
  const { ascent: fontAscent, height: pillH } = (() => {
    const fm = font.getMetrics();
    return {
      ascent: fm.ascent,
      height: fm.descent - fm.ascent + OFF_AXIS_PILL_PAD_Y * 2,
    };
  })();

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
