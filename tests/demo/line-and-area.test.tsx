import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import LineScreen from "../../app/demo/line-and-area";

jest.mock("../../demo-lib/DemoScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    DemoScreen: ({ chart, children }: { chart: ReactNode; children: ReactNode }) =>
      React.createElement(View, null, chart, children),
  };
});

jest.mock("../../sim/useSimulatedChartData", () => ({
  useSimulatedChartData: () => ({ data: { value: [] }, value: { value: 100 } }),
}));

jest.mock("react-native-livechart", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LiveChart: (props: Record<string, unknown>) =>
      React.createElement(View, { ...props, testID: "chart" }),
  };
});

it("resets a custom fill when Animated is selected and enables scrubbing", async () => {
  const screen = await render(<LineScreen />);
  const customChips = screen.getAllByText("Custom");
  expect(customChips).toHaveLength(2);

  await fireEvent.press(customChips[1]);
  expect(screen.getByTestId("chart").props.gradient).toMatchObject({
    colors: [
      "rgba(107,107,255,0.45)",
      "rgba(255,107,107,0.12)",
      "transparent",
    ],
    positions: [0, 0.6, 1],
  });

  await fireEvent.press(screen.getByText("Animated"));
  expect(screen.getAllByText("Custom")).toHaveLength(1);
  expect(screen.getByTestId("chart").props.scrub).toBe(true);
  expect(screen.getByTestId("chart").props.gradient.colors).toHaveProperty(
    "value",
  );
});
