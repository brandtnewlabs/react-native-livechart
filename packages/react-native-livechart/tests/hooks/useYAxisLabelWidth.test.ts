import { renderHook } from "@testing-library/react-native";
import type { SkFont } from "react-native-skia";
import { useYAxisLabelWidth } from "../../src/hooks/useYAxisLabelWidth";
import type { YAxisEntry } from "../../src/draw/grid";
import { withSharedValueAccessors } from "../support/sharedValueMock";
import type { SharedValue } from "react-native-reanimated";
let mockPrepare: () => number | undefined;
let mockReact: (width: number | undefined, previous: number | null | undefined) => void;
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated"),
  useAnimatedReaction: (prepare: typeof mockPrepare, react: typeof mockReact) => { mockPrepare = prepare; mockReact = react; },
}));
jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets"),
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));
const font = { measureText: (text: string) => ({ width: text.length * 6.6 }) } as unknown as SkFont;
it("reports initial and changed tick widths, with no repeated RN callbacks for price or alpha changes", async () => {
  const values = withSharedValueAccessors({ entries: { value: [{ label: "€9K", y: 20, alpha: 1 }] } });
  const onWidth = jest.fn();
  const { rerender } = await renderHook(({ enabled }: { enabled: boolean }) => useYAxisLabelWidth(values.entries as unknown as SharedValue<YAxisEntry[]>, font, enabled, onWidth), { initialProps: { enabled: true } });
  let previous: number | null | undefined = null;
  const tick = () => { const width = mockPrepare(); mockReact(width, previous); previous = width; };
  tick();
  expect(onWidth).toHaveBeenLastCalledWith(20);
  for (let i = 0; i < 60; i++) { values.entries.value = [{ label: "€8K", y: i, alpha: i / 60 }]; tick(); }
  expect(onWidth).toHaveBeenCalledTimes(1);
  values.entries.value = [{ label: "€11K", y: 20, alpha: 0.5 }]; tick();
  expect(onWidth).toHaveBeenLastCalledWith(27);
  expect(onWidth).toHaveBeenCalledTimes(2);
  await rerender({ enabled: false }); tick();
  expect(onWidth).toHaveBeenLastCalledWith(undefined);
});
