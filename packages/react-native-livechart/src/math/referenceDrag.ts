/**
 * Pure, worklet-safe helpers for dragging a Form-A reference line along the
 * Y-axis. Kept free of hooks / SharedValues so they unit-test without Reanimated
 * (the gesture wiring lives in {@link useReferenceDrag}).
 */

/** Clamp a value to an optional `[min, max]` bound (order-independent). No-op when
 *  `bounds` is omitted. */
export function clampToBounds(
  value: number,
  bounds?: [number, number],
): number {
  "worklet";
  if (!bounds) return value;
  const lo = Math.min(bounds[0], bounds[1]);
  const hi = Math.max(bounds[0], bounds[1]);
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Index of the draggable line whose handle-Y is nearest the touch `y`, within
 * `slop` px — or `-1` when none is in reach. `handleYs` is index-aligned with the
 * chart's `referenceLines`; entries `< 0` (not draggable / off-screen / not laid
 * out) are skipped. Ties favor the later (topmost-drawn) line.
 */
export function nearestDraggableIndex(
  handleYs: number[],
  y: number,
  slop: number,
): number {
  "worklet";
  let best = -1;
  let bestDist = slop;
  for (let i = 0; i < handleYs.length; i++) {
    const hy = handleYs[i];
    if (hy < 0) continue;
    const d = Math.abs(hy - y);
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * Resolve a grabbed line's drag intent from the touch travel (px) since the grab.
 * Once a line is grabbed it **owns** the touch: any drag past `threshold` px in
 * either axis activates the drag. We deliberately don't fall through to scrub on
 * horizontal / diagonal intent — that let the scrub crosshair win the race even
 * on a vertical drag started on the line (#163). Returns `"activate"` past the
 * threshold, else `"wait"` (keep the gesture armed for more travel).
 */
export function resolveDragIntent(
  dx: number,
  dy: number,
  threshold: number,
): "activate" | "wait" {
  "worklet";
  return Math.abs(dx) > threshold || Math.abs(dy) > threshold
    ? "activate"
    : "wait";
}

/**
 * Whether a line's value sits **outside** its watched interval — the trigger for
 * `onDragOut` / `onDragIn` (edge-detected by the caller). When `bounds` is set the
 * watched interval is `bounds` (at-or-past a bound counts as out, since the drag
 * clamps there); otherwise it's the visible `[min, max]` Y-range (out = scrolled /
 * dragged off-screen).
 */
export function referenceValueOut(
  value: number,
  min: number,
  max: number,
  bounds?: [number, number],
): boolean {
  "worklet";
  if (bounds) {
    const lo = Math.min(bounds[0], bounds[1]);
    const hi = Math.max(bounds[0], bounds[1]);
    return value <= lo || value >= hi;
  }
  return value < min || value > max;
}
