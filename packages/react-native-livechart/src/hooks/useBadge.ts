import { type SkFont } from "@shopify/react-native-skia";
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
import { usePathBuilder } from "./usePathBuilder";

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
  /**
   * Floating-axis mode: render a tail-less pill right-aligned at the canvas edge
   * (over a full-width plot) instead of inside a reserved right gutter. See
   * {@link YAxisConfig.float}.
   */
  float = false,
  /**
   * Smoothed value at the visible window's right edge (engine `edgeValue`). When
   * {@link followViewEdge} is set, the badge tracks this instead of the live value.
   */
  edgeValue?: SharedValue<number>,
  /** Track the visible window's right-edge price while scrolled back. */
  followViewEdge = false,
  /**
   * Pill corner radius in pixels. `undefined` → capsule (`pillHeight / 2`).
   * Clamped to `[0, pillHeight / 2]`. The pointed tail (right-gutter mode) keeps
   * anchoring on the vertical center regardless of this value.
   */
  radius?: number,
  /** Label text color override; falls back to the variant/theme rule. */
  textColorOverride?: string,
) {
  const colorR = useSharedValue(0);
  const colorG = useSharedValue(0);
  const colorB = useSharedValue(0);

  const upRgb = hexToRgb(palette.dotUp);
  const downRgb = hexToRgb(palette.dotDown);
  const accentRgb = hexToRgb(palette.badgeBg);

  // Pill path is built into a reused PathBuilder and finalized with detach()
  // each frame — a fresh immutable SkPath, no per-frame Skia.Path.Make().
  const badgeBuilder = usePathBuilder();

  const badge = useDerivedValue(() => {
    const b = badgeBuilder.value;
    const w = engine.canvasWidth.get();
    const h = engine.canvasHeight.get();
    if (w === 0 || h === 0) {
      return {
        path: b.detach(),
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
    // Follow the visible window's right-edge price while scrolled back, else the
    // live value (badge.followViewEdge). engine `edgeValue` already collapses to
    // the live value when not scrolled, so the live badge is unchanged.
    const liveVal =
      followViewEdge && edgeValue ? edgeValue.get() : engine.displayValue.get();
    const dotY =
      valRange === 0
        ? padding.top + chartH / 2
        : padding.top + ((dMax - liveVal) / valRange) * chartH;

    const text = formatValue(liveVal);
    const textW = measureFontTextWidth(font, text);

    const pillH = font.getSize() + badgeMetrics.padY * 2;
    // `midY` is the pill's vertical center (the tail anchors here); `capR` is the
    // corner radius — the capsule (midY) by default, or a clamped custom radius.
    const midY = pillH / 2;
    const capR = radius == null ? midY : Math.max(0, Math.min(radius, midY));
    const badgeY = dotY - pillH / 2;
    let textX: number;

    if (float) {
      // Floating price tag: a tail-less pill right-aligned at the canvas edge,
      // floating over the full-width plot (no reserved gutter). Its pill bg keeps
      // the live value readable over the candles.
      const pillW = 2 * badgeMetrics.padX + textW;
      const bodyRight = w - badgeMetrics.marginEdge;
      const bodyLeft = bodyRight - pillW;
      textX = (bodyLeft + bodyRight - textW) / 2;
      b.addRRect({
        rect: { x: bodyLeft, y: badgeY, width: pillW, height: pillH },
        rx: capR,
        ry: capR,
      });
    } else if (position === "left") {
      // Pill to the left of the live dot; no tail (`showTail` applies to right gutter only).
      const dotXPos = w - padding.right;
      const pillW = 2 * badgeMetrics.padX + textW;
      const bodyRight = dotXPos - badgeMetrics.dotGap;
      const bodyLeft = Math.max(badgeMetrics.marginEdge, bodyRight - pillW);
      const pillBodyW = bodyRight - bodyLeft;
      textX = (bodyLeft + bodyRight - textW) / 2;
      b.addRRect({
        rect: { x: bodyLeft, y: badgeY, width: pillBodyW, height: pillH },
        rx: capR,
        ry: capR,
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
        const bodyRightX = badgeX + tl + pillW;

        b.moveTo(badgeX + tl, badgeY);
        if (capR >= midY) {
          // Capsule cap: a single right-hand semicircle (the default badge).
          const cx = tl + pillW - capR;
          b.lineTo(badgeX + cx, badgeY);
          b.arcToOval(
            { x: badgeX + cx - capR, y: badgeY, width: capR * 2, height: pillH },
            -90,
            180,
            false,
          );
        } else {
          // Custom (smaller) corner radius: square body with rounded right corners.
          b.lineTo(bodyRightX - capR, badgeY);
          b.arcToOval(
            { x: bodyRightX - capR * 2, y: badgeY, width: capR * 2, height: capR * 2 },
            -90,
            90,
            false,
          );
          b.lineTo(bodyRightX, badgeY + pillH - capR);
          b.arcToOval(
            {
              x: bodyRightX - capR * 2,
              y: badgeY + pillH - capR * 2,
              width: capR * 2,
              height: capR * 2,
            },
            0,
            90,
            false,
          );
        }
        b.lineTo(badgeX + tl, badgeY + pillH);
        // Tail tip stays on the vertical center (`midY`) regardless of corner radius.
        b.cubicTo(
          badgeX + badgeMetrics.tailLength + 2,
          badgeY + pillH,
          badgeX + 3,
          badgeY + midY + badgeMetrics.tailSpread,
          badgeX,
          badgeY + midY,
        );
        b.cubicTo(
          badgeX + 3,
          badgeY + midY - badgeMetrics.tailSpread,
          badgeX + badgeMetrics.tailLength + 2,
          badgeY,
          badgeX + tl,
          badgeY,
        );
        b.close();
      } else {
        b.addRRect({
          rect: { x: bodyLeft, y: badgeY, width: pillW, height: pillH },
          rx: capR,
          ry: capR,
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
      textColorOverride ??
      (variant === "minimal" ? "rgba(100,100,100,1)" : palette.badgeText);

    return { path: b.detach(), textX, textY, text, bgColor, textColor };
  });

  return badge;
}
