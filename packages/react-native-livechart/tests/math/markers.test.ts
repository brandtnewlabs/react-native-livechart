import {
  markersSignature,
  nearestMarkerIndex,
  projectMarkers,
  projectPoint,
  type ProjectedMarker,
} from "../../src/math/markers";
import type { Marker, SeriesConfig } from "../../src/types";

const BASE = {
  canvasWidth: 400,
  canvasHeight: 300,
  padTop: 12,
  padBottom: 28,
  padLeft: 12,
  padRight: 80,
  timestamp: 1000,
  displayWindow: 30,
  displayMin: 0,
  displayMax: 100,
};

describe("projectMarkers", () => {
  it("projects an absolute-value marker into the chart area", () => {
    const markers: Marker[] = [
      { id: "a", time: 990, kind: "trade", value: 50 },
    ];
    const out: ProjectedMarker[] = [];
    projectMarkers(markers, out, BASE);
    // x = 12 + ((990 - 970)/30)*(308) ; chartW = 400-80-12 = 308
    expect(out[0].visible).toBe(true);
    expect(out[0].x).toBeCloseTo(12 + (20 / 30) * 308);
    // y = 12 + ((100-50)/100)*(300-12-28) = 12 + 0.5*260 = 142
    expect(out[0].y).toBeCloseTo(142);
  });

  it("anchors to a series line by seriesId via interpolation", () => {
    const series: SeriesConfig[] = [
      {
        id: "s1",
        value: 0,
        data: [
          { time: 980, value: 20 },
          { time: 1000, value: 40 },
        ],
      },
    ];
    const markers: Marker[] = [
      { id: "a", time: 990, kind: "winner", seriesId: "s1" },
    ];
    const out: ProjectedMarker[] = [];
    projectMarkers(markers, out, { ...BASE, series });
    // interpolated value at t=990 is 30 → y = 12 + ((100-30)/100)*260 = 194
    expect(out[0].visible).toBe(true);
    expect(out[0].y).toBeCloseTo(194);
  });

  it("marks invisible when neither value nor a matching series resolves", () => {
    const out: ProjectedMarker[] = [];
    projectMarkers(
      [{ id: "a", time: 990, kind: "trade", seriesId: "missing" }],
      out,
      { ...BASE, series: [] },
    );
    expect(out[0].visible).toBe(false);
  });

  it("culls markers far outside the window", () => {
    const out: ProjectedMarker[] = [];
    projectMarkers([{ id: "a", time: 500, kind: "trade", value: 50 }], out, BASE);
    expect(out[0].visible).toBe(false);
  });

  it("marks invisible on a degenerate canvas / range", () => {
    const out: ProjectedMarker[] = [];
    projectMarkers([{ id: "a", time: 990, kind: "trade", value: 50 }], out, {
      ...BASE,
      canvasWidth: 0,
    });
    expect(out[0].visible).toBe(false);
  });

  it("reuses the out buffer and trims it to the marker count", () => {
    const out: ProjectedMarker[] = [
      { x: 1, y: 1, visible: true },
      { x: 2, y: 2, visible: true },
    ];
    projectMarkers([{ id: "a", time: 990, kind: "trade", value: 50 }], out, BASE);
    expect(out.length).toBe(1);
  });
});

describe("projectPoint", () => {
  it("projects a single absolute-value marker like the batch path", () => {
    const p = projectPoint(990, 50, undefined, BASE);
    expect(p.visible).toBe(true);
    expect(p.y).toBeCloseTo(142);
  });

  it("anchors to a series by id", () => {
    const series: SeriesConfig[] = [
      {
        id: "s1",
        value: 0,
        data: [
          { time: 980, value: 20 },
          { time: 1000, value: 40 },
        ],
      },
    ];
    const p = projectPoint(990, undefined, "s1", { ...BASE, series });
    expect(p.visible).toBe(true);
    expect(p.y).toBeCloseTo(194);
  });

  it("is invisible when neither value nor series resolves", () => {
    expect(projectPoint(990, undefined, "missing", { ...BASE, series: [] }).visible).toBe(
      false,
    );
  });
});

describe("markersSignature", () => {
  it("encodes id / kind / color / icon / size / image-presence", () => {
    expect(
      markersSignature([
        { id: "a", time: 1, kind: "trade", color: "#fff" },
        { id: "b", time: 2, kind: "winner" },
      ]),
    ).toBe("a\x1ftrade\x1f#fff\x1f\x1f\x1f0\x1eb\x1fwinner\x1f\x1f\x1f\x1f0");
  });

  it("changes when icon / size / image change", () => {
    const base: Marker = { id: "a", time: 1, kind: "trade" };
    expect(markersSignature([{ ...base, icon: "★" }])).not.toBe(
      markersSignature([base]),
    );
    expect(markersSignature([{ ...base, size: 20 }])).not.toBe(
      markersSignature([base]),
    );
    expect(markersSignature([{ ...base, image: {} as never }])).not.toBe(
      markersSignature([base]),
    );
  });
});

describe("nearestMarkerIndex", () => {
  const positions: ProjectedMarker[] = [
    { x: 10, y: 10, visible: true },
    { x: 100, y: 100, visible: true },
    { x: 12, y: 12, visible: false },
  ];

  it("returns the nearest visible marker within radius", () => {
    expect(nearestMarkerIndex(positions, 11, 11, 8)).toBe(0);
  });

  it("ignores invisible markers even when closer", () => {
    // (12,12) is invisible; (10,10) is the nearest visible to (12.5,12.5)
    expect(nearestMarkerIndex(positions, 12.5, 12.5, 8)).toBe(0);
  });

  it("returns -1 when nothing is within radius", () => {
    expect(nearestMarkerIndex(positions, 300, 300, 8)).toBe(-1);
  });

  it("breaks ties toward the later index", () => {
    const tied: ProjectedMarker[] = [
      { x: 50, y: 50, visible: true },
      { x: 50, y: 50, visible: true },
    ];
    expect(nearestMarkerIndex(tied, 50, 50, 8)).toBe(1);
  });
});
