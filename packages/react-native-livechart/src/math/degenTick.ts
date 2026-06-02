/**
 * Particle system for "degen" momentum bursts.
 *
 * Particles live in a packed `Float64Array` ring buffer.  Each slot occupies
 * `DEGEN_STRIDE` (7) contiguous floats:
 *
 * | offset | field      | description                          |
 * | ------ | ---------- | ------------------------------------ |
 * |   0    | x          | current x position (px)              |
 * |   1    | y          | current y position (px)              |
 * |   2    | vx         | velocity x (px/s)                    |
 * |   3    | vy         | velocity y (px/s)                    |
 * |   4    | t0         | spawn timestamp (seconds)            |
 * |   5    | active     | 1 = alive, 0 = expired               |
 * |   6    | size       | particle radius (px, pre-scaled)     |
 * |   7    | colorIndex | index into the renderer's color list |
 *
 * All functions are worklet-safe for UI-thread execution.
 */
import { DEGEN_STRIDE } from "../constants";

/** Deterministic pseudo-random hash for reproducible particle variation. */
export function hash(a: number, b: number): number {
  "worklet";
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export interface SpawnParams {
  /** Origin x — center of the burst (px). */
  ox: number;
  /** Origin y — center of the burst (px). */
  oy: number;
  /** Scale multiplier applied to speed and size. */
  sc: number;
  /** Number of particles to spawn in this burst. */
  burst: number;
  /** Central emission angle (radians). */
  baseAngle: number;
  /** Angular spread around `baseAngle` (radians). */
  spread: number;
  /** Horizontal position jitter (±half, px). */
  jx: number;
  /** Vertical position jitter (±half, px). */
  jy: number;
  /** Minimum initial speed (px/s, before `sc`). */
  sMin: number;
  /** Maximum initial speed (px/s, before `sc`). */
  sMax: number;
  /** Minimum particle radius (px, before `sc`). */
  szMin: number;
  /** Maximum particle radius (px, before `sc`). */
  szMax: number;
  /** Current timestamp (seconds). */
  now: number;
  /** Ring-buffer rotation index for slot allocation. */
  baseRot: number;
  /** Total number of slots in the ring buffer. */
  slots: number;
  /**
   * Color list index written to every particle in this burst. Use a fixed value
   * (e.g. a series index) to color the whole burst uniformly, or `-1` to cycle
   * the renderer's color list per particle (the particle's loop index is stored).
   * Defaults to `-1`.
   */
  colorIndex?: number;
}

/** Write `p.burst` particles into the ring buffer starting at `p.baseRot`. Returns the next rotation index. */
export function spawnBurst(buf: Float64Array, p: SpawnParams): number {
  "worklet";
  const stride = DEGEN_STRIDE;
  const rot = p.baseRot;
  const colorIndex = p.colorIndex ?? -1;
  for (let k = 0; k < p.burst; k++) {
    const slot = (rot + k) % p.slots;
    const b = slot * stride;
    const angle = p.baseAngle + (hash(k, p.now * 1000) - 0.5) * p.spread;
    const speed =
      (p.sMin + hash(k + 100, p.now * 1000) * (p.sMax - p.sMin)) * p.sc;
    buf[b + 0] = p.ox + (hash(k + 200, p.now * 1000) - 0.5) * p.jx;
    buf[b + 1] = p.oy + (hash(k + 300, p.now * 1000) - 0.5) * p.jy;
    buf[b + 2] = Math.cos(angle) * speed;
    buf[b + 3] = Math.sin(angle) * speed;
    buf[b + 4] = p.now;
    buf[b + 5] = 1;
    buf[b + 6] =
      (p.szMin + hash(k + 400, p.now * 1000) * (p.szMax - p.szMin)) * p.sc;
    // Fixed index colors the whole burst; -1 cycles per particle via k.
    buf[b + 7] = colorIndex < 0 ? k : colorIndex;
  }
  return (rot + p.burst) % p.slots;
}

export interface ShakeResult {
  x: number;
  y: number;
  active: boolean;
}

/** Compute screen-shake displacement with exponential decay envelope. */
export function computeShake(
  elapsed: number,
  dur: number,
  sc: number,
  sint: number,
): ShakeResult {
  "worklet";
  if (elapsed >= dur) return { x: 0, y: 0, active: false };
  const amp = 10 * sc * sint;
  const tail = 1 - elapsed / dur;
  const env = Math.exp(-elapsed * 10) * tail;
  return {
    x: Math.sin(elapsed * 88) * amp * env,
    y: Math.cos(elapsed * 71) * amp * env * 0.92,
    active: true,
  };
}

/**
 * Advance all particles by `dtSec`: apply velocity, drag, and expire particles older than `burstDur`.
 * Returns the number of particles still alive after the tick, so callers can skip per-frame
 * repaint work (bumping `packRevision`) when the field is empty.
 */
export function tickParticles(
  buf: Float64Array,
  slots: number,
  now: number,
  burstDur: number,
  drag: number,
  dtSec: number,
): number {
  "worklet";
  const stride = DEGEN_STRIDE;
  let active = 0;
  for (let i = 0; i < slots; i++) {
    const b = i * stride;
    if (buf[b + 5] < 0.5) continue;
    const t0 = buf[b + 4];
    if (now - t0 > burstDur) {
      buf[b + 5] = 0;
      continue;
    }
    buf[b + 0] += buf[b + 2] * dtSec;
    buf[b + 1] += buf[b + 3] * dtSec;
    buf[b + 2] *= drag;
    buf[b + 3] *= drag;
    active++;
  }
  return active;
}
