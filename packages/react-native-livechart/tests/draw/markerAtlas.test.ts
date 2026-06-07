import {
  buildMarkerAtlas,
  defaultMarkerColor,
  isConnectorMarker,
  markerAppearanceSig,
} from "../../src/draw/markerAtlas";
import { resolveTheme } from "../../src/theme";
import type { Marker } from "../../src/types";

const palette = resolveTheme("#3b82f6", "dark");

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;

function m(over: Partial<Marker> & Pick<Marker, "id">): Marker {
  return { time: 100, kind: "trade", ...over } as Marker;
}

describe("markerAppearanceSig", () => {
  it("ignores position/anchor but distinguishes visual fields", () => {
    // Same appearance, different time/value → same signature (one shared cell).
    expect(markerAppearanceSig(m({ id: "a", icon: "+", pill: true, time: 1 }))).toBe(
      markerAppearanceSig(m({ id: "b", icon: "+", pill: true, time: 999, value: 5 })),
    );
    // Pill vs no-pill differ; color differs; kind differs.
    expect(markerAppearanceSig(m({ id: "a", icon: "+", pill: true }))).not.toBe(
      markerAppearanceSig(m({ id: "a", icon: "+" })),
    );
    expect(markerAppearanceSig(m({ id: "a", kind: "winner" }))).not.toBe(
      markerAppearanceSig(m({ id: "a", kind: "boost" })),
    );
    // Image markers key on id (can't share a texture cell with another image).
    expect(
      markerAppearanceSig(m({ id: "x", image: {} as never })),
    ).not.toBe(markerAppearanceSig(m({ id: "y", image: {} as never })));
  });
});

describe("isConnectorMarker", () => {
  it("is true only for axis-anchored kinds without an icon/image override", () => {
    expect(isConnectorMarker(m({ id: "a", kind: "graduation" }))).toBe(true);
    expect(isConnectorMarker(m({ id: "a", kind: "clawback" }))).toBe(true);
    expect(isConnectorMarker(m({ id: "a", kind: "trade" }))).toBe(false);
    // An icon/image override turns it into an ordinary atlas stamp.
    expect(isConnectorMarker(m({ id: "a", kind: "graduation", icon: "!" }))).toBe(false);
  });
});

describe("buildMarkerAtlas", () => {
  it("returns an empty atlas when there are no stamp markers", () => {
    const atlas = buildMarkerAtlas(
      [m({ id: "g", kind: "graduation" }), m({ id: "c", kind: "clawback" })],
      palette,
      font,
    );
    expect(atlas.image).toBeNull();
    expect(Object.keys(atlas.cells)).toHaveLength(0);
  });

  it("packs one cell per distinct appearance and shares duplicates", () => {
    const markers: Marker[] = [
      m({ id: "1", icon: "+", pill: true, color: "#16a34a" }),
      m({ id: "2", icon: "−", pill: true, color: "#dc2626" }),
      m({ id: "3", icon: "+", pill: true, color: "#16a34a" }), // dup of #1
      m({ id: "4", kind: "winner" }),
    ];
    const atlas = buildMarkerAtlas(markers, palette, font);
    // 3 distinct appearances: green +, red −, winner.
    expect(Object.keys(atlas.cells)).toHaveLength(3);
    expect(atlas.image).not.toBeNull();
    // Cells are keyed by appearance signature, not by marker id/order.
    expect(atlas.cells[markerAppearanceSig(markers[0])]).toBeDefined();
    expect(atlas.cells[markerAppearanceSig(markers[0])]).toBe(
      atlas.cells[markerAppearanceSig(markers[2])],
    );
  });

  it("produces the same cell set regardless of marker order (no index aliasing)", () => {
    const a = m({ id: "a", icon: "+", pill: true });
    const b = m({ id: "b", kind: "boost" });
    const c = m({ id: "c", icon: "★" });
    const forward = buildMarkerAtlas([a, b, c], palette, font);
    const reordered = buildMarkerAtlas([c, a, b], palette, font);
    expect(Object.keys(forward.cells).sort()).toEqual(
      Object.keys(reordered.cells).sort(),
    );
  });

  it("builds cells for image and trade markers", () => {
    const atlas = buildMarkerAtlas(
      [
        m({ id: "img", image: { width: () => 24, height: () => 12 } as never, size: 20 }),
        m({ id: "t", kind: "trade" }),
      ],
      palette,
      font,
    );
    expect(Object.keys(atlas.cells)).toHaveLength(2);
  });
});

describe("defaultMarkerColor", () => {
  it("maps every kind to a palette color", () => {
    for (const kind of ["trade", "boost", "graduation", "winner", "clawback"] as const) {
      expect(typeof defaultMarkerColor(kind, palette)).toBe("string");
    }
  });
});
