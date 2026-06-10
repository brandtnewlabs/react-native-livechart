import {
  Circle,
  DashPathEffect,
  Group,
  Line,
  RoundedRect,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import type {
  ActionBadgeLayout,
  TimeBadgeLayout,
} from "../hooks/crosshairShared";
import type { LiveChartPalette } from "../types";

/**
 * Scrub-action ("order ticket") overlay: the locked reticle (a horizontal price
 * level line + a faint vertical line crossing at the reticle) and the right-gutter
 * action badge — a circular icon button + a separate price pill. All keyed off the
 * lock SharedValues, so it tracks the reticle on the UI thread without re-renders.
 *
 * Mounted by `LiveChart` **outside** the degen-shake group so the rendered badge
 * stays aligned with the (untransformed) tap hit-test in {@link useCrosshair}.
 * Visibility rides on a 0/1 opacity driven by `lockActive` (no React remount).
 */
export function ScrubActionOverlay({
  lockActive,
  lockX,
  lockY,
  actionBadge,
  timeBadge,
  engine,
  padding,
  palette,
  font,
  icon,
  lineColor,
  background,
  iconColor,
}: {
  lockActive: SharedValue<boolean>;
  lockX: SharedValue<number>;
  lockY: SharedValue<number>;
  actionBadge: SharedValue<ActionBadgeLayout>;
  timeBadge?: SharedValue<TimeBadgeLayout>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LiveChartPalette;
  font: SkFont;
  icon: string;
  lineColor?: string;
  background?: string;
  iconColor?: string;
}) {
  const opacity = useDerivedValue(() => (lockActive.value ? 1 : 0), [lockActive]);

  // Horizontal level line (the chosen price), full plot width.
  const hLeft = useDerivedValue(
    () => ({ x: padding.left, y: lockY.value }),
    [padding.left, lockY],
  );
  const hRight = useDerivedValue(
    () => ({ x: engine.canvasWidth.value - padding.right, y: lockY.value }),
    [engine.canvasWidth, padding.right, lockY],
  );

  // Faint vertical line at the reticle X, full plot height.
  const vTop = useDerivedValue(
    () => ({ x: lockX.value, y: padding.top }),
    [lockX, padding.top],
  );
  const vBottom = useDerivedValue(
    () => ({ x: lockX.value, y: engine.canvasHeight.value - padding.bottom }),
    [lockX, engine.canvasHeight, padding.bottom],
  );

  // Action badge — a circular icon button + a separate price pill (2px gap).
  // Center the icon by its *visual* bounds (not advance box) so a symbol like
  // "+" sits dead-center in the circle. The glyph bounds are constant, so measure
  // once and offset the per-frame circle center.
  const iconBounds = icon ? font.measureText(icon) : null;
  const iconOffX = iconBounds ? -iconBounds.x - iconBounds.width / 2 : 0;
  const iconOffY = iconBounds ? -iconBounds.y - iconBounds.height / 2 : 0;

  const iconOpacity = useDerivedValue(() =>
    actionBadge.value.hasIcon ? 1 : 0,
  );
  const iconCx = useDerivedValue(() => actionBadge.value.iconCx);
  const iconCy = useDerivedValue(() => actionBadge.value.iconCy);
  const iconR = useDerivedValue(() => actionBadge.value.iconR);
  const iconGlyphX = useDerivedValue(() => actionBadge.value.iconCx + iconOffX);
  const iconGlyphY = useDerivedValue(() => actionBadge.value.iconCy + iconOffY);

  const priceOpacity = useDerivedValue(() =>
    actionBadge.value.hasPrice ? 1 : 0,
  );
  const priceX = useDerivedValue(() => actionBadge.value.priceX);
  const priceY = useDerivedValue(() => actionBadge.value.priceY);
  const priceW = useDerivedValue(() => actionBadge.value.priceW);
  const priceH = useDerivedValue(() => actionBadge.value.priceH);
  const priceR = useDerivedValue(() => actionBadge.value.priceH / 2);
  const priceTextX = useDerivedValue(() => actionBadge.value.priceTextX);
  const priceText = useDerivedValue(() => actionBadge.value.priceText);

  const textY = useDerivedValue(() => actionBadge.value.textY);

  // X-axis time pill (opt-in). `timeBadge` may be omitted; default to hidden.
  const tb = timeBadge;
  const timeOpacity = useDerivedValue(() => (tb?.value.visible ? 1 : 0), [tb]);
  const timeX = useDerivedValue(() => tb?.value.x ?? -400, [tb]);
  const timeY = useDerivedValue(() => tb?.value.y ?? 0, [tb]);
  const timeW = useDerivedValue(() => tb?.value.w ?? 0, [tb]);
  const timeH = useDerivedValue(() => tb?.value.h ?? 0, [tb]);
  const timeR = useDerivedValue(() => (tb?.value.h ?? 0) / 2, [tb]);
  const timeTextX = useDerivedValue(() => tb?.value.textX ?? -400, [tb]);
  const timeTextY = useDerivedValue(() => tb?.value.textY ?? 0, [tb]);
  const timeText = useDerivedValue(() => tb?.value.timeText ?? "", [tb]);

  const levelColor = lineColor ?? palette.crosshairLine;
  const pillColor = background ?? palette.badgeBg;
  const labelColor = iconColor ?? palette.badgeText;

  return (
    <Group opacity={opacity}>
      <Line p1={hLeft} p2={hRight} color={levelColor} strokeWidth={1}>
        <DashPathEffect intervals={[4, 4]} />
      </Line>
      <Line p1={vTop} p2={vBottom} color={levelColor} strokeWidth={1}>
        <DashPathEffect intervals={[2, 4]} />
      </Line>

      {/* Circular icon button (the action). */}
      <Group opacity={iconOpacity}>
        <Circle cx={iconCx} cy={iconCy} r={iconR} color={pillColor} />
        <SkiaText
          x={iconGlyphX}
          y={iconGlyphY}
          text={icon}
          font={font}
          color={labelColor}
        />
      </Group>

      {/* Price pill (capsule). */}
      <Group opacity={priceOpacity}>
        <RoundedRect
          x={priceX}
          y={priceY}
          width={priceW}
          height={priceH}
          r={priceR}
          color={pillColor}
        />
        <SkiaText
          x={priceTextX}
          y={textY}
          text={priceText}
          font={font}
          color={labelColor}
        />
      </Group>

      {/* X-axis time pill (capsule) where the vertical line meets the axis. */}
      <Group opacity={timeOpacity}>
        <RoundedRect
          x={timeX}
          y={timeY}
          width={timeW}
          height={timeH}
          r={timeR}
          color={pillColor}
        />
        <SkiaText
          x={timeTextX}
          y={timeTextY}
          text={timeText}
          font={font}
          color={labelColor}
        />
      </Group>
    </Group>
  );
}
