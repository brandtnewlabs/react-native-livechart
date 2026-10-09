import type { SharedValue } from "react-native-reanimated";
import { renderHook } from "@testing-library/react-native";
import type { SkFont } from "@shopify/react-native-skia";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { useReferenceLinePress } from "../../src/hooks/useReferenceLinePress";
import type { ReferenceLine } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated"),
  useDerivedValue: (updater: () => unknown) => ({ get: updater }),
}));
const font = {
  getSize: () => 12,
  measureText: (text: string) => ({ width: text.length * 7, x: 0 }),
  getMetrics: () => ({ ascent: -9, descent: 3 }),
} as SkFont;
const fmt = (v: number) => String(v);
const engine = withSharedValueAccessors({
  canvasWidth: { value: 400 },
  canvasHeight: { value: 300 },
  displayMin: { value: 0 },
  displayMax: { value: 100 },
}) as unknown as ChartEngineLayout;
const padding = { left: 12, right: 80, top: 12, bottom: 28 };
const line: ReferenceLine = {
  id: "order",
  value: 50,
  label: "BUY",
  badge: true,
  valueBadge: { position: "axis" },
};

it("both pills target one line, with an empty connector between their hit targets", async () => {
  const { result } = await renderHook(() =>
    useReferenceLinePress(engine, padding, [line], font, fmt, true, 0),
  );
  expect(result.current.hitTest(25, 142)).toBe(true);
  expect(result.current.hitTest(370, 142)).toBe(true);
  expect(result.current.hitTest(200, 142)).toBe(false);
  expect(result.current.hitTest(370, 170)).toBe(false);
});

it("tracks the live drag value without rerendering React", async () => {
  const sv = withSharedValueAccessors({ values: { value: [50] } }).values as unknown as SharedValue<number[]>;
  const { result } = await renderHook(() =>
    useReferenceLinePress(
      engine,
      padding,
      [line],
      font,
      fmt,
      true,
      0,
      undefined,
      sv,
    ),
  );
  expect(result.current.hitTest(370, 142)).toBe(true);
  sv.set([75]);
  expect(result.current.hitTest(370, 142)).toBe(false);
  expect(result.current.hitTest(370, 77)).toBe(true);
});

it("does not leave invisible tap targets after grouping or custom replacement", async () => {
  const hidden = withSharedValueAccessors({ values: { value: [true] } }).values as unknown as SharedValue<boolean[]>;
  const { result, rerender } = await renderHook(
    ({ custom, offAxis }: { custom: boolean; offAxis: boolean }) =>
      useReferenceLinePress(
        engine,
        padding,
        [line],
        font,
        fmt,
        true,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        hidden,
        [custom],
        [offAxis],
      ),
    { initialProps: { custom: false, offAxis: false } },
  );
  expect(result.current.hitTest(370, 142)).toBe(false);
  hidden.set([false]);
  expect(result.current.hitTest(370, 142)).toBe(true);
  await rerender({ custom: true, offAxis: false });
  expect(result.current.hitTest(25, 142)).toBe(false);
  expect(result.current.hitTest(370, 142)).toBe(false);
  await rerender({ custom: false, offAxis: true });
  expect(result.current.hitTest(370, 142)).toBe(true);
});
