import { Skia } from "@shopify/react-native-skia";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { buildCandleGeometry } from "../draw/candle";
import type { ChartPadding } from "../draw/line";
import { lerp } from "../math/lerp";
import type { CandlePoint } from "../types";
import type { SingleEngineState } from "../useLivelineEngine";

const CANDLE_WIDTH_LERP_SPEED = 0.08;

export function useCandlePaths(
  engine: SingleEngineState,
  padding: ChartPadding,
  candles: SharedValue<CandlePoint[]> | undefined,
  liveCandle: SharedValue<CandlePoint | null> | undefined,
  candleWidthSecs: number,
  active: boolean,
) {
  const targetCandleWidth = useDerivedValue(() => candleWidthSecs);
  const displayCandleWidth = useSharedValue(candleWidthSecs);

  useFrameCallback((frameInfo) => {
    "worklet";
    if (!active) return;
    const dt = frameInfo.timeSincePreviousFrame ?? 16.67;
    displayCandleWidth.value = lerp(
      displayCandleWidth.value,
      targetCandleWidth.value,
      CANDLE_WIDTH_LERP_SPEED,
      dt,
    );
  });

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
      displayCandleWidth.value,
    );
  });

  const upBodiesPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
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

  const downBodiesPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
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

  const upWicksPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const { wicks } = geometry.value;
    for (let i = 0; i < wicks.length; i++) {
      if (wicks[i].up) {
        path.moveTo(wicks[i].x, wicks[i].y1);
        path.lineTo(wicks[i].x, wicks[i].y2);
      }
    }
    return path;
  });

  const downWicksPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
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
