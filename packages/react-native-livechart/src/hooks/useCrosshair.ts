import { type SkFont } from "@shopify/react-native-skia";
import { Platform } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { SingleEngineState } from "../core/useLiveChartEngine";
import { type ChartPadding } from "../draw/line";
import { interpolateAtTime } from "../math/interpolate";
import { pickCandleAtTime } from "../math/pickCandle";
import type { CandlePoint, LiveChartPalette, ScrubPoint } from "../types";
import {
  computeCandleTooltipLayout,
  computeCrosshairOpacity,
  computeScrubTime,
  deriveCrosshairTooltipSingle,
  type CrosshairState,
} from "./crosshairShared";

export type { CrosshairState, TooltipLayout } from "./crosshairShared";
export type { ScrubPoint };

  export {
    computeCandleTooltipLayout,
    computeCrosshairOpacity,
    computeScrubTime,
    computeTooltipLayout,
    computeTooltipLayoutMulti,
    deriveCrosshairTooltipSingle,
    deriveScrubValueSingle,
    HIDDEN_TOOLTIP
  } from "./crosshairShared";

export interface CrosshairCandleOpts {
  mode: "line" | "candle";
  candles?: SharedValue<CandlePoint[]>;
  liveCandle?: SharedValue<CandlePoint | null>;
  candleWidthSecs: number;
}

/**
 * Single-series crosshair + scrub. Use `useCrosshairSeries` for `LiveChartSeries`.
 */
export function useCrosshair(
  engine: SingleEngineState,
  padding: ChartPadding,
  _palette: LiveChartPalette,
  formatValue: (v: number) => string,
  formatTime: (t: number) => string,
  font: SkFont,
  enabled: boolean,
  onScrub?: (point: ScrubPoint | null) => void,
  candleOpts?: CrosshairCandleOpts,
  /** Press-and-hold delay (ms) before scrubbing activates. 0 = immediate. */
  panGestureDelay = 0,
): CrosshairState {
  const scrubX = useSharedValue(-1);
  const scrubActive = useSharedValue(false);

  const scrubTime = useDerivedValue(() =>
    computeScrubTime(
      scrubActive.get(),
      scrubX.get(),
      padding,
      engine.canvasWidth.get(),
      engine.timestamp.get(),
      engine.displayWindow.get(),
    ),
  );

  const isCandleMode = candleOpts?.mode === "candle";
  const candlesSV = candleOpts?.candles;
  const liveCandleSV = candleOpts?.liveCandle;
  const candleWidthSecs = candleOpts?.candleWidthSecs ?? 60;

  /* istanbul ignore next -- worklet */
  const scrubCandle = useDerivedValue(() => {
    if (
      !isCandleMode ||
      !candlesSV ||
      !scrubActive.get() ||
      scrubTime.get() < 0
    )
      return null;
    return pickCandleAtTime(
      candlesSV.get(),
      liveCandleSV?.get() ?? null,
      scrubTime.get(),
      candleWidthSecs,
    );
  });

  /* istanbul ignore next -- worklet */
  const scrubValue = useDerivedValue(() => {
    if (!scrubActive.get() || scrubTime.get() < 0) return null;
    if (isCandleMode) {
      return scrubCandle.get()?.close ?? null;
    }
    return interpolateAtTime(engine.data.get(), scrubTime.get());
  });

  const crosshairOpacity = useDerivedValue(() =>
    computeCrosshairOpacity(
      scrubActive.get(),
      scrubX.get(),
      engine.canvasWidth.get(),
      padding.right,
    ),
  );

  const tooltipLayout = useDerivedValue(() => {
    if (isCandleMode) {
      return computeCandleTooltipLayout(
        scrubActive.get(),
        scrubX.get(),
        scrubCandle.get(),
        scrubTime.get(),
        padding,
        engine.canvasWidth.get(),
        formatValue,
        formatTime,
        font,
      );
    }
    return deriveCrosshairTooltipSingle(
      scrubActive.get(),
      scrubX.get(),
      scrubTime.get(),
      scrubValue.get(),
      padding,
      engine.canvasWidth.get(),
      formatValue,
      formatTime,
      font,
    );
  });

  /* istanbul ignore next -- invoked only via scheduleOnRN from UI-thread gesture */
  function handleScrub(
    x: number,
    y: number,
    time: number,
    value: number,
    candleJson: string | null,
  ) {
    const candle: CandlePoint | undefined = candleJson
      ? (JSON.parse(candleJson) as CandlePoint)
      : undefined;
    onScrub?.({ time, value, x, y, candle });
  }

  /* istanbul ignore next */
  function handleScrubEnd() {
    onScrub?.(null);
  }

  const hasOnScrub = onScrub != null;

  useAnimatedReaction(
    () => {
      "worklet";
      if (!hasOnScrub) return "__idle__";
      if (!scrubActive.get()) return "__inactive__";
      const time = scrubTime.get();
      const val = scrubValue.get();
      const x = scrubX.get();
      if (val === null || time < 0) return "__pending__";
      const chartW = engine.canvasWidth.get() - padding.left - padding.right;
      if (chartW <= 0) return "__pending__";
      const h = engine.canvasHeight.get();
      const chartH = h - padding.top - padding.bottom;
      const valRange = engine.displayMax.get() - engine.displayMin.get();
      const dotY =
        valRange === 0
          ? padding.top + chartH / 2
          : padding.top + ((engine.displayMax.get() - val) / valRange) * chartH;
      let candleJson: string | null = null;
      if (isCandleMode) {
        const c = scrubCandle.get();
        if (c) candleJson = JSON.stringify(c);
      }
      return JSON.stringify([time, val, x, dotY, candleJson]);
    },
    (curr, prev) => {
      "worklet";
      if (!hasOnScrub) return;
      if (
        curr === "__idle__" ||
        curr === "__inactive__" ||
        curr === "__pending__"
      ) {
        return;
      }
      if (curr === prev) return;
      const row = JSON.parse(curr) as [
        number,
        number,
        number,
        number,
        string | null,
      ];
      scheduleOnRN(handleScrub, row[2], row[3], row[0], row[1], row[4]);
    },
  );

  let gesture = Gesture.Pan()
    .minDistance(Platform.OS === "android" ? 10 : 0)
    .activateAfterLongPress(panGestureDelay)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    // Start scrubbing on ACTIVE (onStart), not on touch-down (onBegin):
    // `activateAfterLongPress` only delays activation, so onBegin still fires
    // immediately — using it would scrub instantly and ignore panGestureDelay,
    // and leave scrubActive stuck for taps that never reach the long-press.
    .onStart(
      /* istanbul ignore next */ (e) => {
        "worklet";
        if (!enabled) return;
        scrubX.set(e.x);
        scrubActive.set(true);
      },
    )
    .onUpdate(
      /* istanbul ignore next */ (e) => {
        "worklet";
        if (!enabled) return;
        scrubX.set(e.x);
      },
    )
    .onFinalize(
      /* istanbul ignore next */ () => {
        "worklet";
        scrubActive.set(false);
        if (hasOnScrub) scheduleOnRN(handleScrubEnd);
      },
    );

  /* istanbul ignore next -- Android-only gesture axis config */
  if (Platform.OS === "android") {
    gesture = gesture.activeOffsetX([-25, 25]).failOffsetY([-25, 25]);
  }

  return {
    scrubX,
    scrubActive,
    scrubTime,
    scrubValue,
    crosshairOpacity,
    tooltipLayout,
    gesture,
  };
}
