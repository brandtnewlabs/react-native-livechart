import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type {
  ChartEngineScroll,
  SingleEngineState,
} from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";

/**
 * Derive the live dot position (right edge of the chart, mapped to current value).
 * Returns `{ dotX, dotY, indicatorValue }` as shared values. Coordinates are set to `-100`
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
  /** Keep the dot on recorded geometry when the viewport includes future space. */
  shouldOmitTipBeyondData = false,
) {
  // A line with no synthetic tip ends at its recorded price. Share that value
  // with the badge so its text, the value line, and the dot stay aligned even
  // while the engine's live value is still easing toward a new tick.
  const indicatorValue = useDerivedValue(() => {
    if (followViewEdge && edgeValue) return edgeValue.value;
    if (shouldOmitTipBeyondData) {
      const data = engine.data.value;
      const last = data[data.length - 1];
      if (last && last.time <= engine.timestamp.value) return last.value;
    }
    return engine.displayValue.value;
  });

  const dotX = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    if (w === 0) return -100;
    const right = w - padding.right;
    // Buffered or parked windows can put the last point before the plot edge.
    // Track its real x so a pan doesn't lose the dot, and hide it only once
    // the point leaves the window.
    if (
      !followViewEdge &&
      (shouldOmitTipBeyondData ||
        (trackWhileParked && engine.viewEnd.value != null))
    ) {
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
    return padding.top + ((dMax - indicatorValue.value) / valRange) * chartH;
  });

  return { dotX, dotY, indicatorValue } as const;
}
