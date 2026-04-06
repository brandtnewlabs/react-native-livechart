import { Skia, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import type { ChartPadding } from "../draw/line";
import { lerp } from "../math/lerp";
import type { BadgeVariant, LivelinePalette } from "../types";
import type { EngineState } from "../useLivelineEngine";

const PAD_X = 10;
const PAD_Y = 3;
const TAIL_LEN = 5;
const TAIL_SPREAD = 2.5;

export function useBadge(
  engine: EngineState,
  padding: ChartPadding,
  palette: LivelinePalette,
  formatValue: (v: number) => string,
  font: SkFont,
  variant: BadgeVariant = "default",
  showTail = true,
) {
  const displayWidth = useSharedValue(60);

  const badge = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    const h = engine.canvasHeight.value;
    if (w === 0 || h === 0) {
      return {
        path: Skia.Path.Make(),
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
    const textW = font.getTextWidth(text);
    const targetWidth = textW + PAD_X * 2;

    displayWidth.value = lerp(displayWidth.value, targetWidth, 0.15, 16.67);
    const pillW = displayWidth.value;
    const pillH = font.getSize() + PAD_Y * 2;

    const tailLen = showTail ? TAIL_LEN : 0;
    const badgeX = w - padding.right + 4;
    const badgeY = dotY - pillH / 2;

    // Build pill + tail path
    const path = Skia.Path.Make();
    const r = pillH / 2;

    if (showTail) {
      const tl = tailLen + r;
      const cx = tailLen + pillW - r;

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
        badgeX + tailLen + 2,
        badgeY + pillH,
        badgeX + 3,
        badgeY + r + TAIL_SPREAD,
        badgeX,
        badgeY + r,
      );
      path.cubicTo(
        badgeX + 3,
        badgeY + r - TAIL_SPREAD,
        badgeX + tailLen + 2,
        badgeY,
        badgeX + tl,
        badgeY,
      );
      path.close();
    } else {
      path.addRRect({
        rect: {
          x: badgeX,
          y: badgeY,
          width: pillW,
          height: pillH,
        },
        rx: r,
        ry: r,
      });
    }

    const textX = badgeX + tailLen + (pillW - textW) / 2;
    const textY = badgeY + pillH / 2 + font.getSize() / 2 - 1;

    const bgColor =
      variant === "minimal" ? "rgba(255,255,255,0.95)" : palette.badgeBg;
    const textColor =
      variant === "minimal" ? "rgba(100,100,100,1)" : palette.badgeText;

    return { path, textX, textY, text, bgColor, textColor };
  });

  return badge;
}
