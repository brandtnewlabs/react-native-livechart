import { renderHook } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { useReferenceLineGrouping } from "../../src/hooks/useReferenceLineGrouping";
import type { ReferenceLine } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

// Evaluate the production grouping worklet on each read so live values and
// layout changes can be exercised without the native UI-thread test shim.
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated"),
  useDerivedValue: (updater: () => unknown) => ({ get: updater }),
}));

async function setup(
  lines: ReferenceLine[],
  options: {
    height?: number;
    radius?: number | null;
    custom?: boolean[];
    offAxisCustom?: boolean[];
  } = {},
) {
  const engine = withSharedValueAccessors({
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    canvasHeight: { value: options.height ?? 300 },
  }) as unknown as ChartEngineLayout;
  const dragValues = withSharedValueAccessors({
    values: { value: lines.map((l) => l.value ?? 0) },
  }).values as unknown as SharedValue<number[]>;
  const hook = await renderHook(() => useReferenceLineGrouping({
    radius: options.radius === undefined ? 18 : options.radius,
    engine,
    padding: DEFAULT_PADDING,
    lines,
    custom: options.custom ?? [],
    offAxisCustom: options.offAxisCustom ?? [],
    dragValues,
  }));
  return { ...hook, engine, dragValues };
}

describe("useReferenceLineGrouping", () => {
  it("collapses far-above badges and far-below badges at their respective edges", async () => {
    const { result } = await setup([
      { value: 200, badge: true },
      { value: -100, badge: true },
      { value: 300, badge: { position: "right" } },
      { value: -200, offAxisBadge: true },
    ]);
    expect(result.current.refGroupResult.get()).toEqual({
      hidden: [true, true, true, true],
      groups: [{ cy: 12, count: 2 }, { cy: 272, count: 2 }],
    });
    expect(result.current.groupHidden.get()).toEqual([true, true, true, true]);
  });

  it.each([200, -100])("does not count invisible plain lines at either edge (value=%s)", async (value) => {
    const { result } = await setup([
      { value, badge: true },
      { value, label: "Hidden plain line" },
      { value, badge: false },
    ]);
    expect(result.current.refGroupResult.get()).toEqual({
      hidden: [false, false, false], groups: [],
    });
  });

  it("counts only the two visible badges when a plain off-axis line joins them", async () => {
    const { result } = await setup([
      { value: 200, badge: true },
      { value: 300, badge: true },
      { value: 400 },
    ]);
    expect(result.current.refGroupResult.get()).toEqual({
      hidden: [true, true, false], groups: [{ cy: 12, count: 2 }],
    });
  });

  it("still groups plain labels that are inside the visible range", async () => {
    const { result } = await setup([{ value: 50 }, { value: 51 }]);
    expect(result.current.refGroupResult.get().groups).toEqual([{ cy: 140.7, count: 2 }]);
  });

  it("excludes custom tags, off-axis custom tags, and non-scalar reference forms", async () => {
    const { result } = await setup([
      { value: 200, badge: true },
      { value: 300, badge: true },
      { value: 400, badge: true },
      { valueFrom: 200, valueTo: 300 },
      { from: 0, to: 30 },
      { series: [{ time: 0, value: 200 }] },
      {},
    ], { custom: [false, true], offAxisCustom: [false, false, true] });
    expect(result.current.refGroupResult.get()).toEqual({
      hidden: [false, false, false, false, false, false, false], groups: [],
    });
  });

  it("recomputes groups when live drag values and the axis change", async () => {
    const { result, dragValues, engine } = await setup([
      { value: 25, badge: true },
      { value: 75, badge: true },
    ]);
    expect(result.current.refGroupResult.get().groups).toEqual([]);
    dragValues.set([200, 300]);
    expect(result.current.refGroupResult.get().groups).toEqual([{ cy: 12, count: 2 }]);
    engine.displayMax.set(400);
    expect(result.current.refGroupResult.get().groups).toEqual([]);
    engine.canvasHeight.set(40);
    expect(result.current.groupHidden.get()).toEqual([false, false]);
  });

  it.each([0, 40])("does not group before the plot has height (height=%s)", async (height) => {
    const { result } = await setup([{ value: 200, badge: true }, { value: 300, badge: true }], { height });
    expect(result.current.refGroupResult.get()).toEqual({ hidden: [false, false], groups: [] });
  });

  it.each([null, 0])("can disable grouping (radius=%s)", async (radius) => {
    const { result } = await setup([{ value: 200, badge: true }, { value: 300, badge: true }], { radius });
    expect(result.current.refGroupResult.get().groups).toEqual([]);
    expect(result.current.groupHidden.get().some(Boolean)).toBe(false);
  });
});

  it("counts each two-pill row once, including value-only off-axis pills", async () => {
    const { result } = await setup([
      { value: 200, badge: true, valueBadge: true },
      { value: 300, valueBadge: { position: "axis" } },
      { value: 400 },
    ]);
    expect(result.current.refGroupResult.get()).toEqual({
      hidden: [true, true, false], groups: [{ cy: 12, count: 2 }],
    });
  });
