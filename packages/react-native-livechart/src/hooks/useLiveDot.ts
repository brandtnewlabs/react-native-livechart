import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { SingleEngineState } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";

/**
 * Derive the live dot position (right edge of the chart, mapped to current value).
 * Returns `{ dotX, dotY }` as shared values. Coordinates are set to `-100`
 * (off-screen sentinel) when canvas dimensions are unavailable.
 *
 * With `followViewEdge` + `edgeValue`, the dot (and the value line that shares
 * `dotY`) tracks the visible window's right-edge price while scrolled back, so it
 * stays aligned with a `followViewEdge` badge instead of marking the live value.
 */
export function useLiveDot(
  engine: SingleEngineState,
  padding: ChartPadding,
  edgeValue?: SharedValue<number>,
  followViewEdge = false,
) {
  const dotX = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    if (w === 0) return -100;
    return w - padding.right;
  });

  const dotY = useDerivedValue(() => {
    const h = engine.canvasHeight.value;
    if (h === 0) return -100;
    const chartH = h - padding.top - padding.bottom;
    const dMin = engine.displayMin.value;
    const dMax = engine.displayMax.value;
    const valRange = dMax - dMin;
    if (valRange === 0) return padding.top + chartH / 2;
    const v =
      followViewEdge && edgeValue
        ? edgeValue.value
        : engine.displayValue.value;
    return padding.top + ((dMax - v) / valRange) * chartH;
  });

  return { dotX, dotY } as const;
}
