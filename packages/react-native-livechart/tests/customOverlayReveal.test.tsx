import { render } from "@testing-library/react-native";
import React, { useEffect } from "react";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import type { TestInstance } from "test-renderer";

import { LiveChart } from "../src/components/LiveChart";
import { LiveChartSeries } from "../src/components/LiveChartSeries";
import type { LiveChartPoint, SeriesConfig } from "../src/types";
import { withSharedValueAccessors } from "./support/sharedValueMock";

type AnimatedStyle = { opacity?: number };
const mockStyleUpdaters = new Map<AnimatedStyle, () => AnimatedStyle>();
let mockRevealOpacity = 0;

// Jest has no UI runtime: sample the real style worklets against a controlled
// reveal signal instead of advancing timers to imitate native animation.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return {
    ...actual,
    __esModule: true,
    default: { ...actual.default, View: jest.requireActual("react-native").View },
    useAnimatedStyle: (updater: () => AnimatedStyle) => {
      const style = updater();
      mockStyleUpdaters.set(style, updater);
      return style;
    },
  };
});

jest.mock("../src/hooks/useChartReveal", () => {
  const actual = jest.requireActual<typeof import("../src/hooks/useChartReveal")>("../src/hooks/useChartReveal");
  return {
    ...actual,
    useChartReveal: (...args: Parameters<typeof actual.useChartReveal>) => ({
      ...actual.useChartReveal(...args),
      dotOpacity: {
        get value() { return mockRevealOpacity; },
        get: () => mockRevealOpacity,
      },
    }),
  };
});

function shared<T>(value: T): SharedValue<T> {
  return withSharedValueAccessors({ source: { value } }).source as unknown as SharedValue<T>;
}

function revealStyleAbove(overlay: TestInstance) {
  for (let node = overlay.parent; node; node = node.parent) {
    const styles: unknown[] = Array.isArray(node.props.style)
      ? node.props.style
      : [node.props.style];
    for (const style of styles) {
      const updater = mockStyleUpdaters.get(style as AnimatedStyle);
      if (updater) return { updater, host: node };
    }
  }
  throw new Error("Custom overlay has no animated visibility ancestor");
}

beforeEach(() => {
  mockRevealOpacity = 0;
  mockStyleUpdaters.clear();
});

describe.each(["LiveChart", "LiveChartSeries"])("%s custom overlay reveal", (chartName) => {
  it("follows a controlled reveal signal and keeps its consumer mounted across loading and empty states", async () => {
    const points: LiveChartPoint[] = [{ time: 1_700_000_000, value: 20 }];
    const data = shared(points);
    const value = shared(20);
    const series = shared<SeriesConfig[]>([{ id: "a", data: points, value: 20 }]);
    const onMount = jest.fn();
    const onUnmount = jest.fn();

    function Overlay() {
      useEffect(() => {
        onMount();
        return onUnmount;
      }, []);
      return <View testID="custom-overlay" />;
    }

    const renderOverlay = () => <Overlay />;
    function Chart({ loading }: { loading: boolean }) {
      if (chartName === "LiveChart") {
        return <LiveChart data={data} value={value} loading={loading} renderOverlay={renderOverlay} />;
      }
      return <LiveChartSeries series={series} loading={loading} renderOverlay={renderOverlay} />;
    }

    const screen = await render(<Chart loading />);
    const overlay = screen.getByTestId("custom-overlay", { includeHiddenElements: true });
    const { updater, host } = revealStyleAbove(overlay);
    expect(updater().opacity).toBe(0);
    expect(host.props.pointerEvents).toBe("box-none");

    // Empty data also hides the overlay when the explicit loading prop is off.
    data.set([]);
    series.set([{ id: "a", data: [], value: 20 }]);
    await screen.rerender(<Chart loading={false} />);
    expect(revealStyleAbove(screen.getByTestId("custom-overlay", { includeHiddenElements: true })).updater().opacity).toBe(0);

    data.set(points);
    series.set([{ id: "a", data: points, value: 20 }]);
    await screen.rerender(<Chart loading={false} />);
    const revealedStyle = revealStyleAbove(screen.getByTestId("custom-overlay", { includeHiddenElements: true })).updater;
    expect(revealedStyle().opacity).toBe(0);

    // The same mounted worklet follows partial/full reveal without React work.
    mockRevealOpacity = 0.35;
    expect(revealedStyle().opacity).toBe(0.35);
    mockRevealOpacity = 1;
    expect(revealedStyle().opacity).toBe(1);
    mockRevealOpacity = 0;
    expect(revealedStyle().opacity).toBe(0);
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();

    await screen.unmount();
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });
});
