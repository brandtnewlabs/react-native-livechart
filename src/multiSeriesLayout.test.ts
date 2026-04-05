import {
  lineColorsSignatureFromArray,
  resolveMultiSeriesLineColorsSnapshot,
} from "./multiSeriesLayout";

import type { SeriesConfig } from "./types";
import { MAX_MULTI_SERIES } from "./constants";
import { SERIES_COLORS } from "./theme";

describe("lineColorsSignatureFromArray", () => {
  it("joins id and color for each series", () => {
    const a: SeriesConfig[] = [
      { id: "a", data: [], value: 1, color: "#f00" },
      { id: "b", data: [], value: 2 },
    ];
    expect(lineColorsSignatureFromArray(a)).toBe(`a\x1f#f00\x1eb\x1f`);
  });
});

describe("resolveMultiSeriesLineColorsSnapshot", () => {
  it("fills palette slots and pads with white", () => {
    const a: SeriesConfig[] = [{ id: "a", data: [], value: 1 }];
    const snap = resolveMultiSeriesLineColorsSnapshot(a, 3);
    expect(snap[0]).toBe("#3b82f6");
    expect(snap[1]).toBe("#ffffff");
    expect(snap[2]).toBe("#ffffff");
  });

  it("uses explicit series color when set", () => {
    const a: SeriesConfig[] = [
      { id: "a", data: [], value: 1, color: "#abc" },
    ];
    expect(resolveMultiSeriesLineColorsSnapshot(a)[0]).toBe("#abc");
  });

  it("defaults to MAX_MULTI_SERIES length", () => {
    const snap = resolveMultiSeriesLineColorsSnapshot([]);
    expect(snap.length).toBe(MAX_MULTI_SERIES);
    expect(snap.every((c) => c === "#ffffff")).toBe(true);
  });

  it("cycles SERIES_COLORS by index", () => {
    const many: SeriesConfig[] = Array.from({ length: 3 }, (_, i) => ({
      id: `${i}`,
      data: [],
      value: i,
    }));
    const snap = resolveMultiSeriesLineColorsSnapshot(many);
    expect(snap[0]).toBe(SERIES_COLORS[0 % SERIES_COLORS.length]);
    expect(snap[1]).toBe(SERIES_COLORS[1 % SERIES_COLORS.length]);
  });
});
