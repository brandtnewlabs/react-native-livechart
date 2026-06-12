import {
  classifyReferenceEdge,
  collectReferenceValues,
  referenceLineForm,
  resolveReferenceBadge,
} from "../../src/math/referenceLines";

describe("resolveReferenceBadge", () => {
  it("returns null when neither badge nor offAxisBadge is set", () => {
    expect(resolveReferenceBadge({ value: 5 })).toBeNull();
  });

  it("resolves `badge: true` to left-pinned in-range defaults", () => {
    expect(resolveReferenceBadge({ value: 5, badge: true })).toEqual({
      position: "left",
      icon: "",
      showText: true,
      background: undefined,
      borderColor: undefined,
      radius: 5,
      inRange: true,
      legacyText: false,
    });
  });

  it("merges a badge config (icon, text, position, appearance)", () => {
    expect(
      resolveReferenceBadge({
        value: 5,
        badge: {
          position: "right",
          icon: "▲",
          text: false,
          background: "#111",
          borderColor: "#fff",
          radius: 8,
        },
      }),
    ).toEqual({
      position: "right",
      icon: "▲",
      showText: false,
      background: "#111",
      borderColor: "#fff",
      radius: 8,
      inRange: true,
      legacyText: false,
    });
  });

  it("falls back to the flat badge* fields when the config omits them", () => {
    const r = resolveReferenceBadge({
      value: 5,
      badge: { icon: "▲" },
      badgeBackground: "#abc",
      badgeBorderColor: "#def",
      badgeRadius: 9,
    });
    expect(r?.background).toBe("#abc");
    expect(r?.borderColor).toBe("#def");
    expect(r?.radius).toBe(9);
  });

  it("resolves the legacy offAxisBadge to an off-screen-only badge", () => {
    expect(resolveReferenceBadge({ value: 5, offAxisBadge: true })).toEqual({
      position: "left",
      icon: "",
      showText: true,
      background: undefined,
      borderColor: undefined,
      radius: 5,
      inRange: false,
      legacyText: true,
    });
  });

  it("prefers the badge config over the legacy offAxisBadge", () => {
    const r = resolveReferenceBadge({ value: 5, badge: true, offAxisBadge: true });
    expect(r?.inRange).toBe(true);
    expect(r?.legacyText).toBe(false);
  });
});

describe("referenceLineForm", () => {
  it("classifies a Form-A line", () => {
    expect(referenceLineForm({ value: 5 })).toBe("line");
  });

  it("classifies a Form-B value band", () => {
    expect(referenceLineForm({ valueFrom: 1, valueTo: 2 })).toBe("value-band");
  });

  it("classifies a Form-C time band", () => {
    expect(referenceLineForm({ from: 100, to: 200 })).toBe("time-band");
  });

  it("returns none for an empty line", () => {
    expect(referenceLineForm({})).toBe("none");
  });

  it("returns none for a half-specified band", () => {
    expect(referenceLineForm({ valueFrom: 1 })).toBe("none");
    expect(referenceLineForm({ from: 1 })).toBe("none");
  });

  it("applies precedence A > B > C", () => {
    expect(
      referenceLineForm({ value: 5, valueFrom: 1, valueTo: 2, from: 3, to: 4 }),
    ).toBe("line");
    expect(referenceLineForm({ valueFrom: 1, valueTo: 2, from: 3, to: 4 })).toBe(
      "value-band",
    );
  });
});

describe("collectReferenceValues", () => {
  it("gathers line + band values, excludes time bands", () => {
    expect(
      collectReferenceValues([
        { value: 5 },
        { valueFrom: 1, valueTo: 9 },
        { from: 100, to: 200 },
      ]),
    ).toEqual([5, 1, 9]);
  });

  it("skips lines flagged excludeFromRange", () => {
    expect(
      collectReferenceValues([
        { value: 5, excludeFromRange: true },
        { value: 7 },
      ]),
    ).toEqual([7]);
  });

  it("ignores form-less entries", () => {
    expect(collectReferenceValues([{}, { valueFrom: 1 }])).toEqual([]);
  });

  it("returns an empty array for no lines", () => {
    expect(collectReferenceValues([])).toEqual([]);
  });
});

describe("classifyReferenceEdge", () => {
  it("returns 'in' when inside the range", () => {
    expect(classifyReferenceEdge(5, 0, 10)).toBe("in");
  });

  it("returns 'above' when greater than max", () => {
    expect(classifyReferenceEdge(11, 0, 10)).toBe("above");
  });

  it("returns 'below' when less than min", () => {
    expect(classifyReferenceEdge(-1, 0, 10)).toBe("below");
  });

  it("treats the exact bounds as in-range", () => {
    expect(classifyReferenceEdge(0, 0, 10)).toBe("in");
    expect(classifyReferenceEdge(10, 0, 10)).toBe("in");
  });
});
