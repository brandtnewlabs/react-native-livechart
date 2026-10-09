import type { ReferenceTagStack } from "../math/referenceTagStack";
import {
  Group,
  Path,
  RoundedRect,
  Text,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { ReferenceLineLayout } from "../hooks/useReferenceLine";
import { usePathBuilder } from "../hooks/usePathBuilder";
import type { LiveChartPalette, ReferenceLine } from "../types";

function useValueTagTransform(stack: SharedValue<ReferenceTagStack> | undefined, index: number) {
  return useDerivedValue(() => [{ translateY: stack?.get().valueOffsets[index] ?? 0 }]);
}

export function ReferenceValueBadge({
  layout,
  line,
  font,
  palette,
  hidden,
  tagStack,
  index = 0,
}: {
  layout: SharedValue<ReferenceLineLayout>;
  line: ReferenceLine;
  font: SkFont;
  palette: LiveChartPalette;
  hidden: SharedValue<boolean>;
  tagStack?: SharedValue<ReferenceTagStack>;
  index?: number;
}) {
  const cfg = typeof line.valueBadge === "object" ? line.valueBadge : {};
  const color = line.color ?? palette.refLine;
  const builder = usePathBuilder();
  const chevron = useDerivedValue(() => {
    const b = builder.get();
    const l = layout.get();
    const pill = l.valueBadge;
    if (pill && pill.chevronCx >= 0) {
      const cx = pill.chevronCx;
      const cy = pill.y + pill.h / 2;
      const sign = l.chevronUp ? 1 : -1;
      b.moveTo(cx - 4, cy + sign * 4);
      b.lineTo(cx, cy - sign * 4);
      b.lineTo(cx + 4, cy + sign * 4);
    }
    return b.detach();
  });
  const opacity = useDerivedValue(() =>
    !hidden.get() && layout.get().valueBadge ? 1 : 0,
  );
  const x = useDerivedValue(() => layout.get().valueBadge?.x ?? 0);
  const y = useDerivedValue(() => layout.get().valueBadge?.y ?? 0);
  const width = useDerivedValue(() => layout.get().valueBadge?.w ?? 0);
  const height = useDerivedValue(() => layout.get().valueBadge?.h ?? 0);
  const text = useDerivedValue(() => layout.get().valueBadge?.text ?? "");
  const textX = useDerivedValue(() => layout.get().valueBadge?.textX ?? 0);
  const textY = useDerivedValue(() => layout.get().valueBadge?.textY ?? 0);
  const transform = useValueTagTransform(tagStack, index);
  return (
    <Group opacity={opacity} transform={transform}>
      <RoundedRect
        x={x}
        y={y}
        width={width}
        height={height}
        r={cfg.radius ?? line.badgeRadius ?? 5}
        color={cfg.background ?? line.badgeBackground ?? palette.tooltipBg}
      />
      <RoundedRect
        x={x}
        y={y}
        width={width}
        height={height}
        r={cfg.radius ?? line.badgeRadius ?? 5}
        color={cfg.borderColor ?? line.badgeBorderColor ?? color}
        style="stroke"
        strokeWidth={cfg.borderWidth ?? 1}
      />
      <Path
        path={chevron}
        color={color}
        style="stroke"
        strokeWidth={1.5}
        strokeCap="round"
        strokeJoin="round"
      />
      <Text
        x={textX}
        y={textY}
        text={text}
        font={font}
        color={
          cfg.textColor ?? line.labelColor ?? line.color ?? palette.refLabel
        }
      />
    </Group>
  );
}
