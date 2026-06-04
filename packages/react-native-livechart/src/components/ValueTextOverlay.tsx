import { Text as SkiaText, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { ChartEngineWithLiveValue } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import type { LiveChartPalette, Momentum } from "../types";

/**
 * Large live-value text rendered in the top-left of the plot. Tracks the
 * engine's smoothed display value on the UI thread; optionally tinted by
 * momentum (green up / red down / accent flat).
 */
export function ValueTextOverlay({
  engine,
  padding,
  palette,
  font,
  formatValue,
  momentum,
  momentumColor,
}: {
  engine: ChartEngineWithLiveValue;
  padding: ChartPadding;
  palette: LiveChartPalette;
  font: SkFont;
  formatValue: (v: number) => string;
  momentum?: SharedValue<Momentum>;
  momentumColor: boolean;
}) {
  const text = useDerivedValue(() => formatValue(engine.displayValue.value));

  const color = useDerivedValue(() => {
    if (!momentumColor || !momentum) return palette.line;
    const m = momentum.value;
    if (m === "up") return palette.dotUp;
    if (m === "down") return palette.dotDown;
    return palette.dotFlat;
  });

  const x = padding.left + 6;
  const y = padding.top + font.getSize();

  return <SkiaText x={x} y={y} text={text} font={font} color={color} />;
}
