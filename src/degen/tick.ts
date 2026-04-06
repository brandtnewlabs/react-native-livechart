import { DEGEN_STRIDE } from "../constants";

export function hash(a: number, b: number): number {
  "worklet";
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export interface SpawnParams {
  ox: number;
  oy: number;
  sc: number;
  burst: number;
  baseAngle: number;
  spread: number;
  jx: number;
  jy: number;
  sMin: number;
  sMax: number;
  szMin: number;
  szMax: number;
  now: number;
  baseRot: number;
  slots: number;
}

export function spawnBurst(buf: Float64Array, p: SpawnParams): number {
  "worklet";
  const stride = DEGEN_STRIDE;
  let rot = p.baseRot;
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
  }
  return (rot + p.burst) % p.slots;
}

export interface ShakeResult {
  x: number;
  y: number;
  active: boolean;
}

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

export function tickParticles(
  buf: Float64Array,
  slots: number,
  now: number,
  burstDur: number,
  drag: number,
  dtSec: number,
): void {
  "worklet";
  const stride = DEGEN_STRIDE;
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
  }
}
