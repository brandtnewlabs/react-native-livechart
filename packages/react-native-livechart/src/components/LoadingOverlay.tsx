import {
  Group,
  LinearGradient,
  Path,
  Rect,
  RoundedRect,
  Text as SkiaText,
  vec,
  type SkFont,
} from "@shopify/react-native-skia";
import { useRef } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import {
  BADGE_METRICS_DEFAULTS,
  EMPTY_STATE_METRICS_DEFAULTS,
} from "../constants";
import {
  badgeTailAndCap,
  gutterCenteredTextLeftX,
  pillTextLeftX,
  type ChartPadding,
} from "../draw/line";
import {
  usePathBuilder,
  type ReanimatedPathBuilder,
} from "../hooks/usePathBuilder";
import { drawSpline } from "../math/spline";
import { buildSquigglyPts } from "../math/squiggly";
import type {
  BadgeMetrics,
  EmptyStateMetrics,
  LiveChartPalette,
} from "../types";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";

const PLACEHOLDER_LABEL_COUNT = 4;
const RECT_W = 16;
const RECT_H = 4;
const RECT_R = 4;
const RECT_SPACING = 32;

function buildSplineDetached(b: ReanimatedPathBuilder, pts: number[]) {
  "worklet";
  const n = pts.length >> 1;
  if (n >= 2) {
    b.moveTo(pts[0], pts[1]);
    drawSpline(b, pts);
  }
  return b.detach();
}

export function LoadingOverlay({
  engine,
  padding,
  palette,
  font,
  morphT,
  isLoading,
  isEmpty,
  emptyText,
  strokeWidth,
  badge = false,
  badgeTail = true,
  badgeMetrics = BADGE_METRICS_DEFAULTS,
  emptyMetrics = EMPTY_STATE_METRICS_DEFAULTS,
  showAxisLabels = true,
  lineColor,
  lineStrokeWidth,
  waveAmplitude = 14,
  waveSpeed = 1,
  opaqueCanvas = false,
}: {
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LiveChartPalette;
  font: SkFont;
  morphT: SharedValue<number>;
  isLoading: SharedValue<boolean>;
  /** Derived or shared; only `.value` is read on the UI thread. */
  isEmpty: SharedValue<boolean> | { value: boolean };
  emptyText: string;
  strokeWidth: number;
  /** Loading squiggle + skeleton color. Omit → theme `gridLine`. */
  lineColor?: string;
  /** Loading squiggle stroke width. Omit → `strokeWidth`. */
  lineStrokeWidth?: number;
  /** Breathing-wave base amplitude (px). */
  waveAmplitude?: number;
  /** Breathing-wave speed multiplier. */
  waveSpeed?: number;
  /** Paint the owned background instead of erasing destination alpha. */
  opaqueCanvas?: boolean;
  /** Mirror the badge prop so labels align with GridOverlay's label positions. */
  badge?: boolean;
  /** Whether the badge tail spike is shown; affects the left inset used for skeleton alignment. */
  badgeTail?: boolean;
  /** Badge pill geometry tokens (kept in sync with GridOverlay/useBadge). */
  badgeMetrics?: BadgeMetrics;
  /** Empty-state layout tokens. */
  emptyMetrics?: EmptyStateMetrics;
  /** Draw the skeleton Y-axis label placeholders. Default `true`. */
  showAxisLabels?: boolean;
}) {
  // Same left-inset formula as GridOverlay (only used when badge=true)
  const leftInset =
    badgeMetrics.dotGap +
    badgeTailAndCap(font.getSize(), badgeTail, badgeMetrics);

  // Loading-shell color (squiggle + skeleton placeholders) and squiggle stroke,
  // both overridable via `loading={{ color, strokeWidth }}`.
  const loadingColor = lineColor ?? palette.gridLine;
  const loadingStroke = lineStrokeWidth ?? strokeWidth;
  const [bgR, bgG, bgB] = palette.bgRgb;
  const gapMaskColors = opaqueCanvas
    ? [
        `rgba(${bgR},${bgG},${bgB},0)`,
        `rgb(${bgR},${bgG},${bgB})`,
        `rgb(${bgR},${bgG},${bgB})`,
        `rgba(${bgR},${bgG},${bgB},0)`,
      ]
    : ["rgba(0,0,0,0)", "rgba(0,0,0,1)", "rgba(0,0,0,1)", "rgba(0,0,0,0)"];

  // Squiggly path — built into a reused PathBuilder and detach()-ed each frame.
  const squigglyBuilder = usePathBuilder();
  const squigglyPtsRef = useRef<number[]>([]);

  // Squiggly path — animated each frame via timestamp
  const squigglyPath = useDerivedValue(() => {
    const b = squigglyBuilder.value;
    if (!isLoading.get() && !isEmpty.value && morphT.get() >= 1) {
      return b.detach();
    }
    const pts = buildSquigglyPts(
      engine.canvasWidth.get(),
      engine.canvasHeight.get(),
      padding,
      engine.timestamp.get(),
      waveAmplitude,
      waveSpeed,
      squigglyPtsRef.current,
    );
    return buildSplineDetached(b, pts);
  });

  // Fades out quickly as the reveal animation begins (first 33% of morphT)
  const groupOpacity = useDerivedValue(() => {
    if (!isLoading.get() && !isEmpty.value) {
      return Math.max(0, 1 - morphT.get() * 3);
    }
    return 1;
  });

  // Placeholder Y-axis rects: skeleton pills centred in the right gutter
  const labelLayout = useDerivedValue(() => {
    const w = engine.canvasWidth.get();
    const h = engine.canvasHeight.get();
    if (w === 0 || h === 0) {
      return { x: -200, ys: [0, 0, 0, 0] as [number, number, number, number] };
    }
    const chartH = h - padding.top - padding.bottom;
    // Mirror GridOverlay: pillTextLeftX when badge is on, gutterCenteredTextLeftX otherwise
    const x = badge
      ? pillTextLeftX(w, padding.right, leftInset, RECT_W, badgeMetrics)
      : gutterCenteredTextLeftX(w, padding.right, RECT_W);
    // Centre the group of rects around the chart's vertical midpoint
    const groupH = (PLACEHOLDER_LABEL_COUNT - 1) * RECT_SPACING;
    const groupStartCY = padding.top + chartH / 2 - groupH / 2;
    const ys: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < PLACEHOLDER_LABEL_COUNT; i++) {
      const rowCenterY = groupStartCY + i * RECT_SPACING;
      ys[i] = rowCenterY - RECT_H / 2; // top of rect so center lands on rowCenterY
    }
    return { x, ys };
  });

  // X and Y positions for the placeholder rects
  const lx = useDerivedValue(() => labelLayout.get().x);
  const ly0 = useDerivedValue(() => labelLayout.get().ys[0]);
  const ly1 = useDerivedValue(() => labelLayout.get().ys[1]);
  const ly2 = useDerivedValue(() => labelLayout.get().ys[2]);
  const ly3 = useDerivedValue(() => labelLayout.get().ys[3]);

  // Empty-state text + gradient gap
  const emptyGapLayout = useDerivedValue(() => {
    const w = engine.canvasWidth.get();
    const h = engine.canvasHeight.get();
    if (w === 0 || h === 0) {
      return {
        gapLeft: 0,
        gapRight: 0,
        centerY: 0,
        eraseH: 0,
        fadeW: emptyMetrics.gapFadeWidth,
        textX: 0,
        textY: 0,
        textW: 0,
        showGap: 0,
      };
    }
    const chartH = h - padding.top - padding.bottom;
    const centerY = padding.top + chartH / 2;
    const chartCentreX = (padding.left + w - padding.right) / 2;
    const textW = font.measureText(emptyText).width;
    const gapHalf = textW / 2 + emptyMetrics.gapPad;
    const fadeW = emptyMetrics.gapFadeWidth;
    const gapLeft = chartCentreX - gapHalf - fadeW;
    const gapRight = chartCentreX + gapHalf + fadeW;
    const eraseH = Math.max(56, chartH * 0.28) + strokeWidth;
    const fm = font.getMetrics();
    const textX = chartCentreX - textW / 2;
    const textY = centerY - (fm.ascent + fm.descent) / 2;
    return {
      gapLeft,
      gapRight,
      centerY,
      eraseH,
      fadeW,
      textX,
      textY,
      textW,
      showGap: isEmpty.value ? 1 : 0,
    };
  });

  const gapLeft = useDerivedValue(() => emptyGapLayout.get().gapLeft);
  const gapTop = useDerivedValue(
    () => emptyGapLayout.get().centerY - emptyGapLayout.get().eraseH / 2,
  );
  const gapWidth = useDerivedValue(
    () => emptyGapLayout.get().gapRight - emptyGapLayout.get().gapLeft,
  );
  const gapHeight = useDerivedValue(() => emptyGapLayout.get().eraseH);
  const emptyTextX = useDerivedValue(() => emptyGapLayout.get().textX);
  const emptyTextY = useDerivedValue(() => emptyGapLayout.get().textY);
  const showGapGroup = useDerivedValue(() => emptyGapLayout.get().showGap);

  const gapGradientPositions = useDerivedValue(() => {
    const L = emptyGapLayout.get().gapRight - emptyGapLayout.get().gapLeft;
    const fw = emptyGapLayout.get().fadeW;
    if (L <= 0) return [0, 0, 1, 1] as number[];
    const t1 = Math.min(fw / L, 0.49);
    const t2 = Math.max(1 - fw / L, 0.51);
    return [0, t1, t2, 1];
  });

  const gapGradEnd = useDerivedValue(() =>
    vec(
      Math.max(1, emptyGapLayout.get().gapRight - emptyGapLayout.get().gapLeft),
      0,
    ),
  );

  const emptyLabelText = useDerivedValue(() =>
    isEmpty.value ? emptyText : "",
  );
  const emptyLabelOpacity = useDerivedValue(() =>
    isEmpty.value ? emptyMetrics.labelOpacity : 0,
  );

  return (
    <Group opacity={groupOpacity}>
      {/* Squiggly loading line */}
      <Path
        path={squigglyPath}
        style="stroke"
        strokeWidth={loadingStroke}
        color={loadingColor}
        strokeCap="round"
        strokeJoin="round"
      />

      {/* Erase a soft horizontal band through the squiggle for the label (dstOut) */}
      <Group
        opacity={showGapGroup}
        blendMode={opaqueCanvas ? undefined : "dstOut"}
      >
        <Rect x={gapLeft} y={gapTop} width={gapWidth} height={gapHeight}>
          <LinearGradient
            start={vec(0, 0)}
            end={gapGradEnd}
            colors={gapMaskColors}
            positions={gapGradientPositions}
          />
        </Rect>
      </Group>

      {/* Skeleton Y-axis label placeholders */}
      {showAxisLabels ? (
        <>
          <RoundedRect
            x={lx}
            y={ly0}
            width={RECT_W}
            height={RECT_H}
            r={RECT_R}
            color={loadingColor}
          />
          <RoundedRect
            x={lx}
            y={ly1}
            width={RECT_W}
            height={RECT_H}
            r={RECT_R}
            color={loadingColor}
          />
          <RoundedRect
            x={lx}
            y={ly2}
            width={RECT_W}
            height={RECT_H}
            r={RECT_R}
            color={loadingColor}
          />
          <RoundedRect
            x={lx}
            y={ly3}
            width={RECT_W}
            height={RECT_H}
            r={RECT_R}
            color={loadingColor}
          />
        </>
      ) : null}

      {/* Empty state label */}
      <SkiaText
        x={emptyTextX}
        y={emptyTextY}
        text={emptyLabelText}
        font={font}
        color={palette.gridLabel}
        opacity={emptyLabelOpacity}
      />
    </Group>
  );
}
