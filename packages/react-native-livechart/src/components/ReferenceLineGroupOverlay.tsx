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
import type { ResolvedReferenceGroupBadge } from "../math/referenceLines";
import type { LiveChartPalette } from "../types";

/** Max simultaneous group handles (a fixed Skia slot pool — the per-frame group
 *  count varies, so we draw a fixed set of slots and hide the unused ones). */
const MAX_GROUP_PILLS = 12;
/** Horizontal padding inside the count pill, in px. */
const PILL_PAD_X = 6;
/** Vertical padding inside the count pill, in px. */
const PILL_PAD_Y = 3;
/** Pill inset from the anchored plot edge, in px. */
const EDGE_INSET = 2;

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
  canvasWidth,
  font,
  position,
  icon,
  showText,
  format,
  baselineOffset,
  pillH,
  radius,
  borderWidth,
  color,
  background,
  textColor,
}: {
  grouping: SharedValue<ReferenceGrouping>;
  index: number;
  padding: ChartPadding;
  canvasWidth: SharedValue<number>;
  font: SkFont;
  position: "left" | "center" | "right";
  icon: string;
  showText: boolean;
  format?: (count: number) => string;
  baselineOffset: number;
  pillH: number;
  radius: number;
  borderWidth: number;
  color: string;
  background: string;
  textColor: string;
}) {
  const layout = useDerivedValue<PillLayout>(() => {
    const gs = grouping.get().groups;
    if (index >= gs.length) return HIDDEN_PILL;
    const g = gs[index];
    const count = showText ? (format ? format(g.count) : String(g.count)) : "";
    const text = icon ? (count ? `${icon} ${count}` : icon) : count;
    const w = measureFontTextWidth(font, text) + PILL_PAD_X * 2;
    // Anchor the pill horizontally to the chosen plot edge (or center).
    const x1 = padding.left;
    const x2 = canvasWidth.get() - padding.right;
    let x: number;
    if (position === "right") x = x2 - EDGE_INSET - w;
    else if (position === "center") x = (x1 + x2) / 2 - w / 2;
    else x = x1 + EDGE_INSET;
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
        r={radius}
        color={background}
      />
      <RoundedRect
        x={x}
        y={top}
        width={w}
        height={pillH}
        r={radius}
        color={color}
        style="stroke"
        strokeWidth={borderWidth}
      />
      <SkiaText x={textX} y={textY} text={text} font={font} color={textColor} />
    </Group>
  );
}

/**
 * Draws the collapsed-group count handles (e.g. a "×3" pill) for reference-line
 * grouping — one pill per multi-line cluster, pinned to the plot at the cluster
 * centroid. The individual tags of clustered lines are suppressed upstream (via
 * `groupHidden`), so a stack of nearby orders reads as one handle. The pill uses the
 * same style/shape config as a per-line badge (`badge`): `position`, `icon`,
 * `text` (showText), `background` / `borderColor` / `borderWidth`, `radius` (corner),
 * `textColor`, per-badge `font`, and `offsetX` / `offsetY`; the `format` fn maps the
 * count to the label. A fixed slot pool keeps the Skia tree stable while the
 * per-frame group count varies.
 */
export function ReferenceLineGroupOverlay({
  grouping,
  padding,
  canvasWidth,
  palette,
  font,
  badge,
  format,
}: {
  grouping: SharedValue<ReferenceGrouping>;
  padding: ChartPadding;
  canvasWidth: SharedValue<number>;
  palette: LiveChartPalette;
  font: SkFont;
  badge: ResolvedReferenceGroupBadge;
  format?: (count: number) => string;
}) {
  const fm = font.getMetrics();
  const baselineOffset = (fm.ascent + fm.descent) / 2;
  const pillH = fm.descent - fm.ascent + PILL_PAD_Y * 2;

  // Theme defaults for the unset colors (mirrors the per-line badge resolution).
  const background = badge.background ?? palette.tooltipBg;
  const borderColor = badge.borderColor ?? palette.refLine;
  const textColor = badge.textColor ?? palette.refLabel;

  const transform =
    badge.offsetX !== 0 || badge.offsetY !== 0
      ? [{ translateX: badge.offsetX }, { translateY: badge.offsetY }]
      : undefined;

  const slots: React.ReactElement[] = [];
  for (let i = 0; i < MAX_GROUP_PILLS; i++) {
    slots.push(
      <GroupCountPill
        key={i}
        grouping={grouping}
        index={i}
        padding={padding}
        canvasWidth={canvasWidth}
        font={font}
        position={badge.position}
        icon={badge.icon}
        showText={badge.showText}
        format={format}
        baselineOffset={baselineOffset}
        pillH={pillH}
        radius={badge.radius}
        borderWidth={badge.borderWidth}
        color={borderColor}
        background={background}
        textColor={textColor}
      />,
    );
  }
  return <Group transform={transform}>{slots}</Group>;
}
