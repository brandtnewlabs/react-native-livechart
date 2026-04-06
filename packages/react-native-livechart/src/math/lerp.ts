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
  const factor = 1 - Math.pow(1 - speed, dt / MS_PER_FRAME_60FPS);
  return current + (target - current) * factor;
}
