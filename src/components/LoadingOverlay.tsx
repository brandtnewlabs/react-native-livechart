import {
  Group,
  Path,
  RoundedRect,
  Skia,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { BADGE_DOT_GAP } from "../constants";
import {
  badgeTailAndCap,
  gutterCenteredTextLeftX,
  pillTextLeftX,
  type ChartPadding,
} from "../draw/line";
import { drawSpline } from "../math/spline";
import { buildSquigglyPts } from "../math/squiggly";
import type { LivelinePalette } from "../types";
import type { EngineState } from "../useLivelineEngine";

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
}: {
  engine: EngineState;
  padding: ChartPadding;
  palette: LivelinePalette;
  font: SkFont;
  morphT: SharedValue<number>;
  isLoading: SharedValue<boolean>;
  isEmpty: SharedValue<boolean>;
  emptyText: string;
  strokeWidth: number;
  /** Mirror the badge prop so labels align with GridOverlay's label positions. */
  badge?: boolean;
}) {
  // Same left-inset formula as GridOverlay (only used when badge=true)
  const leftInset = BADGE_DOT_GAP + badgeTailAndCap(font.getSize());
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

  // Empty-state text: centered in the chart area
  const emptyLayout = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    const h = engine.canvasHeight.value;
    if (w === 0 || h === 0) return { x: 0, y: 0 };
    const fm = font.getMetrics();
    const textW = font.measureText(emptyText).width;
    const chartCentreX = (padding.left + w - padding.right) / 2;
    const chartCentreY = (padding.top + h - padding.bottom) / 2;
    return {
      x: chartCentreX - textW / 2,
      y: chartCentreY - (fm.ascent + fm.descent) / 2,
    };
  });

  const emptyTextX = useDerivedValue(() => emptyLayout.value.x);
  const emptyTextY = useDerivedValue(() => emptyLayout.value.y);
  const showText = useDerivedValue(() => isEmpty.value);

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
        text={showText.value ? emptyText : ("" as unknown as string)}
        font={font}
        color={palette.gridLabel}
        opacity={showText as unknown as number}
      />
    </Group>
  );
}
