/** Screen rectangles shared by reference-tag drawing and interaction. */
export interface TagRect { x: number; y: number; w: number; h: number }
export interface ReferenceTag extends TagRect {
  index: number;
  lineId?: string;
  key: string;
  kind: "name" | "value" | "custom";
  /** Original projected price Y; displacement never changes the price. */
  lineY: number;
}
export interface StackedReferenceTag extends ReferenceTag { offsetY: number }
export interface ReferenceTagStack {
  offsets: number[];
  valueOffsets: number[];
  tags: StackedReferenceTag[];
}
export const EMPTY_TAG_STACK: ReferenceTagStack = { offsets: [], valueOffsets: [], tags: [] };

export function overlapsX(a: TagRect, b: TagRect): boolean {
  "worklet";
  return a.x < b.x + b.w && b.x < a.x + a.w;
}

/** Fit an ordered column without changing its order. Null means it cannot fit. */
function pack(tags: ReferenceTag[], top: number, bottom: number, radius: number): number[] | null {
  "worklet";
  if (!tags.length) return [];
  const ys: number[] = [];
  for (let i = 0; i < tags.length; i++) {
    const t = tags[i];
    const min = i === 0 ? top + t.h / 2 : ys[i - 1] + Math.max(radius, (tags[i - 1].h + t.h) / 2 + 2);
    ys.push(Math.max(min, t.y + t.h / 2));
  }
  ys[ys.length - 1] = Math.min(ys[ys.length - 1], bottom - tags[tags.length - 1].h / 2);
  for (let i = ys.length - 2; i >= 0; i--)
    ys[i] = Math.min(ys[i], ys[i + 1] - Math.max(radius, (tags[i].h + tags[i + 1].h) / 2 + 2));
  return ys[0] >= top + tags[0].h / 2 - 0.001 ? ys : null;
}

/**
 * Pack only horizontally intersecting columns. Opposite edges stay independent.
 * A fixed value-badge obstacle divides a column into above/below slots; choose
 * the feasible split with the smallest total squared displacement. If there is
 * physically insufficient height, retain every tag in bounds with best-effort
 * spacing rather than hiding levels or moving their prices.
 */
export function stackReferenceTags(
  input: ReferenceTag[], top: number, bottom: number, radius = 18, obstacle: TagRect | null = null,
): ReferenceTagStack {
  "worklet";
  const result: ReferenceTagStack = { offsets: [], valueOffsets: [], tags: [] };
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return result;
  const tags = input.filter(t => [t.x, t.y, t.w, t.h, t.lineY].every(v => Number.isFinite(v)) && t.w > 0 && t.h > 0);
  const separation = Number.isFinite(radius) && radius >= 0 ? radius : 18;
  const visited: boolean[] = [];
  for (let first = 0; first < tags.length; first++) {
    if (visited[first]) continue;
    const component = [tags[first]];
    visited[first] = true;
    for (let j = 0; j < component.length; j++) {
      for (let k = 0; k < tags.length; k++) {
        if (!visited[k] && overlapsX(component[j], tags[k])) {
          visited[k] = true;
          component.push(tags[k]);
        }
      }
    }
    component.sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const blocked = obstacle && obstacle.h > 0 && obstacle.y < bottom && obstacle.y + obstacle.h > top && component.some(t => overlapsX(t, obstacle));
    let positions: number[] | null = null;
    if (blocked && obstacle) {
      let bestCost = Infinity;
      for (let split = 0; split <= component.length; split++) {
        const above = pack(component.slice(0, split), top, Math.min(bottom, obstacle.y - 2), separation);
        const below = pack(component.slice(split), Math.max(top, obstacle.y + obstacle.h + 2), bottom, separation);
        if (!above || !below) continue;
        const candidate = above.concat(below);
        let cost = 0;
        for (let j = 0; j < candidate.length; j++) cost += (candidate[j] - component[j].y - component[j].h / 2) ** 2;
        if (cost < bestCost) { positions = candidate; bestCost = cost; }
      }
    } else positions = pack(component, top, bottom, separation);
    if (!positions) {
      // Crowded charts cannot guarantee separation. Keep stable price ordering
      // and bounded centers; never silently collapse or discard a reference.
      positions = component.map((t, i) => {
        const half = Math.min(t.h / 2, (bottom - top) / 2);
        return Math.max(top + half, Math.min(bottom - half,
          component.length === 1 ? t.y + t.h / 2 : top + half + (bottom - top - 2 * half) * i / (component.length - 1)));
      });
    }
    for (let j = 0; j < component.length; j++) {
      const tag = component[j];
      const offsetY = positions[j] - tag.y - tag.h / 2;
      if (tag.kind === "value") result.valueOffsets[tag.index] = offsetY;
      else result.offsets[tag.index] = offsetY;
      result.tags.push({ ...tag, y: tag.y + offsetY, offsetY });
    }
  }
  return result;
}

/** Exact rectangles beat inflated targets when adjacent tags have a small gap. */
export function stackedTagAt(tags: StackedReferenceTag[], x: number, y: number): StackedReferenceTag | null {
  "worklet";
  let hit: StackedReferenceTag | null = null;
  for (let i = tags.length - 1; i >= 0; i--) {
    const t = tags[i];
    if ((!hit || t.index > hit.index) && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) hit = t;
  }
  return hit;
}
