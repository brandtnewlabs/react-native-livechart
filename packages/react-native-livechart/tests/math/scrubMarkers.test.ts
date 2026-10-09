import { matchScrubMarkers, scrubMarkerRange } from "../../src/math/scrubMarkers";
import type { Marker } from "../../src/types";

const marker = (time: number, id = String(time)): Marker => ({ id, time, kind: "trade" });
const lineRange = (time = 150, window = 100, width = 200, radius = 16) =>
  scrubMarkerRange(time, 200, window, width, radius, false, null, 60);

describe("scrub marker matching", () => {
  it("uses horizontal pixels, including both boundaries, without a Y hit test", () => {
    const markers = [marker(141), marker(142), { ...marker(150), value: 9999 }, marker(158), marker(159)];
    expect(matchScrubMarkers(markers, lineRange()).map((m) => m.time)).toEqual([142, 150, 158]);
    // Zooming in halves the time tolerance for the same physical touch target.
    expect(matchScrubMarkers(markers, lineRange(150, 50)).map((m) => m.time)).toEqual([150]);
    // A narrower layout doubles it again.
    const narrow = scrubMarkerRange(150, 175, 50, 100, 16, false, null, 60);
    expect(matchScrubMarkers(markers, narrow).map((m) => m.time)).toEqual([142, 150, 158]);
  });

  it("returns all co-located trades in input order, preserving metadata", () => {
    const markers = [
      { ...marker(150, "sell"), data: { quantity: 2 }, side: "above" as const },
      { ...marker(150, "buy"), data: { quantity: 3 }, side: "below" as const },
    ];
    const matches = matchScrubMarkers(markers, lineRange());
    expect(matches).toEqual(markers);
    expect(matches[0]).toBe(markers[0]);
    expect(matches[1].data).toBe(markers[1].data);
  });

  it("does not select line markers outside the drawn time window or from a gutter", () => {
    const markers = [marker(99), marker(100), marker(200), marker(201)];
    expect(matchScrubMarkers(markers, lineRange(100))).toEqual([markers[1]]);
    expect(matchScrubMarkers(markers, lineRange(200))).toEqual([markers[2]]);
    expect(matchScrubMarkers(markers, lineRange(99))).toEqual([]);
    expect(matchScrubMarkers(markers, lineRange(201))).toEqual([]);
  });

  it("uses a half-open candle bucket, independent of the line radius and execution price", () => {
    const markers = [marker(119), marker(120), marker(150), marker(179.99), marker(180)];
    const range = scrubMarkerRange(140, 200, 100, 200, 0, true, 120, 60);
    expect(matchScrubMarkers(markers, range)).toEqual(markers.slice(1, 4));
    const next = scrubMarkerRange(180, 240, 100, 200, 99, true, 180, 60);
    expect(matchScrubMarkers(markers, next)).toEqual([markers[4]]);
  });

  it("allows exact line timestamps with a zero radius and ignores invalid marker times", () => {
    const markers = [marker(NaN), marker(Infinity), marker(149.99), marker(150)];
    expect(matchScrubMarkers(markers, lineRange(150, 100, 200, 0))).toEqual([markers[3]]);
  });

  it.each([
    [-1, 200, 100, 200, false, null, 60],
    [NaN, 200, 100, 200, false, null, 60],
    [150, Infinity, 100, 200, false, null, 60],
    [150, 200, 0, 200, false, null, 60],
    [150, 200, Infinity, 200, false, null, 60],
    [150, 200, 100, 0, false, null, 60],
    [150, 200, 100, NaN, false, null, 60],
    [150, 200, 100, 200, true, null, 60],
    [150, 200, 100, 200, true, NaN, 60],
    [150, 200, 100, 200, true, 120, 0],
    [150, 200, 100, 200, true, 120, Infinity],
  ] as const)("selects nothing for invalid/inactive geometry (%s, %s, %s, %s)",
    (time, now, window, width, candleMode, candleTime, candleWidth) => {
      const range = scrubMarkerRange(time, now, window, width, 16, candleMode, candleTime, candleWidth);
      expect(matchScrubMarkers([marker(150)], range)).toEqual([]);
    });
});
