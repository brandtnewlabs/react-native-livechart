import { renderHook } from "@testing-library/react-native";
import { useAnimatedReaction, type SharedValue } from "react-native-reanimated";
import type { SkFont } from "@shopify/react-native-skia";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { useReferenceTagStack } from "../../src/hooks/useReferenceTagStack";
import type { ReferenceTagStack } from "../../src/math/referenceTagStack";
import type { ReferenceLine } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated"),
  useAnimatedReaction: jest.fn(),
}));
const shared = <T,>(value: T) => withSharedValueAccessors({ sv: { value } }).sv as unknown as SharedValue<T>;
const engine = withSharedValueAccessors({ canvasWidth: { value: 400 }, canvasHeight: { value: 300 }, displayMin: { value: 0 }, displayMax: { value: 100 } }) as unknown as ChartEngineLayout;
const font = { getSize: () => 12, measureText: (text: string) => ({ width: text.length * 7, x: 0 }), getMetrics: () => ({ ascent: -9, descent: 3 }) } as SkFont;
const padding = { top: 12, bottom: 28, left: 12, right: 80 };
const lines: ReferenceLine[] = [{ id: "custom", value: 200, badge: true }, { id: "builtin", value: 50, badge: true, label: "BUY", valueBadge: true }];
function setupProps(): Parameters<typeof useReferenceTagStack>[0] {
  return { enabled: true, radius: 18, engine, padding, lines, keys: ["custom", "builtin"], custom: [true, false], offAxisCustom: [false, false],
    customSizes: shared<import("../../src/hooks/useReferenceTagStack").CustomTagSizes>({ custom: { width: 100, height: 40 } }), font, formatValue: (v: number) => String(v), dragValues: shared([200, 50]), valueAxis: { float: false }, obstacle: null,
    output: shared<ReferenceTagStack>({ offsets: [], valueOffsets: [], tags: [] }),
  };
}
function compute() {
  const calls = (useAnimatedReaction as jest.Mock).mock.calls;
  const [prepare, react] = calls[calls.length - 1];
  const next = prepare(); react(next, null); return next as ReferenceTagStack;
}
it("measures custom tags by stable identity, matches inset pinning, and emits separate name/value rectangles", async () => {
  const props = setupProps();
  await renderHook(() => useReferenceTagStack(props));
  const result = compute();
  expect(result.tags).toHaveLength(3);
  const custom = result.tags.find(t => t.kind === "custom")!;
  expect(custom.lineY).toBe(24); // same 12 px edge inset as the RN wrapper
  expect(custom.w).toBe(100);
  expect(custom.h).toBe(40);
  // Packed within the canvas: the tall tag stays centered on its pinned line,
  // spilling into the top inset rather than being pushed down off it.
  expect(custom.y + custom.h / 2 + custom.offsetY).toBe(custom.lineY);
  expect(custom.y + custom.offsetY).toBeGreaterThanOrEqual(0);
  expect(result.tags.find(t => t.kind === "value")?.index).toBe(1);
});
it("returns no stacking geometry when disabled", async () => {
  await renderHook(() => useReferenceTagStack({ ...setupProps(), enabled: false }));
  expect(compute().tags).toEqual([]);
});
it("replaces built-ins with measured off-axis tags only when the value leaves range", async () => {
  const props = setupProps();
  props.custom = [false, false]; props.offAxisCustom = [true, false];
  await renderHook(() => useReferenceTagStack(props));
  expect(compute().tags.some(t => t.kind === "custom")).toBe(true);
  props.dragValues.set([50, 50]);
  expect(compute().tags.some(t => t.kind === "custom")).toBe(false);
});
it("keeps a tag centered on a line at the plot's edge, spilling into the inset", async () => {
  const props = setupProps();
  props.lines = [{ id: "top", value: 100, valueBadge: true }, { id: "bottom", value: 0, valueBadge: true }];
  props.keys = ["top", "bottom"]; props.custom = [false, false];
  props.dragValues.set([100, 0]);
  await renderHook(() => useReferenceTagStack(props));
  const tags = compute().tags;
  expect(tags.map(t => t.lineId)).toEqual(["top", "bottom"]);
  expect(tags[0].lineY).toBe(padding.top);
  expect(tags[1].lineY).toBe(300 - padding.bottom);
  for (const t of tags) {
    expect(t.offsetY).toBe(0);
    expect(t.y + t.h / 2).toBeCloseTo(t.lineY);
  }
});
it("emits no tags, built-in or custom, for an off-axis line with offAxis: \"hide\"", async () => {
  const props = setupProps();
  props.lines = [{ id: "custom", value: 200, badge: true, offAxis: "hide" }, { id: "builtin", value: 200, badge: true, valueBadge: true, offAxis: "hide" }];
  props.custom = [false, false]; props.offAxisCustom = [true, false];
  props.dragValues.set([200, 200]);
  await renderHook(() => useReferenceTagStack(props));
  expect(compute().tags).toEqual([]);
  props.dragValues.set([50, 50]);
  expect(compute().tags.map(t => t.kind).sort()).toEqual(["name", "name", "value"]);
});
