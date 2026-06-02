import { Skia, type SkFont } from "@shopify/react-native-skia";
import { useMemo } from "react";
import {
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import {
  BADGE_DOT_GAP,
  BADGE_MARGIN_RIGHT,
  BADGE_PILL_PAD_X,
  BADGE_PILL_PAD_Y,
  BADGE_TAIL_LEN,
  MS_PER_FRAME_60FPS,
} from "../constants";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import type { ChartEngineWithLiveValue } from "../core/useLiveChartEngine";
import {
  badgeTailAndCap,
  pillTextLeftX,
  type ChartPadding,
} from "../draw/line";
import { hexToRgb, lerpColor } from "../math/color";
import { lerp } from "../math/lerp";
import type { BadgeVariant, LiveChartPalette, Momentum } from "../types";

const TAIL_SPREAD = 2.5;

export function useBadge(
  engine: ChartEngineWithLiveValue,
  padding: ChartPadding,
  palette: LiveChartPalette,
  formatValue: (v: number) => string,
  font: SkFont,
  variant: BadgeVariant = "default",
  showTail = true,
  momentum?: SharedValue<Momentum>,
  position: "right" | "left" = "right",
  background?: string,
) {
  const colorR = useSharedValue(0);
  const colorG = useSharedValue(0);
  const colorB = useSharedValue(0);

  const upRgb = hexToRgb(palette.dotUp);
  const downRgb = hexToRgb(palette.dotDown);
  const accentRgb = hexToRgb(palette.badgeBg);

  // Ping-pong between two persistent badge paths so the derived value always
  // returns a freshly-mutated SkPath without allocating a new one every frame.
  // See useChartPaths for the full rationale on per-frame Skia.Path.Make().
  const cache = useMemo(
    () => ({
      a: Skia.Path.Make(),
      b: Skia.Path.Make(),
      tick: false,
    }),
    [],
  );

  const badge = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    const h = engine.canvasHeight.value;
    cache.tick = !cache.tick;
    const path = cache.tick ? cache.a : cache.b;
    path.reset();
    if (w === 0 || h === 0) {
      return {
        path,
        textX: 0,
        textY: 0,
        text: "",
        bgColor: palette.badgeBg,
        textColor: palette.badgeText,
      };
    }

    const chartH = h - padding.top - padding.bottom;
    const dMin = engine.displayMin.value;
    const dMax = engine.displayMax.value;
    const valRange = dMax - dMin;
    const dotY =
      valRange === 0
        ? padding.top + chartH / 2
        : padding.top +
          ((dMax - engine.displayValue.value) / valRange) * chartH;

    const text = formatValue(engine.displayValue.value);
    const textW = measureFontTextWidth(font, text);

    const pillH = font.getSize() + BADGE_PILL_PAD_Y * 2;
    const r = pillH / 2;
    const badgeY = dotY - pillH / 2;
    let textX: number;

    if (position === "left") {
      // Pill to the left of the live dot; no tail (`showTail` applies to right gutter only).
      const dotXPos = w - padding.right;
      const pillW = 2 * BADGE_PILL_PAD_X + textW;
      const bodyRight = dotXPos - BADGE_DOT_GAP;
      const bodyLeft = Math.max(BADGE_MARGIN_RIGHT, bodyRight - pillW);
      const pillBodyW = bodyRight - bodyLeft;
      textX = (bodyLeft + bodyRight - textW) / 2;
      path.addRRect({
        rect: { x: bodyLeft, y: badgeY, width: pillBodyW, height: pillH },
        rx: r,
        ry: r,
      });
    } else {
      // Right-gutter badge (default): asymmetric layout with optional tail.
      const tl = badgeTailAndCap(font.getSize(), showTail);
      const bodyLeft = w - padding.right + BADGE_DOT_GAP + tl;
      const bodyRight = w - BADGE_MARGIN_RIGHT;
      const pillW = bodyRight - bodyLeft;
      // Text centered in pill body — same formula used by GridOverlay.
      textX = pillTextLeftX(w, padding.right, BADGE_DOT_GAP + tl, textW);

      if (showTail) {
        const badgeX = w - padding.right + BADGE_DOT_GAP;
        const cx = tl + pillW - r;

        path.moveTo(badgeX + tl, badgeY);
        path.lineTo(badgeX + cx, badgeY);
        path.arcToOval(
          { x: badgeX + cx - r, y: badgeY, width: r * 2, height: pillH },
          -90,
          180,
          false,
        );
        path.lineTo(badgeX + tl, badgeY + pillH);
        path.cubicTo(
          badgeX + BADGE_TAIL_LEN + 2,
          badgeY + pillH,
          badgeX + 3,
          badgeY + r + TAIL_SPREAD,
          badgeX,
          badgeY + r,
        );
        path.cubicTo(
          badgeX + 3,
          badgeY + r - TAIL_SPREAD,
          badgeX + BADGE_TAIL_LEN + 2,
          badgeY,
          badgeX + tl,
          badgeY,
        );
        path.close();
      } else {
        path.addRRect({
          rect: { x: bodyLeft, y: badgeY, width: pillW, height: pillH },
          rx: r,
          ry: r,
        });
      }
    }

    const fm = font.getMetrics();
    const textY = dotY - (fm.ascent + fm.descent) / 2;

    let bgColor: string;
    if (background) {
      bgColor = background;
    } else if (variant === "minimal") {
      bgColor = "rgba(255,255,255,0.95)";
    } else if (momentum) {
      const m = momentum.value;
      const targetRgb = m === "up" ? upRgb : m === "down" ? downRgb : accentRgb;
      colorR.value = lerp(colorR.value, targetRgb[0], 0.08, MS_PER_FRAME_60FPS);
      colorG.value = lerp(colorG.value, targetRgb[1], 0.08, MS_PER_FRAME_60FPS);
      colorB.value = lerp(colorB.value, targetRgb[2], 0.08, MS_PER_FRAME_60FPS);
      bgColor = lerpColor(
        [colorR.value, colorG.value, colorB.value],
        [colorR.value, colorG.value, colorB.value],
        0,
      );
    } else {
      bgColor = palette.badgeBg;
    }

    const textColor =
      variant === "minimal" ? "rgba(100,100,100,1)" : palette.badgeText;

    return { path, textX, textY, text, bgColor, textColor };
  });

  return badge;
}
