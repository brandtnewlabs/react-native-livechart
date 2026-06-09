import { DEGEN_STRIDE } from "../../src/constants";
import {
  buildParticleInstances,
  buildParticleSprite,
} from "../../src/draw/particleAtlas";

/** Write one active particle into slot `i` of a fresh buffer. */
function bufWith(
  i: number,
  slots: number,
  fields: { x?: number; y?: number; t0?: number; size?: number; colorIndex?: number },
): Float64Array {
  const buf = new Float64Array(slots * DEGEN_STRIDE);
  const b = i * DEGEN_STRIDE;
  buf[b + 0] = fields.x ?? 0;
  buf[b + 1] = fields.y ?? 0;
  buf[b + 4] = fields.t0 ?? 0;
  buf[b + 5] = 1; // active
  buf[b + 6] = fields.size ?? 1;
  buf[b + 7] = fields.colorIndex ?? 0;
  return buf;
}

describe("buildParticleInstances", () => {
  const burstDur = 1.0;
  const particleOpacity = 0.8;
  const spriteRadius = 16;

  it("computes scale = r/spriteRadius and alpha = life*particleOpacity", () => {
    // t0=0, now=0.5 → dt=0.5, life=0.5; size=4 → r = 4*(0.5+0.25) = 3.
    const buf = bufWith(0, 4, { x: 100, y: 200, t0: 0, size: 4 });
    const out = buildParticleInstances(
      buf,
      4,
      0.5,
      burstDur,
      particleOpacity,
      spriteRadius,
    );
    expect(out).toHaveLength(1);
    expect(out[0].x).toBe(100);
    expect(out[0].y).toBe(200);
    expect(out[0].scale).toBeCloseTo(3 / spriteRadius, 6);
    expect(out[0].alpha).toBeCloseTo(0.5 * particleOpacity, 6);
  });

  it("defaults size to 1 when the slot's size field is 0", () => {
    const buf = bufWith(0, 2, { t0: 0, size: 0 });
    // dt=0 → life=1 → r = 1*(0.5+0.5) = 1.
    const out = buildParticleInstances(buf, 2, 0, burstDur, 1, spriteRadius);
    expect(out[0].scale).toBeCloseTo(1 / spriteRadius, 6);
  });

  it("skips inactive slots", () => {
    const buf = bufWith(0, 2, { t0: 0, size: 2 });
    buf[5] = 0; // mark inactive
    const out = buildParticleInstances(buf, 2, 0, burstDur, 1, spriteRadius);
    expect(out).toHaveLength(0);
  });

  it("skips pre-spawn particles (dt < 0)", () => {
    const buf = bufWith(0, 2, { t0: 10, size: 2 });
    const out = buildParticleInstances(buf, 2, 5, burstDur, 1, spriteRadius);
    expect(out).toHaveLength(0);
  });

  it("skips fully-expired particles (life <= 0)", () => {
    const buf = bufWith(0, 2, { t0: 0, size: 2 });
    // dt = burstDur → life = 0.
    const out = buildParticleInstances(buf, 2, burstDur, burstDur, 1, spriteRadius);
    expect(out).toHaveLength(0);
  });

  it("passes colorIndex through (floored, clamped to >= 0)", () => {
    const buf = bufWith(0, 2, { t0: 0, size: 2, colorIndex: 3.9 });
    const out = buildParticleInstances(buf, 2, 0, burstDur, 1, spriteRadius);
    expect(out[0].colorIndex).toBe(3);
  });

  it("counts multiple active particles", () => {
    const buf = new Float64Array(3 * DEGEN_STRIDE);
    for (let i = 0; i < 3; i++) {
      const b = i * DEGEN_STRIDE;
      buf[b + 4] = 0; // t0
      buf[b + 5] = 1; // active
      buf[b + 6] = 2; // size
      buf[b + 7] = i; // colorIndex
    }
    const out = buildParticleInstances(buf, 3, 0.2, burstDur, 1, spriteRadius);
    expect(out).toHaveLength(3);
    expect(out.map((p) => p.colorIndex)).toEqual([0, 1, 2]);
  });

  it("returns an empty array when there are no slots", () => {
    expect(
      buildParticleInstances(new Float64Array(0), 0, 0, burstDur, 1, spriteRadius),
    ).toEqual([]);
  });
});

describe("buildParticleSprite", () => {
  it("returns an image plus matching box size and radius", () => {
    const sprite = buildParticleSprite();
    expect(sprite.image).toBeDefined();
    expect(sprite.radius).toBe(16);
    // Box = 2 * (radius + margin), margin = 2.
    expect(sprite.size).toBe(2 * (16 + 2));
  });
});
