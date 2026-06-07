import { Skia, type SkFont, type SkPath } from "@shopify/react-native-skia";
import { useRef } from "react";
import {
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import {
  BADGE_METRICS_DEFAULTS,
  MOTION_METRICS_DEFAULTS,
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
import type {
  BadgeMetrics,
  BadgeVariant,
  LiveChartPalette,
  Momentum,
} from "../types";

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
  badgeMetrics: BadgeMetrics = BADGE_METRICS_DEFAULTS,
  badgeColorSpeed: number = MOTION_METRICS_DEFAULTS.badgeColorSpeed,
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
  const cacheRef = useRef<{
    a: SkPath;
    b: SkPath;
    tick: boolean;
  } | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = {
      a: Skia.Path.Make(),
      b: Skia.Path.Make(),
      tick: false,
    };
  }

  const badge = useDerivedValue(() => {
    const cache = cacheRef.current!;
    const w = engine.canvasWidth.get();
    const h = engine.canvasHeight.get();
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
    const dMin = engine.displayMin.get();
    const dMax = engine.displayMax.get();
    const valRange = dMax - dMin;
    const dotY =
      valRange === 0
        ? padding.top + chartH / 2
        : padding.top +
          ((dMax - engine.displayValue.get()) / valRange) * chartH;

    const text = formatValue(engine.displayValue.get());
    const textW = measureFontTextWidth(font, text);

    const pillH = font.getSize() + badgeMetrics.padY * 2;
    const r = pillH / 2;
    const badgeY = dotY - pillH / 2;
    let textX: number;

    if (position === "left") {
      // Pill to the left of the live dot; no tail (`showTail` applies to right gutter only).
      const dotXPos = w - padding.right;
      const pillW = 2 * badgeMetrics.padX + textW;
      const bodyRight = dotXPos - badgeMetrics.dotGap;
      const bodyLeft = Math.max(badgeMetrics.marginEdge, bodyRight - pillW);
      const pillBodyW = bodyRight - bodyLeft;
      textX = (bodyLeft + bodyRight - textW) / 2;
      path.addRRect({
        rect: { x: bodyLeft, y: badgeY, width: pillBodyW, height: pillH },
        rx: r,
        ry: r,
      });
    } else {
      // Right-gutter badge (default): asymmetric layout with optional tail.
      const tl = badgeTailAndCap(font.getSize(), showTail, badgeMetrics);
      const bodyLeft = w - padding.right + badgeMetrics.dotGap + tl;
      const bodyRight = w - badgeMetrics.marginEdge;
      const pillW = bodyRight - bodyLeft;
      // Text centered in pill body — same formula used by GridOverlay.
      textX = pillTextLeftX(
        w,
        padding.right,
        badgeMetrics.dotGap + tl,
        textW,
        badgeMetrics,
      );

      if (showTail) {
        const badgeX = w - padding.right + badgeMetrics.dotGap;
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
          badgeX + badgeMetrics.tailLength + 2,
          badgeY + pillH,
          badgeX + 3,
          badgeY + r + badgeMetrics.tailSpread,
          badgeX,
          badgeY + r,
        );
        path.cubicTo(
          badgeX + 3,
          badgeY + r - badgeMetrics.tailSpread,
          badgeX + badgeMetrics.tailLength + 2,
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
      const m = momentum.get();
      const targetRgb = m === "up" ? upRgb : m === "down" ? downRgb : accentRgb;
      colorR.set(
        lerp(colorR.get(), targetRgb[0], badgeColorSpeed, MS_PER_FRAME_60FPS),
      );
      colorG.set(
        lerp(colorG.get(), targetRgb[1], badgeColorSpeed, MS_PER_FRAME_60FPS),
      );
      colorB.set(
        lerp(colorB.get(), targetRgb[2], badgeColorSpeed, MS_PER_FRAME_60FPS),
      );
      bgColor = lerpColor(
        [colorR.get(), colorG.get(), colorB.get()],
        [colorR.get(), colorG.get(), colorB.get()],
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
