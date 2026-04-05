import { type SkFont } from "@shopify/react-native-skia";
import { Platform } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
    useAnimatedReaction,
    useDerivedValue,
    useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { type ChartPadding } from "../draw/line";
import type {
    LiveChartPalette,
    ScrubPointMulti,
    ScrubSeriesValue,
} from "../types";
import type { MultiEngineState } from "../useLiveChartEngine";
import {
    computeMultiSeriesScrubTooltipLayout,
    deriveScrubValueMulti,
    interpolateMultiSeriesAtTime,
} from "./crosshairMulti";
import {
    computeCrosshairOpacity,
    computeScrubTime,
    type CrosshairState,
} from "./crosshairShared";

/**
 * Multi-series crosshair + scrub. Requires `engine.series`.
 */
export function useCrosshairMulti(
  engine: MultiEngineState,
  padding: ChartPadding,
  _palette: LiveChartPalette,
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

  useAnimatedReaction(
    () => {
      "worklet";
      if (!hasOnScrub) return "__idle__";
      if (!scrubActive.value) return "__inactive__";
      const time = scrubTime.value;
      const x = scrubX.value;
      const chartW = engine.canvasWidth.value - padding.left - padding.right;
      if (chartW <= 0) return "__pending__";
      const r = interpolateMultiSeriesAtTime(engine.series.value, time);
      if (r.primary === null) return "__pending__";
      const h = engine.canvasHeight.value;
      const chartH = h - padding.top - padding.bottom;
      const valRange = engine.displayMax.value - engine.displayMin.value;
      const dotY =
        valRange === 0
          ? padding.top + chartH / 2
          : padding.top +
            ((engine.displayMax.value - r.primary) / valRange) * chartH;
      return JSON.stringify({
        time,
        x,
        y: dotY,
        primary: r.primary,
        series: r.seriesValues,
      });
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
      const p = JSON.parse(curr) as {
        time: number;
        x: number;
        y: number;
        primary: number;
        series: ScrubSeriesValue[];
      };
      scheduleOnRN(handleScrubMulti, p.x, p.y, p.time, p.primary, p.series);
    },
  );

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
