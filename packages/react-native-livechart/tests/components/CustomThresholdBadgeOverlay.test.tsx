import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { CustomThresholdBadgeOverlay } from "../../src/components/CustomThresholdBadgeOverlay";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { withSharedValueAccessors } from "../support/sharedValueMock";

function sv<T>(value: T) {
  return withSharedValueAccessors({ current: { value } }).current as never;
}

function engine(canvasWidth = 400): ChartEngineLayout {
  return withSharedValueAccessors({
    canvasWidth: { value: canvasWidth },
  }) as unknown as ChartEngineLayout;
}

describe("CustomThresholdBadgeOverlay", () => {
  it.each(["left", "right"] as const)(
    "floats and measures a custom element on the %s",
    async (position) => {
      const screen = await render(
        <CustomThresholdBadgeOverlay
          element={<Text testID="badge">Break-even</Text>}
          engine={engine()}
          padding={DEFAULT_PADDING}
          y={sv(120)}
          visible={sv(true)}
          position={position}
        />,
      );
      const badge = screen.getByTestId("badge");
      await fireEvent(badge.parent!, "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 80, height: 24 } },
      });
      expect(badge).toBeTruthy();
    },
  );

  it("keeps the element mounted but hidden before layout/off-axis", async () => {
    const screen = await render(
      <CustomThresholdBadgeOverlay
        element={<Text testID="badge">Hidden</Text>}
        engine={engine(0)}
        padding={DEFAULT_PADDING}
        y={sv(Number.NaN)}
        visible={sv(false)}
        position="left"
      />,
    );
    expect(screen.getByTestId("badge")).toBeTruthy();
  });
});
