import {
  classifyReferenceEdge,
  collectReferenceValues,
  referenceLineForm,
} from "../../src/math/referenceLines";

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
