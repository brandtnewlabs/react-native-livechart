import {
  Group,
  LinearGradient,
  Path,
  Rect,
  RoundedRect,
  Skia,
  Text as SkiaText,
  vec,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import {
  BADGE_DOT_GAP,
  EMPTY_GAP_FADE_WIDTH,
  EMPTY_STATE_LABEL_ALPHA,
  EMPTY_TEXT_GAP_PAD,
} from "../constants";
import {
  badgeTailAndCap,
  gutterCenteredTextLeftX,
  pillTextLeftX,
  type ChartPadding,
} from "../draw/line";
import { drawSpline } from "../math/spline";
import { buildSquigglyPts } from "../math/squiggly";
import type { LiveChartPalette } from "../types";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";

const PLACEHOLDER_LABEL_COUNT = 4;
const RECT_W = 16;
const RECT_H = 4;
const RECT_R = 4;
const RECT_SPACING = 32;

function buildSplinePath(pts: number[]) {
  "worklet";
  const path = Skia.Path.Make();
  const n = pts.length >> 1;
  if (n < 2) return path;
  path.moveTo(pts[0], pts[1]);
  drawSpline(path, pts);
  return path;
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
  /** Mirror the badge prop so labels align with GridOverlay's label positions. */
  badge?: boolean;
  /** Whether the badge tail spike is shown; affects the left inset used for skeleton alignment. */
  badgeTail?: boolean;
}) {
  // Same left-inset formula as GridOverlay (only used when badge=true)
  const leftInset = BADGE_DOT_GAP + badgeTailAndCap(font.getSize(), badgeTail);
  // Squiggly path — animated each frame via timestamp
  const squigglyPath = useDerivedValue(() => {
    if (!isLoading.value && !isEmpty.value && morphT.value >= 1) {
      return Skia.Path.Make();
    }
    const pts = buildSquigglyPts(
      engine.canvasWidth.value,
      engine.canvasHeight.value,
      padding,
      engine.timestamp.value,
    );
    return buildSplinePath(pts);
  });

  // Fades out quickly as the reveal animation begins (first 33% of morphT)
  const groupOpacity = useDerivedValue(() => {
    if (!isLoading.value && !isEmpty.value) {
      return Math.max(0, 1 - morphT.value * 3);
    }
    return 1;
  });

  // Placeholder Y-axis rects: skeleton pills centred in the right gutter
  const labelLayout = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    const h = engine.canvasHeight.value;
    if (w === 0 || h === 0) {
      return { x: -200, ys: [0, 0, 0, 0] as [number, number, number, number] };
    }
    const chartH = h - padding.top - padding.bottom;
    // Mirror GridOverlay: pillTextLeftX when badge is on, gutterCenteredTextLeftX otherwise
    const x = badge
      ? pillTextLeftX(w, padding.right, leftInset, RECT_W)
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
  const lx = useDerivedValue(() => labelLayout.value.x);
  const ly0 = useDerivedValue(() => labelLayout.value.ys[0]);
  const ly1 = useDerivedValue(() => labelLayout.value.ys[1]);
  const ly2 = useDerivedValue(() => labelLayout.value.ys[2]);
  const ly3 = useDerivedValue(() => labelLayout.value.ys[3]);

  // Empty-state text + gradient gap
  const emptyGapLayout = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    const h = engine.canvasHeight.value;
    if (w === 0 || h === 0) {
      return {
        gapLeft: 0,
        gapRight: 0,
        centerY: 0,
        eraseH: 0,
        fadeW: EMPTY_GAP_FADE_WIDTH,
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
    const gapHalf = textW / 2 + EMPTY_TEXT_GAP_PAD;
    const fadeW = EMPTY_GAP_FADE_WIDTH;
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

  const gapLeft = useDerivedValue(() => emptyGapLayout.value.gapLeft);
  const gapTop = useDerivedValue(
    () => emptyGapLayout.value.centerY - emptyGapLayout.value.eraseH / 2,
  );
  const gapWidth = useDerivedValue(
    () => emptyGapLayout.value.gapRight - emptyGapLayout.value.gapLeft,
  );
  const gapHeight = useDerivedValue(() => emptyGapLayout.value.eraseH);
  const emptyTextX = useDerivedValue(() => emptyGapLayout.value.textX);
  const emptyTextY = useDerivedValue(() => emptyGapLayout.value.textY);
  const showGapGroup = useDerivedValue(() => emptyGapLayout.value.showGap);

  const gapGradientPositions = useDerivedValue(() => {
    const L = emptyGapLayout.value.gapRight - emptyGapLayout.value.gapLeft;
    const fw = emptyGapLayout.value.fadeW;
    if (L <= 0) return [0, 0, 1, 1] as number[];
    const t1 = Math.min(fw / L, 0.49);
    const t2 = Math.max(1 - fw / L, 0.51);
    return [0, t1, t2, 1];
  });

  const gapGradEnd = useDerivedValue(() =>
    vec(
      Math.max(1, emptyGapLayout.value.gapRight - emptyGapLayout.value.gapLeft),
      0,
    ),
  );

  const emptyLabelText = useDerivedValue(() =>
    isEmpty.value ? emptyText : "",
  );
  const emptyLabelOpacity = useDerivedValue(() =>
    isEmpty.value ? EMPTY_STATE_LABEL_ALPHA : 0,
  );

  return (
    <Group opacity={groupOpacity}>
      {/* Squiggly loading line */}
      <Path
        path={squigglyPath}
        style="stroke"
        strokeWidth={strokeWidth}
        color={palette.gridLine}
        strokeCap="round"
        strokeJoin="round"
      />

      {/* Erase a soft horizontal band through the squiggle for the label (dstOut) */}
      <Group opacity={showGapGroup} blendMode="dstOut">
        <Rect x={gapLeft} y={gapTop} width={gapWidth} height={gapHeight}>
          <LinearGradient
            start={vec(0, 0)}
            end={gapGradEnd}
            colors={[
              "rgba(0,0,0,0)",
              "rgba(0,0,0,1)",
              "rgba(0,0,0,1)",
              "rgba(0,0,0,0)",
            ]}
            positions={gapGradientPositions}
          />
        </Rect>
      </Group>

      {/* Skeleton Y-axis label placeholders */}
      <RoundedRect
        x={lx}
        y={ly0}
        width={RECT_W}
        height={RECT_H}
        r={RECT_R}
        color={palette.gridLine}
      />
      <RoundedRect
        x={lx}
        y={ly1}
        width={RECT_W}
        height={RECT_H}
        r={RECT_R}
        color={palette.gridLine}
      />
      <RoundedRect
        x={lx}
        y={ly2}
        width={RECT_W}
        height={RECT_H}
        r={RECT_R}
        color={palette.gridLine}
      />
      <RoundedRect
        x={lx}
        y={ly3}
        width={RECT_W}
        height={RECT_H}
        r={RECT_R}
        color={palette.gridLine}
      />

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
