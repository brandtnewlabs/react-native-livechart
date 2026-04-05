import { Group, Path, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { SERIES_COLORS } from "../theme";
import type { LivelineSeries } from "../types";

export function MultiSeriesStroke({
  index,
  paths,
  opacities,
  series,
  strokeWidth,
}: {
  index: number;
  paths: SharedValue<ReturnType<typeof Skia.Path.Make>[]>;
  opacities: SharedValue<number[]>;
  series: SharedValue<LivelineSeries[]>;
  strokeWidth: number;
}) {
  const path = useDerivedValue(
    /* istanbul ignore next -- Skia path derived on UI thread */
    () => paths.value[index] ?? Skia.Path.Make(),
  );
  const opacity = useDerivedValue(
    /* istanbul ignore next -- Reanimated derived on UI thread */
    () => {
      const o = opacities.value;
      if (index >= o.length) return 0;
      return o[index] ?? 0;
    },
  );
  const color = useDerivedValue(
    /* istanbul ignore next -- Reanimated derived on UI thread */
    () => {
      const s = series.value;
      if (index >= s.length) return "#ffffff";
      return (s[index].color ??
        SERIES_COLORS[index % SERIES_COLORS.length]) as string;
    },
  );
  return (
    <Group opacity={opacity}>
      <Path
        path={path}
        style="stroke"
        strokeWidth={strokeWidth}
        color={color as unknown as string}
        strokeCap="round"
        strokeJoin="round"
      />
    </Group>
  );
}
