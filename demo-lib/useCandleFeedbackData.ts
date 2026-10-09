import { useEffect, useState } from "react";
import type { CandlePoint, LiveChartPoint } from "react-native-livechart";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";

export const FEEDBACK_CANDLE_WIDTH = 30;
export const FEEDBACK_WINDOW = 360;

function candleAt(time: number, i: number): CandlePoint {
  const open = 100 + Math.sin(i * 0.7) * 3;
  const close = open + Math.cos(i * 1.3) * 1.5;
  return {
    time,
    open,
    high: Math.max(open, close) + 0.8,
    low: Math.min(open, close) - 0.8,
    close,
  };
}

/** Fixed clock + a ticking forming candle make a stationary hold repeatable. */
export function useCandleFeedbackData(withGap: boolean, paused: boolean) {
  const [time] = useState(() => Math.floor(Date.now() / 1000 / 30) * 30 + 25);
  const liveStart = time - 25;
  const data = useSharedValue<LiveChartPoint[]>([]);
  const value = useSharedValue(100);
  const candles = useSharedValue<CandlePoint[]>([]);
  const liveCandle = useSharedValue<CandlePoint | null>(null);
  const updates = useSharedValue(0);
  const stopped = useDerivedValue(() => paused);
  const gap = {
    from: liveStart - 7 * FEEDBACK_CANDLE_WIDTH,
    to: liveStart - 5 * FEEDBACK_CANDLE_WIDTH,
    kind: "unavailable" as const,
    label: "No candles",
  };

  useEffect(() => {
    const history = Array.from({ length: 12 }, (_, i) =>
      candleAt(liveStart - (12 - i) * FEEDBACK_CANDLE_WIDTH, i),
    ).filter((_, i) => !withGap || (i !== 5 && i !== 6));
    candles.set(history);
    liveCandle.set({ time: liveStart, open: 100, high: 102, low: 98, close: 100 });
    value.set(100);
    data.set([
      ...history.map((c) => ({ time: c.time + 15, value: c.close })),
      { time, value: 100 },
    ]);
  }, [withGap, liveStart, time, candles, liveCandle, value, data]);

  useFrameCallback(({ timeSinceFirstFrame }) => {
    "worklet";
    if (stopped.get() || liveCandle.get() === null) return;
    const close = 100 + Math.sin(timeSinceFirstFrame / 800) * 1.8;
    liveCandle.set({
      time: liveStart,
      open: 100,
      high: 102,
      low: 98,
      close,
    });
    value.set(close);
    data.modify((points) => {
      "worklet";
      const last = points[points.length - 1];
      if (last) last.value = close;
      return points;
    });
    updates.set(updates.get() + 1);
  });

  return { time, data, value, candles, liveCandle, updates, gap };
}
