import {
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
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
      has: hasData.value,
      m: morphT.value,
      d: data.value,
      cLen: candles?.value.length ?? 0,
      c: candles?.value,
      lc: liveCandle?.value ?? null,
    }),
    (curr) => {
      "worklet";
      if (!curr.candle) {
        if (curr.has && curr.d.length >= 2) {
          lineStash.value = curr.d.slice();
          lineEngineData.value = curr.d;
        } else if (
          !curr.has &&
          curr.m > STASH_MORPH_EPS &&
          lineStash.value.length >= 2
        ) {
          lineEngineData.value = lineStash.value;
        } else {
          lineEngineData.value = curr.d;
        }
        return;
      }

      const cArr = curr.c;
      if (curr.has && curr.cLen >= 2 && cArr) {
        candleStash.value = cArr.slice();
        candlesEngine.value = cArr;
        liveEngine.value = curr.lc;
      } else if (
        !curr.has &&
        curr.m > STASH_MORPH_EPS &&
        candleStash.value.length >= 2
      ) {
        candlesEngine.value = candleStash.value;
        liveEngine.value = null;
      } else {
        candlesEngine.value = cArr ?? [];
        liveEngine.value = curr.lc;
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
      has: hasData.value,
      m: morphT.value,
      live: series.value,
    }),
    (curr) => {
      "worklet";
      const live = curr.live;

      let anyReady = false;
      for (let i = 0; i < live.length; i++) {
        if (live[i].data.length >= 2) {
          anyReady = true;
          break;
        }
      }

      if (curr.has && anyReady) {
        seriesStash.value = snapshotSeriesWorklet(live);
        effectiveSeries.value = live;
      } else {
        let stashReady = false;
        const stash = seriesStash.value;
        for (let i = 0; i < stash.length; i++) {
          if (stash[i].data.length >= 2) {
            stashReady = true;
            break;
          }
        }

        if (!curr.has && curr.m > STASH_MORPH_EPS && stashReady) {
          effectiveSeries.value = seriesStash.value;
        } else {
          effectiveSeries.value = live;
        }
      }
    },
    [series, hasData, morphT],
  );

  return effectiveSeries;
}
