import { stackReferenceTags, stackedTagAt, type ReferenceTag } from "../../src/math/referenceTagStack";

const tag = (index: number, extra: Partial<ReferenceTag> = {}): ReferenceTag => ({
  index, key: String(index), kind: "name", x: 10, y: 100, w: 60, h: 20, lineY: 110, ...extra,
});
const overlap = (a: ReferenceTag, b: ReferenceTag) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

it("keeps opposite sides independent and original price positions intact", () => {
  const result = stackReferenceTags([tag(0), tag(1, { x: 250 }), tag(2)], 10, 290);
  expect(result.offsets[0]).toBe(0);
  expect(result.offsets[1]).toBe(0);
  expect(result.offsets[2]).toBe(22);
  expect(result.tags.every(t => t.lineY === 110)).toBe(true);
});

it("packs different heights and name/value pills separately", () => {
  const result = stackReferenceTags([
    tag(0, { h: 36 }), tag(1, { h: 12 }),
    tag(0, { key: "0:value", kind: "value", x: 320 }),
    tag(1, { key: "1:value", kind: "value", x: 320 }),
  ], 10, 290, 0);
  for (const a of result.tags) for (const b of result.tags) if (a !== b) expect(overlap(a, b)).toBe(false);
  expect(result.offsets[0]).not.toBe(result.valueOffsets[0]);
});

it("reserves only horizontally intersecting live badges", () => {
  const obstacle = { x: 300, y: 95, w: 80, h: 30 };
  const result = stackReferenceTags([tag(0), tag(1, { x: 310 }), tag(2, { x: 310 })], 10, 290, 18, obstacle);
  expect(result.offsets[0]).toBe(0);
  for (const t of result.tags) expect(overlap(t, obstacle as ReferenceTag)).toBe(false);
  expect(result.tags[1].y + result.tags[1].h).toBeLessThanOrEqual(result.tags[2].y);
});

it("fits an edge-pinned column around a badge at the top and bottom", () => {
  for (const y of [0, 180]) {
    const obstacle = { x: 10, y, w: 60, h: 20 };
    const result = stackReferenceTags([tag(0, { y }), tag(1, { y }), tag(2, { y })], 0, 200, 18, obstacle);
    for (const t of result.tags) {
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y + t.h).toBeLessThanOrEqual(200);
      expect(overlap(t, obstacle as ReferenceTag)).toBe(false);
    }
  }
});

it("uses stable keys for equal-price ordering after array reorder", () => {
  const input = [tag(0, { key: "z" }), tag(1, { key: "a", kind: "custom", h: 40 })];
  const before = stackReferenceTags(input, 0, 300).tags;
  const after = stackReferenceTags(input.slice().reverse(), 0, 300).tags;
  expect(after.map(t => [t.key, t.y])).toEqual(before.map(t => [t.key, t.y]));
});

it("retains crowded tags with bounded centers and finite offsets", () => {
  const result = stackReferenceTags(Array.from({ length: 12 }, (_, i) => tag(i)), 0, 50);
  expect(result.tags).toHaveLength(12);
  for (const t of result.tags) {
    expect(t.y).toBeGreaterThanOrEqual(0);
    expect(t.y + t.h).toBeLessThanOrEqual(50);
    expect(Number.isFinite(t.offsetY)).toBe(true);
  }
});

it("ignores unmeasured/invalid geometry and handles an empty plot", () => {
  expect(stackReferenceTags([tag(0, { h: 0 }), tag(1, { y: NaN })], 0, 300).tags).toEqual([]);
  expect(stackReferenceTags([tag(0)], 10, 10).tags).toEqual([]);
});

it("hit-tests the displaced rectangle and honors drawing order", () => {
  const result = stackReferenceTags([tag(0), tag(1)], 0, 300);
  expect(stackedTagAt(result.tags, 20, 135)?.index).toBe(1);
  expect(stackedTagAt(result.tags, 100, 135)).toBeNull();
  const dense = stackReferenceTags([tag(5), tag(2)], 0, 20);
  expect(stackedTagAt(dense.tags, 20, 10)?.index).toBe(5);
});
