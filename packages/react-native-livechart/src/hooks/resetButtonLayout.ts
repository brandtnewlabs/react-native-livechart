import type { ChartPadding } from "../draw/line";

/** Where the reset button sits inside the plot rect. */
export type ResetButtonPlacement = "bottom-center" | "bottom-right";

/** Canvas-px rect of the rendered reset button. */
export interface ResetButtonRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Position of the reset button inside the plot, from the measured button size.
 * Shared by the overlay's layout and the tap hit-test so both agree.
 */
export function resetButtonRect(
  canvasWidth: number,
  canvasHeight: number,
  padding: ChartPadding,
  placement: ResetButtonPlacement,
  margin: number,
  width: number,
  height: number,
): ResetButtonRect {
  "worklet";
  const plotLeft = padding.left;
  const plotRight = canvasWidth - padding.right;
  const plotBottom = canvasHeight - padding.bottom;
  const x =
    placement === "bottom-right"
      ? plotRight - margin - width
      : (plotLeft + plotRight) / 2 - width / 2;
  return { x, y: plotBottom - margin - height, width, height };
}

/** Whether a canvas-px touch lands on the button. */
export function isResetButtonHit(
  x: number,
  y: number,
  rect: ResetButtonRect,
): boolean {
  "worklet";
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

/** `yRangeScale` this close to 1 counts as fitted (it eases back to exactly 1). */
const Y_RANGE_SCALE_EPSILON = 1e-3;

/**
 * True while any of the enabled manual states moves the view off the fitted
 * live view: a window scrolled back in time, a pinched width, a scaled price
 * axis or a gesture-owned price range.
 */
export function isViewOffFitted(
  viewEnd: number | null,
  viewWindow: number | null,
  yRangeScale: number,
  hasGestureRange: boolean,
  showTimeScroll: boolean,
  showZoom: boolean,
  showYScale: boolean,
  showPriceScroll: boolean,
): boolean {
  "worklet";
  return (
    (showTimeScroll && viewEnd !== null) ||
    (showZoom && viewWindow !== null) ||
    (showYScale && Math.abs(yRangeScale - 1) > Y_RANGE_SCALE_EPSILON) ||
    (showPriceScroll && hasGestureRange)
  );
}
