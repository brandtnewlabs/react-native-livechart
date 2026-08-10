import { act, render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { LiveChartTransition } from "../../src/components/LiveChartTransition";

describe("LiveChartTransition", () => {
  it("unmounts the outgoing child after the fade completes", async () => {
    jest.useFakeTimers();
    try {
      const screen = await render(
        <LiveChartTransition active="line" duration={10}>
          <Text key="line">LINE</Text>
          <Text key="candle">CANDLE</Text>
        </LiveChartTransition>,
      );
      await screen.rerender(
        <LiveChartTransition active="candle" duration={10}>
          <Text key="line">LINE</Text>
          <Text key="candle">CANDLE</Text>
        </LiveChartTransition>,
      );
      // Both mounted during the cross-fade.
      expect(screen.getByText("LINE")).toBeTruthy();
      await act(() => {
        jest.advanceTimersByTime(100);
      });
      // Outgoing "line" child is unmounted once the timeout fires.
      expect(screen.queryByText("LINE")).toBeNull();
      expect(screen.getByText("CANDLE")).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps every child mounted from the start when keepMounted is set", async () => {
    const screen = await render(
      <LiveChartTransition active="line" keepMounted>
        <Text key="line">LINE</Text>
        <Text key="candle">CANDLE</Text>
      </LiveChartTransition>,
    );
    // Both are mounted immediately (no reveal-on-switch), even the inactive one.
    expect(screen.getByText("LINE")).toBeTruthy();
    expect(screen.getByText("CANDLE")).toBeTruthy();
  });

  it("renders only the active child initially", async () => {
    const screen = await render(
      <LiveChartTransition active="line">
        <Text key="line">LINE</Text>
        <Text key="candle">CANDLE</Text>
      </LiveChartTransition>,
    );
    expect(screen.getByText("LINE")).toBeTruthy();
    expect(screen.queryByText("CANDLE")).toBeNull();
  });

  it("mounts the incoming child when active changes", async () => {
    const screen = await render(
      <LiveChartTransition active="line" duration={10}>
        <Text key="line">LINE</Text>
        <Text key="candle">CANDLE</Text>
      </LiveChartTransition>,
    );
    await screen.rerender(
      <LiveChartTransition active="candle" duration={10}>
        <Text key="line">LINE</Text>
        <Text key="candle">CANDLE</Text>
      </LiveChartTransition>,
    );
    expect(screen.getByText("CANDLE")).toBeTruthy();
  });

  it("accepts a single child", async () => {
    const screen = await render(
      <LiveChartTransition active="only">
        <Text key="only">ONLY</Text>
      </LiveChartTransition>,
    );
    expect(screen.getByText("ONLY")).toBeTruthy();
  });
});
