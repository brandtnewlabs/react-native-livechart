import { type SkFont } from "@shopify/react-native-skia";
import { Platform } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { type ChartPadding } from "../draw/line";
import type { LivelinePalette, ScrubPointMulti, ScrubSeriesValue } from "../types";
import type { MultiEngineState } from "../useLivelineEngine";
import {
  computeCrosshairOpacity,
  computeScrubTime,
  type CrosshairState,
} from "./crosshairShared";
import {
  computeMultiSeriesScrubTooltipLayout,
  deriveScrubValueMulti,
  interpolateMultiSeriesAtTime,
} from "./crosshairMulti";

/**
 * Multi-series crosshair + scrub. Requires `engine.series`.
 */
export function useCrosshairMulti(
  engine: MultiEngineState,
  padding: ChartPadding,
  _palette: LivelinePalette,
  formatValue: (v: number) => string,
  formatTime: (t: number) => string,
  font: SkFont,
  enabled: boolean,
  onScrub?: (point: ScrubPointMulti | null) => void,
): CrosshairState {
  const scrubX = useSharedValue(-1);
  const scrubActive = useSharedValue(false);

  const scrubTime = useDerivedValue(() =>
    computeScrubTime(
      scrubActive.value,
      scrubX.value,
      padding,
      engine.canvasWidth.value,
      engine.timestamp.value,
      engine.displayWindow.value,
    ),
  );

  const scrubValue = useDerivedValue(() =>
    deriveScrubValueMulti(
      scrubActive.value,
      scrubTime.value,
      engine.series.value,
    ),
  );

  const crosshairOpacity = useDerivedValue(() =>
    computeCrosshairOpacity(
      scrubActive.value,
      scrubX.value,
      engine.canvasWidth.value,
      padding.right,
    ),
  );

  const tooltipLayout = useDerivedValue(() =>
    computeMultiSeriesScrubTooltipLayout(
      scrubActive.value,
      scrubX.value,
      scrubTime.value,
      engine.series.value,
      padding,
      engine.canvasWidth.value,
      formatValue,
      formatTime,
      font,
    ),
  );

  /* istanbul ignore next */
  function handleScrubMulti(
    x: number,
    y: number,
    time: number,
    value: number,
    seriesValues: ScrubSeriesValue[],
  ) {
    onScrub?.({ time, value, x, y, seriesValues });
  }

  /* istanbul ignore next */
  function handleScrubEnd() {
    onScrub?.(null);
  }

  const hasOnScrub = onScrub != null;

  let gesture = Gesture.Pan()
    .minDistance(Platform.OS === "android" ? 10 : 0)
    .activateAfterLongPress(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin(
      /* istanbul ignore next */ (e) => {
        "worklet";
        if (!enabled) return;
        scrubX.value = e.x;
        scrubActive.value = true;
      },
    )
    .onUpdate(
      /* istanbul ignore next */ (e) => {
        "worklet";
        if (!enabled) return;
        scrubX.value = e.x;

        if (hasOnScrub) {
          const now = engine.timestamp.value;
          const windowSecs = engine.displayWindow.value;
          const chartW =
            engine.canvasWidth.value - padding.left - padding.right;
          if (chartW > 0) {
            const winStart = now - windowSecs;
            const fraction = (e.x - padding.left) / chartW;
            const time = winStart + fraction * windowSecs;
            const h = engine.canvasHeight.value;
            const chartH = h - padding.top - padding.bottom;
            const valRange = engine.displayMax.value - engine.displayMin.value;
            const r = interpolateMultiSeriesAtTime(engine.series.value, time);
            if (r.primary !== null) {
              const dotY =
                valRange === 0
                  ? padding.top + chartH / 2
                  : padding.top +
                    ((engine.displayMax.value - r.primary) / valRange) *
                      chartH;
              scheduleOnRN(
                handleScrubMulti,
                e.x,
                dotY,
                time,
                r.primary,
                r.seriesValues,
              );
            }
          }
        }
      },
    )
    .onFinalize(
      /* istanbul ignore next */ () => {
        "worklet";
        scrubActive.value = false;
        if (hasOnScrub) scheduleOnRN(handleScrubEnd);
      },
    );

  /* istanbul ignore next */
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
