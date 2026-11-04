import { render } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { CustomReferenceLineOverlay } from "../../src/components/CustomReferenceLineOverlay";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { withSharedValueAccessors } from "../support/sharedValueMock";

type StyleWorklet = (() => unknown) & { __closure?: Record<string, unknown> };
const mockStyles: StyleWorklet[] = [];
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated"),
  __esModule: true,
  useDerivedValue: (updater: () => unknown) => ({
    get: updater,
    get value() { return updater(); },
  }),
  useAnimatedStyle: (updater: StyleWorklet) => {
    mockStyles.push(updater);
    return updater();
  },
}));

/** Match Reanimated's recursive scan of plain objects captured by a mapper. */
function captures(root: unknown, target: unknown): boolean {
  if (root === target) return true;
  if (!root || typeof root !== "object") return false;
  if (Array.isArray(root) || Object.getPrototypeOf(root) === Object.prototype) {
    return Object.values(root).some((value) => captures(value, target));
  }
  return false;
}

it("does not subscribe a pinned tag's native transform to the engine clock or range", async () => {
  const engine = withSharedValueAccessors({
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 1000 },
  }) as unknown as ChartEngineLayout;
  mockStyles.length = 0;
  await render(
    <CustomReferenceLineOverlay
      lines={[{ value: 150, badge: { position: "right" } }]}
      renderReferenceLine={() => <View />}
      custom={[true]}
      engine={engine}
      padding={DEFAULT_PADDING}
      formatValue={String}
      offAxisOnly
    />,
  );

  expect(mockStyles.length).toBeGreaterThan(0);
  const style = mockStyles.at(-1)!;
  const closure = style.__closure;
  // Assert the real Babel-generated closure, not a hand-maintained dependency list.
  expect(closure).toBeDefined();
  expect(captures(closure, engine.canvasWidth)).toBe(true);
  for (const unrelated of [engine.timestamp, engine.displayWindow, engine.displayMin, engine.displayMax]) {
    expect(captures(closure, unrelated)).toBe(false);
  }

  const position = (width: number, y: number, opacity: number) => ({
    opacity,
    transform: [
      { translateX: width - DEFAULT_PADDING.right - 2 },
      { translateY: y },
    ],
  });
  expect(style()).toEqual(position(400, DEFAULT_PADDING.top + 12, 1));
  engine.canvasWidth.set(560);
  expect(style()).toEqual(position(560, DEFAULT_PADDING.top + 12, 1));

  // Range-driven y/edge still reach the style through their derived values.
  engine.displayMax.set(200);
  expect(style()).toMatchObject({ opacity: 0 });
  engine.displayMin.set(160);
  engine.displayMax.set(260);
  expect(style()).toEqual(position(560, 300 - DEFAULT_PADDING.bottom - 12, 1));
});
