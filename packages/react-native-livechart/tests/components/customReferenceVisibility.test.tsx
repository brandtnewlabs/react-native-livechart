import { render } from "@testing-library/react-native";
import { View } from "react-native";
import { CustomReferenceLineOverlay } from "../../src/components/CustomReferenceLineOverlay";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { withSharedValueAccessors } from "../support/sharedValueMock";

const mockStyles: (() => { opacity: number })[] = [];
const mockProps: (() => { pointerEvents: string; accessibilityElementsHidden: boolean; importantForAccessibility: string })[] = [];
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated"),
  __esModule: true,
  useDerivedValue: (updater: () => unknown) => ({ get: updater }),
  useAnimatedStyle: (updater: () => { opacity: number }) => {
    mockStyles.push(updater);
    return updater();
  },
  useAnimatedProps: (updater: () => object) => {
    mockProps.push(updater as typeof mockProps[number]);
    return updater();
  },
}));

beforeEach(() => { mockStyles.length = 0; mockProps.length = 0; });

it.each([false, true])("hides custom tags and descendants across live range changes (offAxisOnly=%s)", async (offAxisOnly) => {
  const eng = withSharedValueAccessors({
    canvasWidth: { value: 400 }, canvasHeight: { value: 300 },
    displayMin: { value: 0 }, displayMax: { value: 100 },
  }) as unknown as ChartEngineLayout;
  await render(<CustomReferenceLineOverlay
    lines={[{ value: 150, badge: true, offAxis: "hide" }]}
    custom={[true]} engine={eng} padding={DEFAULT_PADDING}
    formatValue={String} offAxisOnly={offAxisOnly}
    renderReferenceLine={() => <View />}
  />);
  const expectVisibility = (visible: boolean) => {
    expect(mockStyles.at(-1)!().opacity).toBe(visible ? 1 : 0);
    expect(mockProps.at(-1)!()).toMatchObject({
      pointerEvents: visible ? "box-none" : "none",
      accessibilityElementsHidden: !visible,
      importantForAccessibility: visible ? "auto" : "no-hide-descendants",
    });
  };
  expectVisibility(false); // above
  eng.displayMax.set(200);
  expectVisibility(!offAxisOnly); // in range, no React rerender
  eng.displayMin.set(160);
  expectVisibility(false); // below
  eng.displayMin.set(100);
  expectVisibility(!offAxisOnly); // returns in range
});

it("preserves default pinning for custom tags without a badge", async () => {
  const eng = withSharedValueAccessors({
    canvasWidth: { value: 400 }, canvasHeight: { value: 300 },
    displayMin: { value: 0 }, displayMax: { value: 100 },
  }) as unknown as ChartEngineLayout;
  await render(<CustomReferenceLineOverlay
    lines={[{ value: 150 }]} custom={[true]} engine={eng}
    padding={DEFAULT_PADDING} formatValue={String}
    renderReferenceLine={() => <View />}
  />);
  expect(mockStyles.at(-1)!().opacity).toBe(1);
});
