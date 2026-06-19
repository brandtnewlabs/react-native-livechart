import {
  Group,
  Path,
  Text as SkiaText,
  type SkFont,
  type SkPath,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

interface BadgeData {
  path: SkPath;
  textX: number;
  textY: number;
  text: string;
  bgColor: string;
  textColor: string;
}

export function BadgeOverlay({
  badge,
  font,
  borderColor,
  borderWidth = 1,
  offsetX = 0,
  offsetY = 0,
}: {
  badge: SharedValue<BadgeData>;
  font: SkFont;
  /** Pill border color. When unset, no border is drawn. */
  borderColor?: string;
  /** Border stroke width (px) — only used when `borderColor` is set. */
  borderWidth?: number;
  /** Horizontal nudge from the badge's anchor (px). */
  offsetX?: number;
  /** Vertical nudge from the badge's anchor (px). */
  offsetY?: number;
}) {
  const badgePath = useDerivedValue(() => badge.value.path);
  const bgColor = useDerivedValue(() => badge.value.bgColor);
  const textX = useDerivedValue(() => badge.value.textX);
  const textY = useDerivedValue(() => badge.value.textY);
  const text = useDerivedValue(() => badge.value.text);
  const textColor = useDerivedValue(() => badge.value.textColor);

  const transform =
    offsetX !== 0 || offsetY !== 0
      ? [{ translateX: offsetX }, { translateY: offsetY }]
      : undefined;

  return (
    <Group transform={transform}>
      <Path path={badgePath} style="fill" color={bgColor} />
      {borderColor != null && (
        <Path
          path={badgePath}
          style="stroke"
          strokeWidth={borderWidth}
          color={borderColor}
        />
      )}
      <SkiaText x={textX} y={textY} text={text} font={font} color={textColor} />
    </Group>
  );
}
