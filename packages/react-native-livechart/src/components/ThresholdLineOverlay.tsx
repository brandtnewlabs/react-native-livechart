import {
  DashPathEffect,
  Group,
  Path,
  RoundedRect,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ResolvedThresholdLineConfig } from "../core/resolveConfig";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { usePathBuilder } from "../hooks/usePathBuilder";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import type { LiveChartPalette } from "../types";

/** Padding inside the marker badge pill, in px (mirrors `ReferenceLineOverlay`). */
const BADGE_PAD_X = 6;
const BADGE_PAD_Y = 3;
const BADGE_RADIUS = 5;
/** Inset from the canvas edge — small so the badge sits as flush to the edge as possible. */
const BADGE_EDGE_INSET = 2;

interface ThresholdMarkerProps {
  engine: ChartEngineLayout;
  padding: ChartPadding;
  lineY: SharedValue<number>;
  visible: SharedValue<boolean>;
  value: SharedValue<number>;
  cfg: ResolvedThresholdLineConfig;
  palette: LiveChartPalette;
  font: SkFont;
  formatValue: (v: number) => string;
  /** When set, draw the marker as this time-varying threshold polyline (`[x, y, …]`)
   *  instead of a horizontal line at `lineY`. */
  seriesPts?: SharedValue<number[]>;
}

/**
 * The dashed horizontal marker line at a live threshold value, tracking a
 * `SharedValue` pixel-Y on the UI thread. Drawn **behind** the chart line so the
 * data line stays the focus; the label badge ({@link ThresholdBadgeOverlay}) is
 * a separate layer drawn on top. Hidden when the threshold is off-screen.
 */
export function ThresholdLineOverlay({
  engine,
  padding,
  lineY,
  visible,
  cfg,
  palette,
  seriesPts,
}: ThresholdMarkerProps) {
  const lineColor = cfg.color ?? palette.refLine;
  const { strokeWidth, intervals } = cfg;

  const builder = usePathBuilder();

  const linePath = useDerivedValue(() => {
    const b = builder.value;
    if (visible.get()) {
      const sp = seriesPts?.get();
      if (sp && sp.length >= 4) {
        // Time-varying threshold: trace the polyline across the plot.
        b.moveTo(sp[0], sp[1]);
        for (let i = 2; i < sp.length; i += 2) b.lineTo(sp[i], sp[i + 1]);
      } else {
        const y = lineY.get();
        b.moveTo(padding.left, y);
        b.lineTo(engine.canvasWidth.get() - padding.right, y);
      }
    }
    return b.detach();
  });

  const opacity = useDerivedValue(() => (visible.get() ? 1 : 0));

  return (
    <Group opacity={opacity}>
      <Path
        path={linePath}
        style="stroke"
        strokeWidth={strokeWidth}
        color={lineColor}
      >
        <DashPathEffect intervals={intervals} />
      </Path>
    </Group>
  );
}

/**
 * The threshold's label as an opaque badge pill (rounded background + colored
 * border, like `ReferenceLineOverlay`'s off-axis badge). Drawn **on top** of the
 * chart line so the label is never painted over, and anchored hard to the plot's
 * left edge by default (clear of the y-axis labels + live badge) or the right
 * gutter. Renders nothing when there is no label and no `showValue`.
 */
export function ThresholdBadgeOverlay({
  engine,
  padding,
  lineY,
  visible,
  value,
  cfg,
  palette,
  font,
  formatValue,
}: ThresholdMarkerProps) {
  const { label, labelPosition, showValue } = cfg;
  const badgeBackground = palette.tooltipBg;
  const badgeBorderColor = cfg.color ?? palette.refLine;
  const labelColor = cfg.color ?? palette.refLabel;

  // Font metrics are stable → read once (getMetrics allocates + crosses JSI).
  const { fontAscent, baselineOffset, pillH } = (() => {
    const fm = font.getMetrics();
    return {
      fontAscent: fm.ascent,
      baselineOffset: (fm.ascent + fm.descent) / 2,
      pillH: fm.descent - fm.ascent + BADGE_PAD_Y * 2,
    };
  })();

  const opacity = useDerivedValue(() => (visible.get() ? 1 : 0));

  const labelText = useDerivedValue(() => {
    if (showValue) {
      const v = formatValue(value.get());
      return label ? `${label} ${v}` : v;
    }
    return label ?? "";
  });

  const pillW = useDerivedValue(
    () => measureFontTextWidth(font, labelText.get()) + BADGE_PAD_X * 2,
  );
  // Left: flush to the canvas edge. Right: flush to the right plot edge.
  const pillX = useDerivedValue(() =>
    labelPosition === "right"
      ? engine.canvasWidth.get() - padding.right - BADGE_EDGE_INSET - pillW.get()
      : BADGE_EDGE_INSET,
  );
  const pillY = useDerivedValue(
    () => lineY.get() - baselineOffset + fontAscent - BADGE_PAD_Y,
  );
  const labelX = useDerivedValue(() => pillX.get() + BADGE_PAD_X);
  const labelY = useDerivedValue(() => lineY.get() - baselineOffset);

  // No label and no value → nothing to draw (hooks above still run, in order).
  if (label === undefined && !showValue) return null;

  return (
    <Group opacity={opacity}>
      <RoundedRect
        x={pillX}
        y={pillY}
        width={pillW}
        height={pillH}
        r={BADGE_RADIUS}
        color={badgeBackground}
      />
      <RoundedRect
        x={pillX}
        y={pillY}
        width={pillW}
        height={pillH}
        r={BADGE_RADIUS}
        color={badgeBorderColor}
        style="stroke"
        strokeWidth={1}
      />
      <SkiaText
        x={labelX}
        y={labelY}
        text={labelText}
        font={font}
        color={labelColor}
      />
    </Group>
  );
}
