import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type {
  ChartEngineScroll,
  SingleEngineState,
} from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";

/**
 * Derive the live dot position (right edge of the chart, mapped to current value).
 * Returns `{ dotX, dotY }` as shared values. Coordinates are set to `-100`
 * (off-screen sentinel) when canvas dimensions are unavailable.
 *
 * With `followViewEdge` + `edgeValue`, the dot (and the value line that shares
 * `dotY`) tracks the visible window's right-edge price while scrolled back, so it
 * stays aligned with a `followViewEdge` badge instead of marking the live value.
 *
 * With `trackWhileParked` (`dot.trackWhileParked`), the dot instead tracks the
 * **true live point's x** while scrolled back / overscrolled (`viewEnd`
 * frozen), and hides once the live point leaves the visible window.
 * `followViewEdge` wins when both are set — an edge-pinned dot must stay
 * aligned with its badge.
 */
export function useLiveDot(
  engine: SingleEngineState & ChartEngineScroll,
  padding: ChartPadding,
  edgeValue?: SharedValue<number>,
  followViewEdge = false,
  trackWhileParked = false,
) {
  const dotX = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    if (w === 0) return -100;
    const right = w - padding.right;
    // While parked (scrolled back / overscrolled) the live point is not at the
    // plot edge — track its real x so a pan doesn't lose the dot, and hide it
    // only once the point leaves the window.
    if (trackWhileParked && !followViewEdge && engine.viewEnd.value != null) {
      const data = engine.data.value;
      const last = data[data.length - 1];
      const win = engine.displayWindow.value;
      const chartW = w - padding.left - padding.right;
      if (!last || win <= 0 || chartW <= 0) return -100;
      const x =
        padding.left +
        ((last.time - (engine.timestamp.value - win)) / win) * chartW;
      return x < padding.left || x > right ? -100 : x;
    }
    return right;
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
