import { Platform } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import type { MultiEngineState } from "../core/useLiveChartEngine";
import { type ChartPadding } from "../draw/line";
import type { ScrubPointMulti } from "../types";
import {
  deriveScrubValueSeries,
  interpolateSeriesAtTime,
} from "./crosshairSeries";
import {
  computeCrosshairOpacity,
  computeScrubTime,
  HIDDEN_TOOLTIP,
  type CrosshairState,
} from "./crosshairShared";

/**
 * LiveChartSeries crosshair + scrub. No tooltip — data is delivered via
 * `onScrub` worklet callback on the UI thread.
 */
export function useCrosshairSeries(
  engine: MultiEngineState,
  padding: ChartPadding,
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
    deriveScrubValueSeries(
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

  const tooltipLayout = useSharedValue(HIDDEN_TOOLTIP);

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
      const r = interpolateSeriesAtTime(engine.series.value, time);
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
      if (curr === "__inactive__") {
        onScrub!(null);
        return;
      }
      if (curr === "__idle__" || curr === "__pending__") {
        return;
      }
      if (curr === prev) return;
      const p = JSON.parse(curr) as {
        time: number;
        x: number;
        y: number;
        primary: number;
        series: ScrubPointMulti["seriesValues"];
      };
      onScrub!({
        time: p.time,
        value: p.primary,
        x: p.x,
        y: p.y,
        seriesValues: p.series,
      });
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
