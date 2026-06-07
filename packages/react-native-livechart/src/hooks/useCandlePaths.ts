import { Skia, type SkPath } from "@shopify/react-native-skia";
import { useRef } from "react";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { CANDLE_METRICS_DEFAULTS, MS_PER_FRAME_60FPS } from "../constants";
import type { SingleEngineState } from "../core/useLiveChartEngine";
import { buildCandleGeometry } from "../draw/candle";
import type { ChartPadding } from "../draw/line";
import { lerp } from "../math/lerp";
import type { CandleMetrics, CandlePoint } from "../types";

const CANDLE_WIDTH_LERP_SPEED = 0.08;

/**
 * Persistent candle `SkPath`s — two per geometry slot (up/down bodies + up/down wicks).
 * Each derived value ping-pongs between its pair and mutates the picked path in place
 * so we don't allocate a new JSI-backed `SkPath` per frame. See {@link useChartPaths}
 * for the rationale (this was the primary driver of the iOS memory climb under live
 * ticking).
 */
export function useCandlePaths(
  engine: SingleEngineState,
  padding: ChartPadding,
  candles: SharedValue<CandlePoint[]> | undefined,
  liveCandle: SharedValue<CandlePoint | null> | undefined,
  candleWidthSecs: number,
  active: boolean,
  candleMetrics: CandleMetrics = CANDLE_METRICS_DEFAULTS,
) {
  const targetCandleWidth = useDerivedValue(() => candleWidthSecs);
  const displayCandleWidth = useSharedValue(candleWidthSecs);

  const cacheRef = useRef<{
    upBodiesA: SkPath;
    upBodiesB: SkPath;
    downBodiesA: SkPath;
    downBodiesB: SkPath;
    upWicksA: SkPath;
    upWicksB: SkPath;
    downWicksA: SkPath;
    downWicksB: SkPath;
    ubTick: boolean;
    dbTick: boolean;
    uwTick: boolean;
    dwTick: boolean;
  } | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = {
      upBodiesA: Skia.Path.Make(),
      upBodiesB: Skia.Path.Make(),
      downBodiesA: Skia.Path.Make(),
      downBodiesB: Skia.Path.Make(),
      upWicksA: Skia.Path.Make(),
      upWicksB: Skia.Path.Make(),
      downWicksA: Skia.Path.Make(),
      downWicksB: Skia.Path.Make(),
      ubTick: false,
      dbTick: false,
      uwTick: false,
      dwTick: false,
    };
  }

  useFrameCallback((frameInfo) => {
    "worklet";
    if (!active) return;
    const dt = frameInfo.timeSincePreviousFrame ?? MS_PER_FRAME_60FPS;
    displayCandleWidth.set(
      lerp(
        displayCandleWidth.get(),
        targetCandleWidth.get(),
        CANDLE_WIDTH_LERP_SPEED,
        dt,
      ),
    );
  });

  /* istanbul ignore next -- worklet */
  const geometry = useDerivedValue(() => {
    if (!active || !candles) return { bodies: [], wicks: [] };
    return buildCandleGeometry(
      candles.value,
      liveCandle?.value ?? null,
      padding,
      engine.canvasWidth.value,
      engine.canvasHeight.value,
      engine.timestamp.value - engine.displayWindow.value,
      engine.displayWindow.value,
      engine.displayMin.value,
      engine.displayMax.value,
      displayCandleWidth.get(),
      candleMetrics,
    );
  });

  /* istanbul ignore next -- worklet */
  const upBodiesPath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.ubTick = !cache.ubTick;
    const path = cache.ubTick ? cache.upBodiesA : cache.upBodiesB;
    path.reset();
    const { bodies } = geometry.value;
    for (let i = 0; i < bodies.length; i++) {
      if (bodies[i].up) {
        path.addRect(
          Skia.XYWHRect(bodies[i].x, bodies[i].y, bodies[i].w, bodies[i].h),
        );
      }
    }
    return path;
  });

  /* istanbul ignore next -- worklet */
  const downBodiesPath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.dbTick = !cache.dbTick;
    const path = cache.dbTick ? cache.downBodiesA : cache.downBodiesB;
    path.reset();
    const { bodies } = geometry.value;
    for (let i = 0; i < bodies.length; i++) {
      if (!bodies[i].up) {
        path.addRect(
          Skia.XYWHRect(bodies[i].x, bodies[i].y, bodies[i].w, bodies[i].h),
        );
      }
    }
    return path;
  });

  /* istanbul ignore next -- worklet */
  const upWicksPath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.uwTick = !cache.uwTick;
    const path = cache.uwTick ? cache.upWicksA : cache.upWicksB;
    path.reset();
    const { wicks } = geometry.value;
    for (let i = 0; i < wicks.length; i++) {
      if (wicks[i].up) {
        path.moveTo(wicks[i].x, wicks[i].y1);
        path.lineTo(wicks[i].x, wicks[i].y2);
      }
    }
    return path;
  });

  /* istanbul ignore next -- worklet */
  const downWicksPath = useDerivedValue(() => {
    const cache = cacheRef.current!;
    cache.dwTick = !cache.dwTick;
    const path = cache.dwTick ? cache.downWicksA : cache.downWicksB;
    path.reset();
    const { wicks } = geometry.value;
    for (let i = 0; i < wicks.length; i++) {
      if (!wicks[i].up) {
        path.moveTo(wicks[i].x, wicks[i].y1);
        path.lineTo(wicks[i].x, wicks[i].y2);
      }
    }
    return path;
  });

  return { upBodiesPath, downBodiesPath, upWicksPath, downWicksPath } as const;
}
