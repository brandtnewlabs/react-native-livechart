import {
  DashPathEffect,
  Group,
  Path,
  type SkFont,
  type SkPath,
} from "react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { X_AXIS_LABEL_OFFSET_Y } from "../constants";
import type { ResolvedGridStyleConfig } from "../core/resolveConfig";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import type { XAxisEntry } from "../hooks/useXAxis";
import { usePathBuilder } from "../hooks/usePathBuilder";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import type { LiveChartPalette } from "../types";
import { AnimatedLabel } from "./AnimatedLabel";

const MAX_X_LABELS = 10;
const TICK_HEIGHT = 5;
const LABEL_OFFSET_Y = X_AXIS_LABEL_OFFSET_Y;

export function XAxisOverlay({
  entries,
  engine,
  padding,
  palette,
  font,
  volumeBandHeight = 0,
}: {
  entries: SharedValue<XAxisEntry[]>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LiveChartPalette;
  font: SkFont;
  /**
   * Reserved volume-band height (px) folded into `padding.bottom`. The axis line
   * + labels shift back down by this so they stay at the very bottom, below the
   * band, while the price plot above shrinks. `0` = no band (default).
   */
  volumeBandHeight?: number;
}) {
  const axisBuilder = usePathBuilder();

  const axisPath = useDerivedValue(() => {
    "worklet";
    const b = axisBuilder.value;
    const w = engine.canvasWidth.get();
    const h = engine.canvasHeight.get();
    const lineY = h - padding.bottom + volumeBandHeight;

    // Bottom axis line
    b.moveTo(padding.left, lineY);
    b.lineTo(w - padding.right, lineY);

    // Tick marks
    const items = entries.get();
    for (let i = 0; i < items.length; i++) {
      b.moveTo(items[i].x, lineY);
      b.lineTo(items[i].x, lineY + TICK_HEIGHT);
    }
    return b.detach();
  });

  // Transform XAxisEntry[] into { x, y, label, alpha } for AnimatedLabel
  const labelEntries = useDerivedValue(() => {
    "worklet";
    const items = entries.get();
    const h = engine.canvasHeight.get();
    const y = h - padding.bottom + volumeBandHeight + LABEL_OFFSET_Y;
    const n = items.length;
    const out: { x: number; y: number; label: string; alpha: number }[] = [];
    for (let i = 0; i < n; i++) {
      const e = items[i];
      out.push({
        x: e.x - measureFontTextWidth(font, e.label) / 2,
        y,
        label: e.label,
        alpha: e.alpha,
      });
    }
    return out;
  });

  return (
    <Group>
      <Path
        path={axisPath}
        style="stroke"
        strokeWidth={1}
        color={palette.gridLine}
      />
      {Array.from({ length: MAX_X_LABELS }, (_, i) => (
        <AnimatedLabel
          key={i}
          entries={labelEntries}
          index={i}
          font={font}
          color={palette.timeLabel}
        />
      ))}
    </Group>
  );
}

/**
 * Vertical grid lines at the time-axis ticks (`xAxis.gridLines`). The chart
 * draws this behind the series, in the horizontal grid's layer; the axis line,
 * ticks, and labels stay in {@link XAxisOverlay} above it. One pooled line per
 * label slot, so each line fades with its label instead of popping in at the
 * plot edges.
 */
export function XAxisGridLines({
  entries,
  engine,
  padding,
  palette,
  gridStyle,
  volumeBandHeight = 0,
}: {
  entries: SharedValue<XAxisEntry[]>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LiveChartPalette;
  gridStyle: ResolvedGridStyleConfig;
  /** Reserved volume-band height (px); the lines run through it to the axis line. */
  volumeBandHeight?: number;
}) {
  const segmentBuilder = usePathBuilder();
  // Capturing the whole engine subscribes this immutable segment to its live
  // clock/range too. Only layout changes should allocate a new segment path.
  const { canvasWidth, canvasHeight } = engine;
  const { left, right, top, bottom } = padding;

  // One vertical segment, from the plot top down to the axis line, shared by
  // the whole pool: each line only translates it to its tick.
  const segment = useDerivedValue(() => {
    "worklet";
    const b = segmentBuilder.value;
    b.moveTo(0, top);
    b.lineTo(
      0,
      canvasHeight.get() - bottom + volumeBandHeight,
    );
    return b.detach();
  });

  // Fading ticks can remain just outside the plot. Keep their strokes out of
  // the axis gutters while retaining the full candle volume-band height.
  const clip = useDerivedValue(() => ({
    x: left,
    y: top,
    width: Math.max(0, canvasWidth.get() - left - right),
    height: Math.max(0, canvasHeight.get() - bottom + volumeBandHeight - top),
  }));

  return (
    <Group opacity={gridStyle.opacity} clip={clip}>
      {Array.from({ length: MAX_X_LABELS }, (_, i) => (
        <XAxisGridLine
          key={i}
          entries={entries}
          index={i}
          segment={segment}
          color={gridStyle.color ?? palette.gridLine}
          strokeWidth={gridStyle.strokeWidth}
          intervals={gridStyle.intervals}
        />
      ))}
    </Group>
  );
}

function XAxisGridLine({
  entries,
  index,
  segment,
  color,
  strokeWidth,
  intervals,
}: {
  entries: SharedValue<XAxisEntry[]>;
  index: number;
  segment: SharedValue<SkPath>;
  color: string;
  strokeWidth: number;
  intervals: number[];
}) {
  const transform = useDerivedValue(() => [
    { translateX: entries.get()[index]?.x ?? -200 },
  ]);
  const opacity = useDerivedValue(() => entries.get()[index]?.alpha ?? 0);
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={segment} style="stroke" strokeWidth={strokeWidth} color={color}>
        {intervals.length > 0 && <DashPathEffect intervals={intervals} />}
      </Path>
    </Group>
  );
}
