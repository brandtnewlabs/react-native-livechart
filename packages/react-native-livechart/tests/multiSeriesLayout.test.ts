import {
  lineColorsSignatureFromArray,
  lineStyleSignatureFromArray,
  resolveMultiSeriesLineColorsSnapshot,
  resolveMultiSeriesLineStylesSnapshot,
} from "../src/core/multiSeriesLayout";

import { MAX_MULTI_SERIES } from "../src/constants";
import { SERIES_COLORS } from "../src/theme";
import type { SeriesConfig } from "../src/types";

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
    const a: SeriesConfig[] = [{ id: "a", data: [], value: 1, color: "#abc" }];
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

describe("lineStyleSignatureFromArray", () => {
  it("encodes style / strokeWidth / glow / intervals per series", () => {
    const a: SeriesConfig[] = [
      {
        id: "a",
        data: [],
        value: 1,
        style: "dashed",
        strokeWidth: 3,
        glow: true,
        intervals: [6, 4],
      },
      { id: "b", data: [], value: 2 },
    ];
    expect(lineStyleSignatureFromArray(a)).toBe(
      "a\x1fdashed\x1f3\x1f1\x1f6,4\x1eb\x1f\x1f\x1f0\x1f",
    );
  });

  it("changes when a style field changes", () => {
    const solid: SeriesConfig[] = [{ id: "a", data: [], value: 1 }];
    const dashed: SeriesConfig[] = [
      { id: "a", data: [], value: 1, style: "dashed" },
    ];
    expect(lineStyleSignatureFromArray(solid)).not.toBe(
      lineStyleSignatureFromArray(dashed),
    );
  });
});

describe("resolveMultiSeriesLineStylesSnapshot", () => {
  it("resolves dashed / width / glow and pads empty slots with defaults", () => {
    const a: SeriesConfig[] = [
      {
        id: "a",
        data: [],
        value: 1,
        style: "dashed",
        strokeWidth: 4,
        glow: true,
        intervals: [2, 2],
      },
    ];
    const snap = resolveMultiSeriesLineStylesSnapshot(a, 2);
    expect(snap[0]).toEqual({
      strokeWidth: 4,
      dashed: true,
      intervals: [2, 2],
      glow: true,
    });
    expect(snap[1]).toEqual({
      strokeWidth: undefined,
      dashed: false,
      intervals: [6, 4],
      glow: false,
    });
  });

  it("defaults to MAX_MULTI_SERIES length", () => {
    expect(resolveMultiSeriesLineStylesSnapshot([]).length).toBe(
      MAX_MULTI_SERIES,
    );
  });
});
