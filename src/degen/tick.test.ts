import { DEGEN_STRIDE } from "../constants";
import {
  computeShake,
  hash,
  spawnBurst,
  tickParticles,
  type SpawnParams,
} from "./tick";

describe("hash", () => {
  it("returns values in [0,1)", () => {
    for (let i = 0; i < 100; i++) {
      const v = hash(i, i * 3.7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("returns distinct values for different inputs", () => {
    const a = hash(1, 1000);
    const b = hash(2, 1000);
    const c = hash(1, 2000);
    expect(a).not.toBeCloseTo(b, 3);
    expect(a).not.toBeCloseTo(c, 3);
  });
});

describe("spawnBurst", () => {
  const makeParams = (overrides?: Partial<SpawnParams>): SpawnParams => ({
    ox: 200,
    oy: 150,
    sc: 1,
    burst: 6,
    baseAngle: -Math.PI / 2,
    spread: Math.PI * 1.2,
    jx: 24,
    jy: 8,
    sMin: 60,
    sMax: 160,
    szMin: 1,
    szMax: 2.2,
    now: 1700000000,
    baseRot: 0,
    slots: 20,
    ...overrides,
  });

  it("writes particles into buffer at correct offsets", () => {
    const buf = new Float64Array(20 * DEGEN_STRIDE);
    const p = makeParams();
    spawnBurst(buf, p);

    for (let k = 0; k < p.burst; k++) {
      const b = k * DEGEN_STRIDE;
      expect(buf[b + 5]).toBe(1);
      expect(buf[b + 4]).toBe(p.now);
      expect(Number.isFinite(buf[b + 0])).toBe(true);
      expect(Number.isFinite(buf[b + 1])).toBe(true);
      expect(Number.isFinite(buf[b + 2])).toBe(true);
      expect(Number.isFinite(buf[b + 3])).toBe(true);
      expect(buf[b + 6]).toBeGreaterThan(0);
    }
  });

  it("returns updated rotation", () => {
    const buf = new Float64Array(20 * DEGEN_STRIDE);
    const rot = spawnBurst(
      buf,
      makeParams({ burst: 6, baseRot: 0, slots: 20 }),
    );
    expect(rot).toBe(6);
  });

  it("wraps rotation around slot count", () => {
    const buf = new Float64Array(10 * DEGEN_STRIDE);
    const rot = spawnBurst(
      buf,
      makeParams({ burst: 6, baseRot: 7, slots: 10 }),
    );
    expect(rot).toBe(3);
  });

  it("positions have jitter around origin", () => {
    const buf = new Float64Array(40 * DEGEN_STRIDE);
    spawnBurst(buf, makeParams({ burst: 20, slots: 40 }));
    const xs: number[] = [];
    for (let k = 0; k < 20; k++) xs.push(buf[k * DEGEN_STRIDE]);
    const allSame = xs.every((x) => x === xs[0]);
    expect(allSame).toBe(false);
  });

  it("respects scale on size", () => {
    const buf1 = new Float64Array(20 * DEGEN_STRIDE);
    spawnBurst(buf1, makeParams({ sc: 1 }));
    const size1 = buf1[6];

    const buf2 = new Float64Array(20 * DEGEN_STRIDE);
    spawnBurst(buf2, makeParams({ sc: 2 }));
    const size2 = buf2[6];

    expect(size2).toBeCloseTo(size1 * 2, 5);
  });
});

describe("computeShake", () => {
  it("returns zero and inactive when elapsed >= duration", () => {
    const r = computeShake(0.5, 0.45, 1, 1);
    expect(r).toEqual({ x: 0, y: 0, active: false });
  });

  it("returns non-zero when elapsed < duration", () => {
    const r = computeShake(0.1, 0.45, 1, 1);
    expect(r.active).toBe(true);
    expect(r.x).not.toBe(0);
    expect(r.y).not.toBe(0);
  });

  it("scales amplitude with sc and sint", () => {
    const a = computeShake(0.05, 0.45, 1, 1);
    const b = computeShake(0.05, 0.45, 2, 1);
    expect(Math.abs(b.x)).toBeGreaterThan(Math.abs(a.x));
  });
});

describe("tickParticles", () => {
  it("deactivates expired particles", () => {
    const buf = new Float64Array(5 * DEGEN_STRIDE);
    buf[5] = 1;
    buf[4] = 100;

    tickParticles(buf, 5, 102, 1.0, 0.95, 0.016);
    expect(buf[5]).toBe(0);
  });

  it("moves active particles by velocity * dt", () => {
    const buf = new Float64Array(5 * DEGEN_STRIDE);
    buf[0] = 100;
    buf[1] = 200;
    buf[2] = 50;
    buf[3] = -30;
    buf[4] = 1000;
    buf[5] = 1;

    tickParticles(buf, 5, 1000.5, 2.0, 0.95, 0.016);

    expect(buf[0]).toBeCloseTo(100 + 50 * 0.016, 5);
    expect(buf[1]).toBeCloseTo(200 + -30 * 0.016, 5);
  });

  it("applies drag to velocity each tick", () => {
    const buf = new Float64Array(5 * DEGEN_STRIDE);
    buf[2] = 100;
    buf[3] = 100;
    buf[4] = 1000;
    buf[5] = 1;

    tickParticles(buf, 5, 1000.5, 2.0, 0.9, 0.016);

    expect(buf[2]).toBeCloseTo(100 * 0.9, 5);
    expect(buf[3]).toBeCloseTo(100 * 0.9, 5);
  });

  it("skips inactive slots", () => {
    const buf = new Float64Array(5 * DEGEN_STRIDE);
    buf[0] = 100;
    buf[5] = 0;

    tickParticles(buf, 5, 1000, 2.0, 0.95, 0.016);
    expect(buf[0]).toBe(100);
  });
});
