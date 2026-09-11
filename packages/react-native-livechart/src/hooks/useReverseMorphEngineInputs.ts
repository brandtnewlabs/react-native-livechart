import {
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import {
  hasCandleChartData,
  hasLineChartData,
  hasMultiSeriesChartData,
} from "../core/chartDataPresence";
import type { CandlePoint, LiveChartPoint, SeriesConfig } from "../types";

const STASH_MORPH_EPS = 0.01;

/**
 * While `morphT` animates down after data clears, keep feeding the engine the
 * last stashed line/candle snapshot.
 */
export function useSingleChartReverseMorphInputs({
  isCandle,
  data,
  candles,
  liveCandle,
  hasData,
  morphT,
}: {
  isCandle: boolean;
  data: SharedValue<LiveChartPoint[]>;
  candles: SharedValue<CandlePoint[]> | undefined;
  liveCandle: SharedValue<CandlePoint | null> | undefined;
  hasData: SharedValue<boolean>;
  morphT: SharedValue<number>;
}): {
  lineEngineData: SharedValue<LiveChartPoint[]>;
  candlesEngine: SharedValue<CandlePoint[]>;
  liveEngine: SharedValue<CandlePoint | null>;
} {
  const lineStash = useSharedValue<LiveChartPoint[]>([]);
  const candleStash = useSharedValue<CandlePoint[]>([]);
  const lineEngineData = useSharedValue<LiveChartPoint[]>([]);
  const candlesEngine = useSharedValue<CandlePoint[]>([]);
  const liveEngine = useSharedValue<CandlePoint | null>(null);

  useAnimatedReaction(
    () => ({
      candle: isCandle,
      has: hasData.get(),
      m: morphT.get(),
      d: data.get(),
      c: candles?.get(),
      lc: liveCandle?.get() ?? null,
    }),
    (curr) => {
      "worklet";
      if (!curr.candle) {
        if (curr.has && hasLineChartData(curr.d)) {
          lineStash.set(curr.d.slice());
          lineEngineData.set(curr.d);
        } else if (
          !curr.has &&
          curr.m > STASH_MORPH_EPS &&
          hasLineChartData(lineStash.get())
        ) {
          lineEngineData.set(lineStash.get());
        } else {
          lineEngineData.set(curr.d);
        }
        return;
      }

      const cArr = curr.c;
      if (curr.has && hasCandleChartData(cArr) && cArr) {
        candleStash.set(cArr.slice());
        candlesEngine.set(cArr);
        liveEngine.set(curr.lc);
      } else if (
        !curr.has &&
        curr.m > STASH_MORPH_EPS &&
        hasCandleChartData(candleStash.get())
      ) {
        candlesEngine.set(candleStash.get());
        liveEngine.set(null);
      } else {
        candlesEngine.set(cArr ?? []);
        liveEngine.set(curr.lc);
      }
    },
    [isCandle, data, candles, liveCandle, hasData, morphT],
  );

  return { lineEngineData, candlesEngine, liveEngine };
}

function snapshotSeriesWorklet(s: SeriesConfig[]): SeriesConfig[] {
  "worklet";
  const out: SeriesConfig[] = [];
  for (let i = 0; i < s.length; i++) {
    const x = s[i];
    out.push({ ...x, data: x.data.slice() });
  }
  return out;
}

export function useMultiSeriesReverseMorphInputs({
  series,
  hasData,
  morphT,
}: {
  series: SharedValue<SeriesConfig[]>;
  hasData: SharedValue<boolean>;
  morphT: SharedValue<number>;
}): SharedValue<SeriesConfig[]> {
  const seriesStash = useSharedValue<SeriesConfig[]>([]);
  const effectiveSeries = useSharedValue<SeriesConfig[]>([]);

  useAnimatedReaction(
    () => ({
      has: hasData.get(),
      m: morphT.get(),
      live: series.get(),
    }),
    (curr) => {
      "worklet";
      const live = curr.live;
      const anyReady = hasMultiSeriesChartData(live);

      if (curr.has && anyReady) {
        seriesStash.set(snapshotSeriesWorklet(live));
        effectiveSeries.set(live);
      } else {
        const stash = seriesStash.get();
        const stashReady = hasMultiSeriesChartData(stash);

        if (!curr.has && curr.m > STASH_MORPH_EPS && stashReady) {
          effectiveSeries.set(seriesStash.get());
        } else {
          effectiveSeries.set(live);
        }
      }
    },
    [series, hasData, morphT],
  );

  return effectiveSeries;
}
