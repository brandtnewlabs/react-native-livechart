import {
  Group,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

interface LabelEntry {
  x: number;
  y: number;
  label: string;
  alpha: number;
}

/**
 * A single pre-allocated text label driven by a shared value array.
 * Reads the entry at `index` — positioned off-screen when the index
 * exceeds the array length.
 */
export function AnimatedLabel({
  entries,
  index,
  font,
  color,
}: {
  entries: SharedValue<LabelEntry[]>;
  index: number;
  font: SkFont;
  color: string;
}) {
  const x = useDerivedValue(() => entries.value[index]?.x ?? -200);
  const y = useDerivedValue(() => entries.value[index]?.y ?? -200);
  const text = useDerivedValue(() => entries.value[index]?.label ?? " ");
  const opacity = useDerivedValue(() => entries.value[index]?.alpha ?? 0);

  return (
    <Group opacity={opacity}>
      <SkiaText x={x} y={y} text={text} font={font} color={color} />
    </Group>
  );
}
