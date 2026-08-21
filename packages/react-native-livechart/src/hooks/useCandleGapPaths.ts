import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { ResolvedCandleGapsConfig } from "../core/resolveConfig";
import type { SingleEngineState } from "../core/useLiveChartEngine";
import { buildCandleGapGeometry } from "../draw/candleGap";
import type { ChartPadding } from "../draw/line";
import type { CandleMetrics, CandlePoint } from "../types";
import { usePathBuilder } from "./usePathBuilder";

/** Batched neutral previous-close paths for each semantic candle-gap kind. */
export function useCandleGapPaths(
  engine: SingleEngineState,
  padding: ChartPadding,
  candles: SharedValue<CandlePoint[]>,
  liveCandle: SharedValue<CandlePoint | null>,
  displayCandleWidth: SharedValue<number>,
  config: ResolvedCandleGapsConfig,
  metrics: CandleMetrics,
) {
  const noTradesBuilder = usePathBuilder();
  const unavailableBuilder = usePathBuilder();
  const unknownBuilder = usePathBuilder();

  /* istanbul ignore next -- worklet */
  const geometry = useDerivedValue(() =>
    buildCandleGapGeometry(
      candles.get(),
      liveCandle.get(),
      config.gaps,
      padding,
      engine.canvasWidth.get(),
      engine.canvasHeight.get(),
      engine.timestamp.get() - engine.displayWindow.get(),
      engine.displayWindow.get(),
      engine.displayMin.get(),
      engine.displayMax.get(),
      displayCandleWidth.get(),
      config.styles["no-trades"].bridge !== null,
      config.styles.unavailable.bridge !== null,
      config.styles.unknown.bridge !== null,
      metrics,
    ),
  );

  /* istanbul ignore next -- worklet */
  const noTradesPath = useDerivedValue(() => {
    const b = noTradesBuilder.get();
    const marks = geometry.get().marks;
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];
      if (mark.kind !== "no-trades") continue;
      b.moveTo(mark.x1, mark.y);
      b.lineTo(mark.x2, mark.y);
    }
    return b.detach();
  });

  /* istanbul ignore next -- worklet */
  const unavailablePath = useDerivedValue(() => {
    const b = unavailableBuilder.get();
    const marks = geometry.get().marks;
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];
      if (mark.kind !== "unavailable") continue;
      b.moveTo(mark.x1, mark.y);
      b.lineTo(mark.x2, mark.y);
    }
    return b.detach();
  });

  /* istanbul ignore next -- worklet */
  const unknownPath = useDerivedValue(() => {
    const b = unknownBuilder.get();
    const marks = geometry.get().marks;
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];
      if (mark.kind !== "unknown") continue;
      b.moveTo(mark.x1, mark.y);
      b.lineTo(mark.x2, mark.y);
    }
    return b.detach();
  });

  return {
    noTradesPath,
    unavailablePath,
    unknownPath,
  } as const;
}
