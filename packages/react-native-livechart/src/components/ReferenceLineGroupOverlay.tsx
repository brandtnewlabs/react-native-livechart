import {
  Group,
  RoundedRect,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartPadding } from "../draw/line";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import type { ReferenceGrouping } from "../math/referenceGroup";
import type { LiveChartPalette } from "../types";

/** Max simultaneous group handles (a fixed Skia slot pool — the per-frame group
 *  count varies, so we draw a fixed set of slots and hide the unused ones). */
const MAX_GROUP_PILLS = 12;
/** Horizontal padding inside the count pill, in px. */
const PILL_PAD_X = 6;
/** Vertical padding inside the count pill, in px. */
const PILL_PAD_Y = 3;
/** Pill inset from the plot's left edge, in px. */
const EDGE_INSET = 2;
const PILL_RADIUS = 5;

interface PillLayout {
  visible: boolean;
  x: number;
  top: number;
  w: number;
  text: string;
  textX: number;
  textY: number;
}

const HIDDEN_PILL: PillLayout = {
  visible: false,
  x: 0,
  top: -1,
  w: 0,
  text: "",
  textX: 0,
  textY: -1,
};

/** One collapsed-group count pill (slot `index` of the fixed pool). Reads the
 *  cluster at `grouping.groups[index]`; hidden when fewer groups exist this frame. */
function GroupCountPill({
  grouping,
  index,
  padding,
  font,
  baselineOffset,
  pillH,
  color,
  background,
  textColor,
}: {
  grouping: SharedValue<ReferenceGrouping>;
  index: number;
  padding: ChartPadding;
  font: SkFont;
  baselineOffset: number;
  pillH: number;
  color: string;
  background: string;
  textColor: string;
}) {
  const layout = useDerivedValue<PillLayout>(() => {
    const gs = grouping.get().groups;
    if (index >= gs.length) return HIDDEN_PILL;
    const g = gs[index];
    const text = String(g.count);
    const w = measureFontTextWidth(font, text) + PILL_PAD_X * 2;
    const x = padding.left + EDGE_INSET;
    return {
      visible: true,
      x,
      top: g.cy - pillH / 2,
      w,
      text,
      textX: x + PILL_PAD_X,
      textY: g.cy - baselineOffset,
    };
  });

  const opacity = useDerivedValue(() => (layout.get().visible ? 1 : 0));
  const x = useDerivedValue(() => layout.get().x);
  const top = useDerivedValue(() => layout.get().top);
  const w = useDerivedValue(() => layout.get().w);
  const text = useDerivedValue(() => layout.get().text);
  const textX = useDerivedValue(() => layout.get().textX);
  const textY = useDerivedValue(() => layout.get().textY);

  return (
    <Group opacity={opacity}>
      <RoundedRect
        x={x}
        y={top}
        width={w}
        height={pillH}
        r={PILL_RADIUS}
        color={background}
      />
      <RoundedRect
        x={x}
        y={top}
        width={w}
        height={pillH}
        r={PILL_RADIUS}
        color={color}
        style="stroke"
        strokeWidth={1}
      />
      <SkiaText x={textX} y={textY} text={text} font={font} color={textColor} />
    </Group>
  );
}

/**
 * Draws the collapsed-group count handles (e.g. a "×3" pill) for reference-line
 * grouping — one pill per multi-line cluster, pinned to the plot's left edge at the
 * cluster centroid. The individual tags of clustered lines are suppressed upstream
 * (via `groupHidden`), so a stack of nearby orders reads as one handle. A fixed
 * slot pool keeps the Skia tree stable while the per-frame group count varies.
 */
export function ReferenceLineGroupOverlay({
  grouping,
  padding,
  palette,
  font,
}: {
  grouping: SharedValue<ReferenceGrouping>;
  padding: ChartPadding;
  palette: LiveChartPalette;
  font: SkFont;
}) {
  const fm = font.getMetrics();
  const baselineOffset = (fm.ascent + fm.descent) / 2;
  const pillH = fm.descent - fm.ascent + PILL_PAD_Y * 2;

  const slots: React.ReactElement[] = [];
  for (let i = 0; i < MAX_GROUP_PILLS; i++) {
    slots.push(
      <GroupCountPill
        key={i}
        grouping={grouping}
        index={i}
        padding={padding}
        font={font}
        baselineOffset={baselineOffset}
        pillH={pillH}
        color={palette.refLine}
        background={palette.tooltipBg}
        textColor={palette.refLabel}
      />,
    );
  }
  return <Group>{slots}</Group>;
}
