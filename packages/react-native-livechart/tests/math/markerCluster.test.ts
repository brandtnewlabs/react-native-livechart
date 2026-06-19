import {
  clusterMarkers,
  clusterMembers,
  glyphHeight,
} from "../../src/math/markerCluster";
import type { ClusterMarkersOpts } from "../../src/math/markerCluster";
import type { ProjectedMarker } from "../../src/math/markers";
import type { Marker } from "../../src/types";

const ANCHORED: ClusterMarkersOpts["config"] = {
  mode: "anchored",
  overlap: 0.6,
  gap: 2,
  maxBeforeGroup: 5,
};
const STACKED: ClusterMarkersOpts["config"] = {
  mode: "stacked",
  overlap: 0.6,
  gap: 2,
  maxBeforeGroup: 5,
};

function pm(x: number, y: number, visible = true): ProjectedMarker {
  return { x, y, visible, hidden: false, isGrouped: false, groupCount: 0, groupRep: -1 };
}

function trade(id: string, time: number, side?: Marker["side"], extra: Partial<Marker> = {}): Marker {
  return { id, time, kind: "trade", value: 50, side, ...extra };
}

describe("glyphHeight", () => {
  it("defaults to 16, honors size, and pads for a pill", () => {
    expect(glyphHeight(trade("a", 1))).toBe(16);
    expect(glyphHeight(trade("a", 1, undefined, { size: 24 }))).toBe(24);
    expect(glyphHeight(trade("a", 1, undefined, { icon: "+", pill: true, size: 16 }))).toBe(24);
  });
});

describe("clusterMarkers — anchored (side offsets only)", () => {
  it("shifts sided glyphs off the anchor and leaves center/invisible untouched", () => {
    const markers = [
      trade("above", 1, "above"),
      trade("below", 2, "below"),
      trade("center", 3, "center"),
      trade("hidden", 4, "above"),
    ];
    const proj = [pm(100, 100), pm(100, 100), pm(100, 100), pm(100, 100, false)];
    clusterMarkers(markers, proj, { config: ANCHORED });
    expect(proj[0].y).toBe(90); // above: -(16/2 + 2)
    expect(proj[1].y).toBe(110); // below: +(16/2 + 2)
    expect(proj[2].y).toBe(100); // center: unchanged
    expect(proj[3].y).toBe(100); // not visible: untouched
    expect(proj.every((p) => !p.isGrouped && !p.hidden)).toBe(true);
  });

  it("leaves connector kinds (graduation/clawback) alone", () => {
    const markers: Marker[] = [{ id: "g", time: 1, kind: "graduation", value: 50, side: "above" }];
    const proj = [pm(100, 100)];
    clusterMarkers(markers, proj, { config: ANCHORED });
    expect(proj[0].y).toBe(100);
  });
});

describe("clusterMarkers — stacked", () => {
  const STEP = 16 * (1 - 0.6); // glyphHeight(trade) * (1 - overlap)

  it("fans co-located same-side markers horizontally with overlap", () => {
    const markers = [trade("a", 1, "above"), trade("b", 2, "above"), trade("c", 3, "above")];
    const proj = [pm(100, 150), pm(100, 150), pm(100, 150)];
    clusterMarkers(markers, proj, { config: STACKED });
    // Centered on the anchor x, all at the "above" height (150 - (16/2 + 2) = 140).
    // Positions run right→left with bucket order (newest = leftmost, on top).
    expect(proj[0].x).toBeCloseTo(100 + STEP);
    expect(proj[1].x).toBeCloseTo(100);
    expect(proj[2].x).toBeCloseTo(100 - STEP);
    // Overlap: adjacent centers are closer than a glyph width (16) apart.
    expect(Math.abs(proj[1].x - proj[0].x)).toBeLessThan(16);
    expect(proj.every((p) => p.y === 140 && !p.hidden && !p.isGrouped)).toBe(true);
  });

  it("fans a center bucket on the line, symmetrically about the anchor", () => {
    const markers = [trade("a", 1, "center"), trade("b", 2, "center"), trade("c", 3, "center")];
    const proj = [pm(100, 150), pm(100, 150), pm(100, 150)];
    clusterMarkers(markers, proj, { config: STACKED });
    expect(proj[0].x).toBeCloseTo(100 + STEP);
    expect(proj[2].x).toBeCloseTo(100 - STEP);
    expect(proj.every((p) => p.y === 150)).toBe(true); // center: on the line
  });

  it("keeps opposite-side markers at the same point in separate stacks", () => {
    const markers = [trade("buy", 1, "below"), trade("sell", 2, "above")];
    const proj = [pm(100, 150), pm(100, 150)];
    clusterMarkers(markers, proj, { config: STACKED });
    expect(proj[0].y).toBe(160); // buy: below
    expect(proj[1].y).toBe(140); // sell: above
    expect(proj.every((p) => p.x === 100 && !p.hidden && !p.isGrouped)).toBe(true);
  });

  it("does not merge same-time markers that are far apart in value", () => {
    const markers = [trade("a", 1, "above"), trade("b", 2, "above")];
    const proj = [pm(100, 50), pm(100, 250)];
    clusterMarkers(markers, proj, { config: STACKED });
    expect(proj[0].y).toBe(40); // 50 - (16/2 + 2)
    expect(proj[1].y).toBe(240);
    expect(proj[0].x).toBe(100); // each is its own single-item bucket
    expect(proj[1].x).toBe(100);
  });

  it("fans (does not collapse) a bucket at the group threshold", () => {
    const markers = Array.from({ length: 5 }, (_, i) => trade(`m${i}`, i + 1, "above"));
    const proj = markers.map(() => pm(100, 150));
    clusterMarkers(markers, proj, { config: STACKED });
    expect(proj.every((p) => !p.isGrouped && !p.hidden)).toBe(true);
    // Fanned horizontally → five distinct x positions.
    expect(new Set(proj.map((p) => Math.round(p.x * 100))).size).toBe(5);
  });

  it("collapses a run larger than maxBeforeGroup into a count badge", () => {
    const markers = Array.from({ length: 6 }, (_, i) => trade(`m${i}`, i + 1, "above"));
    const proj = markers.map(() => pm(100, 150));
    clusterMarkers(markers, proj, { config: STACKED });
    const rep = proj[5]; // newest by time = representative
    expect(rep.isGrouped).toBe(true);
    expect(rep.groupCount).toBe(6);
    expect(rep.hidden).toBe(false);
    expect(rep.x).toBe(100); // centered at the anchor
    expect(rep.y).toBe(140); // at the side height
    // Every non-rep is hidden and points back at the rep.
    expect(proj.slice(0, 5).every((p) => p.hidden && p.groupRep === 5)).toBe(true);
    expect(clusterMembers(markers, proj, 5).map((m) => m.id)).toEqual([
      "m0", "m1", "m2", "m3", "m4", "m5",
    ]);
  });

  it("skips connector kinds when clustering", () => {
    const markers: Marker[] = [
      { id: "g", time: 1, kind: "graduation", value: 50, side: "above" },
      trade("t", 2, "above"),
    ];
    const proj = [pm(100, 150), pm(100, 150)];
    clusterMarkers(markers, proj, { config: STACKED });
    expect(proj[0].y).toBe(150); // connector untouched
    expect(proj[0].hidden).toBe(false);
  });
});
