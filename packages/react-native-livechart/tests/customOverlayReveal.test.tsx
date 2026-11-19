import { render } from "@testing-library/react-native";
import React, { useEffect } from "react";
import { View } from "react-native";
import { makeMutable, type SharedValue } from "react-native-reanimated";

import { LiveChart } from "../src/components/LiveChart";
import { LiveChartSeries } from "../src/components/LiveChartSeries";
import * as reveal from "../src/hooks/useChartReveal";
import type { LiveChartPoint, LiveChartProps, SeriesConfig } from "../src/types";
import { withSharedValueAccessors } from "./support/sharedValueMock";

function shared<T>(value: T): SharedValue<T> {
  return withSharedValueAccessors({ source: { value } }).source as unknown as SharedValue<T>;
}

const points: LiveChartPoint[] = [{ time: 1_700_000_000, value: 20 }];
const useRealChartReveal = reveal.useChartReveal;

describe.each(["LiveChart", "LiveChartSeries"])("%s custom overlay reveal", (chartName) => {
  function setupChart() {
    const data = shared(points);
    const value = shared(20);
    const series = shared<SeriesConfig[]>([{ id: "a", data: points, value: 20 }]);

    function chart(props: Pick<LiveChartProps, "loading" | "renderOverlay"> = {}) {
      if (chartName === "LiveChart") {
        return <LiveChart data={data} value={value} {...props} />;
      }
      return <LiveChartSeries series={series} {...props} />;
    }
    return { chart, data, series };
  }

  afterEach(() => jest.restoreAllMocks());

  it("uses the marker's partial reveal opacity on the overlay host", async () => {
    // Jest does not advance UI-thread animations. Give just the marker channel
    // a distinct intermediate value, then inspect the real Animated.View.
    const partial = makeMutable(0.35);
    jest.spyOn(reveal, "useChartReveal").mockImplementation(function usePartialReveal(...args) {
      return { ...useRealChartReveal(...args), dotOpacity: partial };
    });

    const { chart } = setupChart();
    const screen = await render(chart({ renderOverlay: () => <View testID="custom-overlay" /> }));
    const host = screen.getByTestId("custom-overlay").parent;
    expect(host).toHaveStyle({ opacity: 0.35 });
    expect(host).toHaveProp("pointerEvents", "box-none");
  });

  it.each([null, undefined])("adds no host view when the callback returns %s", async (empty) => {
    const { chart } = setupChart();
    const screen = await render(chart());
    const hostCount = screen.container.queryAll(() => true).length;
    await screen.rerender(chart({ renderOverlay: () => empty }));
    expect(screen.container.queryAll(() => true)).toHaveLength(hostCount);
  });

  it("keeps the consumer mounted across loading, empty data, and recovery", async () => {
    const { chart, data, series } = setupChart();
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
    const screen = await render(chart({ loading: true, renderOverlay }));
    const host = screen.getByTestId("custom-overlay", { includeHiddenElements: true }).parent;
    expect(host).toHaveStyle({ opacity: 0 });

    data.set([]);
    series.set([{ id: "a", data: [], value: 20 }]);
    await screen.rerender(chart({ loading: false, renderOverlay }));
    data.set(points);
    series.set([{ id: "a", data: points, value: 20 }]);
    await screen.rerender(chart({ loading: false, renderOverlay }));

    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();
    await screen.unmount();
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });
});
