import { Blur, Group, Path, Skia } from "@shopify/react-native-skia";
import { DashPathEffect } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { SeriesLineStyle } from "../core/multiSeriesLayout";
import { SERIES_COLORS } from "../theme";
import type { SeriesConfig } from "../types";

export function MultiSeriesStroke({
  index,
  paths,
  opacities,
  series,
  strokeWidth,
  lineStyle,
}: {
  index: number;
  paths: SharedValue<ReturnType<typeof Skia.Path.Make>[]>;
  opacities: SharedValue<number[]>;
  series: SharedValue<SeriesConfig[]>;
  strokeWidth: number;
  /** Per-series static stroke style (dash / width / glow). */
  lineStyle?: SeriesLineStyle;
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

  const sw = lineStyle?.strokeWidth ?? strokeWidth;
  const dashed = lineStyle?.dashed ?? false;
  const intervals = lineStyle?.intervals ?? [6, 4];
  const glow = lineStyle?.glow ?? false;

  return (
    <Group opacity={opacity}>
      {glow && (
        <Group opacity={0.35}>
          <Path
            path={path}
            style="stroke"
            strokeWidth={sw * 2.5}
            color={color}
            strokeCap="round"
            strokeJoin="round"
          >
            <Blur blur={4} />
          </Path>
        </Group>
      )}
      <Path
        path={path}
        style="stroke"
        strokeWidth={sw}
        color={color}
        strokeCap="round"
        strokeJoin="round"
      >
        {dashed && <DashPathEffect intervals={intervals} />}
      </Path>
    </Group>
  );
}
