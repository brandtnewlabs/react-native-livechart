import { insertionSortByX, type XAxisEntry } from "./useXAxis";

describe("insertionSortByX", () => {
  it("sorts entries by x ascending", () => {
    const arr: XAxisEntry[] = [
      { x: 30, label: "c", alpha: 1 },
      { x: 10, label: "a", alpha: 1 },
      { x: 20, label: "b", alpha: 1 },
    ];
    insertionSortByX(arr);
    expect(arr.map((e) => e.x)).toEqual([10, 20, 30]);
  });

  it("handles already sorted and single element", () => {
    const one: XAxisEntry[] = [{ x: 5, label: "x", alpha: 1 }];
    insertionSortByX(one);
    expect(one).toHaveLength(1);

    const sorted: XAxisEntry[] = [
      { x: 1, label: "a", alpha: 1 },
      { x: 2, label: "b", alpha: 1 },
    ];
    insertionSortByX(sorted);
    expect(sorted[0].x).toBe(1);
  });
});
