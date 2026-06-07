import { Skia } from "@shopify/react-native-skia";
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
import { usePathBuilder } from "./usePathBuilder";

const CANDLE_WIDTH_LERP_SPEED = 0.08;

/**
 * Candle paths (up/down bodies + up/down wicks). Each is built into a reused
 * `Skia.PathBuilder` and finalized with `detach()` each frame — a fresh
 * immutable `SkPath`, so Skia repaints without a per-curve ping-pong and no
 * mutable `SkPath` is retained across frames.
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

  const upBodiesBuilder = usePathBuilder();
  const downBodiesBuilder = usePathBuilder();
  const upWicksBuilder = usePathBuilder();
  const downWicksBuilder = usePathBuilder();

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
    const b = upBodiesBuilder.value;
    const { bodies } = geometry.value;
    for (let i = 0; i < bodies.length; i++) {
      if (bodies[i].up) {
        b.addRect(
          Skia.XYWHRect(bodies[i].x, bodies[i].y, bodies[i].w, bodies[i].h),
        );
      }
    }
    return b.detach();
  });

  /* istanbul ignore next -- worklet */
  const downBodiesPath = useDerivedValue(() => {
    const b = downBodiesBuilder.value;
    const { bodies } = geometry.value;
    for (let i = 0; i < bodies.length; i++) {
      if (!bodies[i].up) {
        b.addRect(
          Skia.XYWHRect(bodies[i].x, bodies[i].y, bodies[i].w, bodies[i].h),
        );
      }
    }
    return b.detach();
  });

  /* istanbul ignore next -- worklet */
  const upWicksPath = useDerivedValue(() => {
    const b = upWicksBuilder.value;
    const { wicks } = geometry.value;
    for (let i = 0; i < wicks.length; i++) {
      if (wicks[i].up) {
        b.moveTo(wicks[i].x, wicks[i].y1);
        b.lineTo(wicks[i].x, wicks[i].y2);
      }
    }
    return b.detach();
  });

  /* istanbul ignore next -- worklet */
  const downWicksPath = useDerivedValue(() => {
    const b = downWicksBuilder.value;
    const { wicks } = geometry.value;
    for (let i = 0; i < wicks.length; i++) {
      if (!wicks[i].up) {
        b.moveTo(wicks[i].x, wicks[i].y1);
        b.lineTo(wicks[i].x, wicks[i].y2);
      }
    }
    return b.detach();
  });

  return { upBodiesPath, downBodiesPath, upWicksPath, downWicksPath } as const;
}
