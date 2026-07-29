import {
  Circle,
  Group,
  RoundedRect,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import {
  useDerivedValue,
  type DerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import type { ResolvedPerSeriesTooltipConfig } from "../core/resolveConfig";
import type { TooltipLayout } from "../hooks/crosshairShared";
import type { LiveChartPalette } from "../types";

type TooltipLayoutValue =
  | SharedValue<TooltipLayout>
  | DerivedValue<TooltipLayout>;

function TimePill({
  layout,
  font,
  palette,
  config,
  background,
  color,
  borderColor,
}: {
  layout: TooltipLayoutValue;
  font: SkFont;
  palette: LiveChartPalette;
  config: ResolvedPerSeriesTooltipConfig;
  background?: string;
  color?: string;
  borderColor?: string;
}) {
  const opacity = useDerivedValue(() =>
    layout.value.perSeries?.timePill ? 1 : 0,
  );
  const x = useDerivedValue(
    () => layout.value.perSeries?.timePill?.x ?? -400,
  );
  const y = useDerivedValue(
    () => layout.value.perSeries?.timePill?.y ?? 0,
  );
  const w = useDerivedValue(
    () => layout.value.perSeries?.timePill?.w ?? 0,
  );
  const h = useDerivedValue(
    () => layout.value.perSeries?.timePill?.h ?? 0,
  );
  const text = useDerivedValue(
    () => layout.value.perSeries?.timePill?.text ?? "",
  );
  const textX = useDerivedValue(
    () => layout.value.perSeries?.timePill?.textX ?? -400,
  );
  const baselineY = useDerivedValue(
    () => layout.value.perSeries?.timePill?.baselineY ?? 0,
  );
  const clip = useDerivedValue(() => ({
    x: layout.value.perSeries?.timePill?.x ?? -400,
    y: layout.value.perSeries?.timePill?.y ?? 0,
    width: layout.value.perSeries?.timePill?.w ?? 0,
    height: layout.value.perSeries?.timePill?.h ?? 0,
  }));

  return (
    <Group opacity={opacity}>
      <RoundedRect
        x={x}
        y={y}
        width={w}
        height={h}
        r={config.timePillRadius}
        color={background ?? palette.tooltipBg}
      />
      <RoundedRect
        x={x}
        y={y}
        width={w}
        height={h}
        r={config.timePillRadius}
        color={borderColor ?? palette.tooltipBorder}
        style="stroke"
        strokeWidth={1}
      />
      <Group clip={clip}>
        <SkiaText
          x={textX}
          y={baselineY}
          text={text}
          font={font}
          color={color ?? palette.tooltipText}
        />
      </Group>
    </Group>
  );
}

function SeriesPill({
  index,
  layout,
  font,
  palette,
  config,
  background,
  labelColor,
  valueColor,
  borderColor,
}: {
  index: number;
  layout: TooltipLayoutValue;
  font: SkFont;
  palette: LiveChartPalette;
  config: ResolvedPerSeriesTooltipConfig;
  background?: string;
  labelColor?: string;
  valueColor?: string;
  borderColor?: string;
}) {
  const opacity = useDerivedValue(() => {
    const pills = layout.value.perSeries?.pills;
    return pills && index < pills.length ? 1 : 0;
  });
  const x = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.x ?? -400,
  );
  const y = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.y ?? 0,
  );
  const w = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.w ?? 0,
  );
  const h = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.h ?? 0,
  );
  const anchorX = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.anchorX ?? -400,
  );
  const anchorY = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.anchorY ?? -400,
  );
  const dotX = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.dotX ?? -400,
  );
  const dotY = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.dotY ?? -400,
  );
  const dotColor = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.color ?? palette.tooltipText,
  );
  const label = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.label ?? "",
  );
  const labelX = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.labelX ?? -400,
  );
  const value = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.value ?? "",
  );
  const valueX = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.valueX ?? -400,
  );
  const baselineY = useDerivedValue(
    () => layout.value.perSeries?.pills[index]?.baselineY ?? 0,
  );
  const clip = useDerivedValue(() => ({
    x: layout.value.perSeries?.pills[index]?.x ?? -400,
    y: layout.value.perSeries?.pills[index]?.y ?? 0,
    width: layout.value.perSeries?.pills[index]?.w ?? 0,
    height: layout.value.perSeries?.pills[index]?.h ?? 0,
  }));

  return (
    <Group opacity={opacity}>
      <Circle
        cx={anchorX}
        cy={anchorY}
        r={config.intersectionDotSize / 2}
        color={dotColor}
      />
      <RoundedRect
        x={x}
        y={y}
        width={w}
        height={h}
        r={config.seriesPillRadius}
        color={background ?? palette.tooltipBg}
      />
      <RoundedRect
        x={x}
        y={y}
        width={w}
        height={h}
        r={config.seriesPillRadius}
        color={borderColor ?? palette.tooltipBorder}
        style="stroke"
        strokeWidth={1}
      />
      <Group clip={clip}>
        <Circle
          cx={dotX}
          cy={dotY}
          r={config.seriesPillDotSize / 2}
          color={dotColor}
        />
        <SkiaText
          x={labelX}
          y={baselineY}
          text={label}
          font={font}
          color={labelColor ?? palette.tooltipText}
        />
        <SkiaText
          x={valueX}
          y={baselineY}
          text={value}
          font={font}
          color={valueColor ?? labelColor ?? palette.tooltipText}
        />
      </Group>
    </Group>
  );
}

/** Skia-only per-series tooltip renderer; every position is SharedValue-driven. */
export function PerSeriesTooltipOverlay({
  layout,
  font,
  palette,
  config,
  seriesCount,
  opacity,
  tooltipBackground,
  tooltipColor,
  tooltipBorderColor,
}: {
  layout: TooltipLayoutValue;
  font: SkFont;
  palette: LiveChartPalette;
  config: ResolvedPerSeriesTooltipConfig;
  seriesCount: number;
  /** Active crosshair opacity; idle `alwaysShow` pills stay fully visible. */
  opacity?: SharedValue<number> | DerivedValue<number>;
  tooltipBackground?: string;
  tooltipColor?: string;
  tooltipBorderColor?: string;
}) {
  const timeBackground =
    config.timePillBackground ?? tooltipBackground;
  const timeColor = config.timePillColor ?? tooltipColor;
  const timeBorder =
    config.timePillBorderColor ?? tooltipBorderColor;
  const seriesBackground =
    config.seriesPillBackground ?? tooltipBackground;
  const seriesLabelColor =
    config.seriesPillLabelColor ?? tooltipColor;
  const seriesBorder =
    config.seriesPillBorderColor ?? tooltipBorderColor;

  return (
    <Group opacity={opacity}>
      <TimePill
        layout={layout}
        font={font}
        palette={palette}
        config={config}
        background={timeBackground}
        color={timeColor}
        borderColor={timeBorder}
      />
      {Array.from({ length: seriesCount }, (_, index) => (
        <SeriesPill
          key={index}
          index={index}
          layout={layout}
          font={font}
          palette={palette}
          config={config}
          background={seriesBackground}
          labelColor={seriesLabelColor}
          valueColor={config.seriesPillValueColor}
          borderColor={seriesBorder}
        />
      ))}
    </Group>
  );
}
