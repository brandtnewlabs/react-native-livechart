import { MS_PER_FRAME_60FPS } from "../constants";

/**
 * Frame-rate-independent exponential lerp.
 * `speed` is the fraction approached per frame at 60fps.
 * At lower frame rates, dt is larger so we approach more per frame.
 */
export function lerp(
  current: number,
  target: number,
  speed: number,
  dt = MS_PER_FRAME_60FPS,
): number {
  "worklet";
  // speed >= 1 means "snap in one frame". Computing it through the exponential
  // would evaluate 0 ** (dt / frame), which is Infinity for a negative frame
  // delta. When current === target, the resulting 0 * -Infinity becomes NaN
  // and is permanent once written back into a SharedValue. No broader guard:
  // NaN inputs must keep propagating (the engine tick relies on a NaN
  // displayValue staying NaN so the y-range block stays skipped).
  if (speed >= 1) return target;
  const factor = 1 - Math.pow(1 - speed, dt / MS_PER_FRAME_60FPS);
  return current + (target - current) * factor;
}
