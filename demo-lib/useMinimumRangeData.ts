import { useEffect, useState } from "react";
import type {
  CandlePoint,
  LiveChartPoint,
  SeriesConfig,
} from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

export const RANGE_SCENARIOS = {
  price: {
    label: "Near-flat",
    base: 87000,
    amplitude: 0.15,
    nonNegative: false,
    maxValue: undefined,
  },
  wide: {
    label: "Wide",
    base: 87000,
    amplitude: 4,
    nonNegative: false,
    maxValue: undefined,
  },
  zero: {
    label: "Zero",
    base: 0,
    amplitude: 0,
    nonNegative: true,
    maxValue: undefined,
  },
  ceiling: {
    label: "Ceiling",
    base: 1,
    amplitude: 0,
    nonNegative: false,
    maxValue: 1,
  },
  both: {
    label: "Both",
    base: 0.5,
    amplitude: 0,
    nonNegative: true,
    maxValue: 1,
  },
} as const;
export type RangeScenario = keyof typeof RANGE_SCENARIOS;

/** Stable history: changing minRange never replaces data, including in static mode. */
export function useMinimumRangeData(scenario: RangeScenario) {
  const [time] = useState(() => Math.floor(Date.now() / 1000 / 3) * 3);
  const data = useSharedValue<LiveChartPoint[]>([]);
  const value = useSharedValue(0);
  const candles = useSharedValue<CandlePoint[]>([]);
  const liveCandle = useSharedValue<CandlePoint | null>(null);
  const series = useSharedValue<SeriesConfig[]>([]);

  useEffect(() => {
    const { base, amplitude } = RANGE_SCENARIOS[scenario];
    const points = Array.from({ length: 61 }, (_, i) => ({
      time: time - 180 + i * 3,
      value: base + Math.sin((i * Math.PI) / 6) * amplitude,
    }));
    const history = points.slice(0, -1).map((point, i) => {
      const open = i ? points[i - 1].value : point.value;
      return {
        time: point.time,
        open,
        high: Math.max(open, point.value) + amplitude * 0.2,
        low: Math.min(open, point.value) - amplitude * 0.2,
        close: point.value,
      };
    });
    const last = points[points.length - 1];
    const second = points.map((point) => ({
      ...point,
      value: point.value + amplitude * 0.1,
    }));
    data.set(points);
    value.set(last.value);
    candles.set(history);
    liveCandle.set({
      time,
      open: last.value,
      high: last.value,
      low: last.value,
      close: last.value,
    });
    series.set([
      {
        id: "a",
        label: "A",
        color: "#3127f6",
        data: points,
        value: last.value,
      },
      {
        id: "b",
        label: "B",
        color: "#16a34a",
        data: second,
        value: second[second.length - 1].value,
      },
    ]);
  }, [scenario, time, data, value, candles, liveCandle, series]);

  return { time, data, value, candles, liveCandle, series };
}
