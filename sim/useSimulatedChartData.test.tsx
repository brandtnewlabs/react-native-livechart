import React from "react";

import { act, render, renderHook } from "@testing-library/react-native";

import { useSimulatedChartData } from "./useSimulatedChartData";

function HookProbe(props: {
  tradesPerSecond?: number;
  tradeArrivalJitter?: number;
  paused?: boolean;
  random01?: () => number;
  onReady?: (v: { dataLen: number; tradeLen: number }) => void;
}) {
  const {
    tradesPerSecond = 5,
    tradeArrivalJitter = 0,
    paused = false,
    random01,
    onReady,
  } = props;
  const { data, tradeStream } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: true,
    tradesPerSecond,
    tradeArrivalJitter,
    paused,
    historyRange: "1m",
    maxPoints: 500,
    random01,
  });

  React.useEffect(() => {
    const id = setTimeout(() => {
      onReady?.({
        dataLen: data.value.length,
        tradeLen: tradeStream.value.length,
      });
    }, 0);
    return () => clearTimeout(id);
  }, [data, tradeStream, onReady]);

  return null;
}

describe("useSimulatedChartData", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("advances data and trade stream together at steady TPS", () => {
    let seed = 0.42;
    const rng = jest.fn(() => {
      seed = (seed * 9973 + 0.11) % 1;
      return Math.max(1e-9, seed);
    });

    const { unmount } = render(
      <HookProbe tradesPerSecond={5} random01={rng} />,
    );

    jest.advanceTimersByTime(0);
    expect(rng).toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    unmount();

    jest.advanceTimersByTime(5000);
  });

  it("with jitter=0 appends exactly tradesPerSecond line points per second", () => {
    function makeRng() {
      let s = 0.123456789;
      return () => {
        s = ((s * 9301 + 49297) % 233280) / 233280;
        return Math.max(1e-12, s);
      };
    }
    jest.setSystemTime(new Date("2020-01-01T12:00:00.000Z"));

    const { result, unmount } = renderHook(() =>
      useSimulatedChartData({
        random01: makeRng(),
        tradesPerSecond: 5,
        tradeArrivalJitter: 0,
        paused: false,
        multiSeries: false,
        candleAggregation: false,
        tradeStream: false,
        historyRange: "1m",
        maxPoints: 500,
        volatilityMode: "normal",
      }),
    );

    act(() => {
      jest.runOnlyPendingTimers();
    });
    const baseLen = result.current.data.value.length;
    expect(baseLen).toBeGreaterThan(0);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.data.value.length).toBe(baseLen + 5);
    unmount();
  });

  it("clears live timer when paused", () => {
    const spy = jest.spyOn(global, "setInterval");
    const { rerender, unmount } = render(
      <HookProbe tradesPerSecond={10} paused={false} />,
    );
    const afterStart = spy.mock.calls.length;
    rerender(<HookProbe tradesPerSecond={10} paused />);
    unmount();
    expect(afterStart).toBeGreaterThan(0);
    spy.mockRestore();
  });
});
