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
}: {
  badge: SharedValue<BadgeData>;
  font: SkFont;
}) {
  const badgePath = useDerivedValue(() => badge.value.path);
  const bgColor = useDerivedValue(() => badge.value.bgColor);
  const textX = useDerivedValue(() => badge.value.textX);
  const textY = useDerivedValue(() => badge.value.textY);
  const text = useDerivedValue(() => badge.value.text);
  const textColor = useDerivedValue(() => badge.value.textColor);

  return (
    <Group>
      <Path path={badgePath} style="fill" color={bgColor} />
      <SkiaText x={textX} y={textY} text={text} font={font} color={textColor} />
    </Group>
  );
}
