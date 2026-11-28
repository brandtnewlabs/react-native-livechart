import { act, fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import MultiSeriesScreen from "../../app/demo/multi-series";

// Exercise the real hold callbacks at their animation endpoints.
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated"),
  withTiming: (target: number) => target,
}));

jest.mock("../../demo-lib/DemoScreen", () => ({
  DemoScreen: ({ chart, children }: { chart: ReactNode; children: ReactNode }) => <>{chart}{children}</>,
}));
jest.mock("../../demo-lib/DeferredControls", () => ({
  DeferredControls: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("../../sim/useSimulatedChartData", () => ({
  useSimulatedChartData: () => ({ series: { modify: jest.fn() } }),
}));
jest.mock("react-native-livechart", () => {
  const { View } = require("react-native");
  return { LiveChartSeries: (props: object) => <View {...props} testID="chart" /> };
});

it("lets each axis opt into a hold independently and restores its range on release", async () => {
  const screen = await render(<MultiSeriesScreen />);
  const props = () => screen.getByTestId("chart").props;
  const x = screen.getByText("X · Time");
  const y = screen.getByText("Y · Values");
  const fit = { min: 40, max: 60 };

  expect(props().timeHorizon).toBeUndefined();
  expect(props().rangeAnimation).toBeUndefined();
  expect(props().onGestureStart).toBeUndefined();

  await fireEvent.press(x);
  expect(props().rangeAnimation).toBeUndefined();
  await act(() => props().onGestureStart());
  expect(props().timeHorizon.at).toBeGreaterThan(Date.now() / 1000);
  expect(props().timeHorizon.progress.get()).toBe(1);
  await act(() => props().onGestureEnd());
  expect(props().timeHorizon.progress.get()).toBe(0);

  await fireEvent.press(y);
  expect(props().scrub.clampToPlot).toBe(true);
  await act(() => props().onGestureStart());
  expect(props().timeHorizon.progress.get()).toBe(1);
  expect(props().rangeAnimation.transform(fit)).toEqual({ min: 30, max: 70 });
  await act(() => props().onGestureEnd());
  expect(props().rangeAnimation.transform(fit)).toEqual(fit);
  expect(props().timeHorizon.progress.get()).toBe(0);

  await fireEvent.press(x);
  expect(props().timeHorizon).toBeUndefined();
  await act(() => props().onGestureStart());
  expect(props().rangeAnimation.transform(fit)).toEqual({ min: 30, max: 70 });
  await act(() => props().onGestureEnd());
  expect(props().rangeAnimation.transform(fit)).toEqual(fit);

  // Turning off the last axis during a hold must also clear its progress.
  await act(() => props().onGestureStart());
  await fireEvent.press(y);
  expect(props().rangeAnimation).toBeUndefined();
  expect(props().onGestureStart).toBeUndefined();
  expect(props().scrub.seriesTooltip).toBeTruthy();
  await fireEvent.press(y);
  expect(props().rangeAnimation.transform(fit)).toEqual(fit);
});
