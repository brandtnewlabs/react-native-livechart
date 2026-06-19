/**
 * Pure, worklet-safe clustering for reference-line grouping — collapse Form-A
 * lines whose value-Y positions sit near each other into one count handle. Free of
 * hooks / SharedValues so it unit-tests without Reanimated; the per-frame call +
 * rendering live in the controller / `ReferenceLineGroupOverlay`.
 */

/** One collapsed cluster of nearby reference lines. */
export interface ReferenceGroup {
  /** Centroid Y (canvas px) of the cluster — where the count handle is drawn. */
  cy: number;
  /** Number of lines collapsed into the cluster (≥ 2). */
  count: number;
}

/** Result of clustering a frame's reference-line Y positions. */
export interface ReferenceGrouping {
  /**
   * Index-aligned with the input Ys: `true` when this line's individual tag is
   * collapsed into a cluster (a multi-line group) and should be suppressed.
   */
  hidden: boolean[];
  /** One entry per multi-line cluster (singletons render normally, never here). */
  groups: ReferenceGroup[];
}

/**
 * Single-linkage cluster of reference-line handle Ys: lines whose sorted Y gaps are
 * all `<= radius` chain into one group. Entries `< 0` (not a Form-A line / off the
 * canvas) are ignored. Returns which lines are collapsed (`hidden`) plus a centroid
 * + count per multi-line cluster. A non-positive `radius` disables grouping.
 */
export function groupReferenceLines(
  ys: number[],
  radius: number,
): ReferenceGrouping {
  "worklet";
  const hidden: boolean[] = [];
  for (let i = 0; i < ys.length; i++) hidden.push(false);
  const groups: ReferenceGroup[] = [];
  if (radius <= 0) return { hidden, groups };

  const pts: { i: number; y: number }[] = [];
  for (let i = 0; i < ys.length; i++) {
    if (ys[i] >= 0) pts.push({ i, y: ys[i] });
  }
  pts.sort((a, b) => a.y - b.y);

  let c = 0;
  while (c < pts.length) {
    let j = c;
    let sum = pts[c].y;
    while (j + 1 < pts.length && pts[j + 1].y - pts[j].y <= radius) {
      j++;
      sum += pts[j].y;
    }
    const count = j - c + 1;
    if (count > 1) {
      for (let k = c; k <= j; k++) hidden[pts[k].i] = true;
      groups.push({ cy: sum / count, count });
    }
    c = j + 1;
  }
  return { hidden, groups };
}
