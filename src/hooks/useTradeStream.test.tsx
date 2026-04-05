import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import { DEFAULT_PADDING } from "../draw/line";
import type { TradeEvent } from "../types";
import { useLiveChartEngine } from "../useLiveChartEngine";
import { useTradeStream } from "./useTradeStream";

describe("useTradeStream", () => {
  it("returns empty markers when inactive", () => {
    const { result } = renderHook(() => {
      const data = useSharedValue([{ time: 1_700_000_000, value: 50 }]);
      const value = useSharedValue(50);
      const engine = useLiveChartEngine({
        data,
        value,
        timeWindow: 100,
        smoothing: 0.08,
      });
      const trades = useSharedValue<TradeEvent[]>([
        { time: 1_700_000_050, price: 50, size: 1, side: "buy" },
      ]);
      return useTradeStream(engine, trades, DEFAULT_PADDING, false);
    });

    expect(result.current.value).toEqual([]);
  });

  it("returns shared value when active", () => {
    const { result } = renderHook(() => {
      const data = useSharedValue([{ time: 1_700_000_000, value: 50 }]);
      const value = useSharedValue(50);
      const engine = useLiveChartEngine({
        data,
        value,
        timeWindow: 100,
        smoothing: 0.08,
      });
      const trades = useSharedValue<TradeEvent[]>([
        { time: 1_700_000_050, price: 50, size: 2, side: "sell" },
      ]);
      return useTradeStream(engine, trades, DEFAULT_PADDING, true);
    });

    // The shared value is initialised; markers are populated by frame callback
    expect(result.current.value).toBeDefined();
    expect(Array.isArray(result.current.value)).toBe(true);
  });
});
