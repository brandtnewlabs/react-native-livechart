import type { Marker, MarkerSide } from "../types";
import type { ProjectedMarker } from "./markers";

/**
 * Resolved {@link LiveChartProps.markerCluster} config (see `resolveMarkerCluster`).
 */
export interface ResolvedMarkerCluster {
  /** `"anchored"` = no collision handling (glyphs overlap). `"stacked"` = fan +
   *  collapse co-located markers. */
  mode: "anchored" | "stacked";
  /** Fraction (0–1) that adjacent co-located glyphs overlap when fanned. The fan
   *  step is `glyphHeight * (1 - overlap)`; `glyphHeight` is a slightly generous
   *  primitive estimate, so the *visible* overlap runs a touch lower. */
  overlap: number;
  /** Extra px between a sided glyph and its anchor. */
  gap: number;
  /** Collapse a co-located run to a single count badge once it exceeds this many. */
  maxBeforeGroup: number;
}

export interface ClusterMarkersOpts {
  config: ResolvedMarkerCluster;
}

/** Glyph box used when `marker.size` is unset — mirrors `markerAtlas.DEFAULT_ICON_SIZE`. */
const DEFAULT_GLYPH = 16;

/**
 * Estimated vertical (≈ horizontal) footprint of a marker glyph in px. Derived
 * from primitives only (no font metrics / atlas), so the hit-test hook and the
 * overlays compute identical offsets from identical inputs — keeping the drawn
 * and hit-tested positions in sync. Not pixel-exact with the atlas cell; the
 * generous default `markerHitRadius` absorbs the small difference.
 */
export function glyphHeight(m: Marker): number {
  "worklet";
  const size = m.size ?? DEFAULT_GLYPH;
  // The pill badge adds padding + a background ring around the icon glyph.
  return m.pill ? size + 8 : size;
}

function sideOf(m: Marker): MarkerSide {
  "worklet";
  return m.side ?? "center";
}

/**
 * Axis-anchored kinds (graduation stem, clawback box) whose geometry is pinned
 * to the baseline — they aren't fixed-size glyphs, so they don't stack or
 * collapse. Mirrors `markerAtlas.isConnectorMarker` (duplicated to keep this
 * math module free of the Skia-importing draw layer).
 */
function isConnector(m: Marker): boolean {
  "worklet";
  return !m.image && !m.icon && (m.kind === "graduation" || m.kind === "clawback");
}

/** Stable rank so the index sort groups markers by side. */
function sideRank(side: MarkerSide): number {
  "worklet";
  return side === "above" ? 0 : side === "center" ? 1 : 2;
}

/**
 * Lay out one co-located bucket `idx[s..e)` (already ordered by time), mutating
 * `proj`. All glyphs sit at the same `side` height (above / below / on the line)
 * and fan out HORIZONTALLY with a slight overlap — the "( ) ) )" stacked-coins
 * look, centered on the time anchor. When the bucket is larger than
 * `maxBeforeGroup` it collapses instead: one representative (the newest) is
 * flagged `isGrouped` with `groupCount`, the rest are `hidden` and point back via
 * `groupRep` (so a tap can gather the members).
 */
function layoutBucket(
  markers: Marker[],
  proj: ProjectedMarker[],
  idx: number[],
  s: number,
  e: number,
  side: MarkerSide,
  opts: ClusterMarkersOpts,
): void {
  "worklet";
  const count = e - s;
  const anchorX = proj[idx[s]].x;
  const anchorY = proj[idx[s]].y;
  const { gap, maxBeforeGroup } = opts.config;

  // Tallest glyph in the bucket sets the side offset and the horizontal step.
  let h = 0;
  for (let k = s; k < e; k++) {
    const gh = glyphHeight(markers[idx[k]]);
    if (gh > h) h = gh;
  }
  const sideDy =
    side === "above" ? -(h / 2 + gap) : side === "below" ? h / 2 + gap : 0;

  if (count > maxBeforeGroup) {
    // Collapse to a count badge at the representative (newest = last by time).
    const rep = idx[e - 1];
    for (let k = s; k < e; k++) {
      const p = proj[idx[k]];
      p.groupRep = rep;
      if (idx[k] === rep) {
        p.x = anchorX;
        p.y = anchorY + sideDy;
        p.isGrouped = true;
        p.groupCount = count;
        p.hidden = false;
      } else {
        p.hidden = true;
      }
    }
    return;
  }

  // Horizontal overlapping fan, centered on the anchor x. Glyphs share the side
  // height. Positions run right→left as the bucket order advances, so the newest
  // (last, highest array index) sits LEFTMOST — and since the overlay draws in
  // array order, it paints on top: a left-over-right cascade ("(" over ")" over ")").
  const step = h * (1 - opts.config.overlap);
  for (let j = 0; j < count; j++) {
    const p = proj[idx[s + j]];
    p.x = anchorX + ((count - 1) / 2 - j) * step;
    p.y = anchorY + sideDy;
    p.hidden = false;
    p.isGrouped = false;
    p.groupCount = 0;
    p.groupRep = -1;
  }
}

/**
 * Collision pass over projected markers, mutating `proj` in place.
 *
 * `"anchored"` mode only applies each marker's {@link Marker.side} offset (a lone
 * glyph sitting above/below its anchor); it does no bucketing, so charts that
 * don't use `side` are untouched. `"stacked"` mode additionally buckets
 * co-located markers (same side, overlapping x/y) and fans or collapses them.
 *
 * Runs every frame on the UI thread, so grouping is zoom/scroll-reactive. Reads
 * the *raw* projected positions from `projectMarkers` and overwrites them.
 */
export function clusterMarkers(
  markers: Marker[],
  proj: ProjectedMarker[],
  opts: ClusterMarkersOpts,
): void {
  "worklet";
  const n = markers.length;

  if (opts.config.mode !== "stacked") {
    // Side-only: shift sided glyphs off their anchor; no neighbor interaction.
    for (let i = 0; i < n; i++) {
      const p = proj[i];
      if (!p.visible || isConnector(markers[i])) continue;
      const side = sideOf(markers[i]);
      if (side === "center") continue;
      const off = glyphHeight(markers[i]) / 2 + opts.config.gap;
      p.y += side === "above" ? -off : off;
    }
    return;
  }

  // Collect visible indices, then order by (side, x, y, time) so co-located
  // same-side markers are adjacent and fan in time order.
  const idx: number[] = [];
  for (let i = 0; i < n; i++) if (proj[i].visible && !isConnector(markers[i])) idx.push(i);
  idx.sort((a, b) => {
    const sr = sideRank(sideOf(markers[a])) - sideRank(sideOf(markers[b]));
    if (sr !== 0) return sr;
    if (proj[a].x !== proj[b].x) return proj[a].x - proj[b].x;
    if (proj[a].y !== proj[b].y) return proj[a].y - proj[b].y;
    return markers[a].time - markers[b].time;
  });

  // Sweep into buckets: same side and within a glyph of the bucket's anchor in
  // BOTH axes (so two markers at the same time but far apart in value don't merge).
  let s = 0;
  while (s < idx.length) {
    const side = sideOf(markers[idx[s]]);
    const startX = proj[idx[s]].x;
    const startY = proj[idx[s]].y;
    const colPx = glyphHeight(markers[idx[s]]);
    let e = s + 1;
    while (
      e < idx.length &&
      sideOf(markers[idx[e]]) === side &&
      Math.abs(proj[idx[e]].x - startX) <= colPx &&
      Math.abs(proj[idx[e]].y - startY) <= colPx
    ) {
      e++;
    }
    layoutBucket(markers, proj, idx, s, e, side, opts);
    s = e;
  }
}

/**
 * Markers belonging to the collapsed cluster whose representative is `repIndex`
 * (ordered by time). Call after {@link clusterMarkers} has populated `proj`.
 */
export function clusterMembers(
  markers: Marker[],
  proj: ProjectedMarker[],
  repIndex: number,
): Marker[] {
  "worklet";
  const out: Marker[] = [];
  for (let i = 0; i < markers.length; i++) {
    if (proj[i] && proj[i].groupRep === repIndex) out.push(markers[i]);
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}
