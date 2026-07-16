import { Platform } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { MultiEngineState } from "../core/useLiveChartEngine";
import { type ChartPadding } from "../draw/line";
import type { ScrubPointMulti } from "../types";
import {
  deriveScrubValueSeries,
  interpolateSeriesAtTime,
} from "./crosshairSeries";
import {
  computeCrosshairOpacity,
  computeScrubDotY,
  computeScrubTime,
  HIDDEN_TOOLTIP,
  type CrosshairState,
} from "./crosshairShared";
import {
  delayedPanTouchCancelled,
  delayedPanTouchDown,
  delayedPanTouchUp,
  resetDelayedPanGuard,
  shouldStartDelayedPan,
} from "./delayedPanGuard";

/**
 * LiveChartSeries crosshair + scrub. No tooltip — data is delivered via
 * `onScrub` worklet callback on the UI thread.
 */
export function useCrosshairSeries(
  engine: MultiEngineState,
  padding: ChartPadding,
  enabled: boolean,
  onScrub?: (point: ScrubPointMulti | null) => void,
  /** Press-and-hold delay (ms) before scrubbing activates. 0 = immediate. */
  panGestureDelay = 0,
  onGestureStart?: () => void,
  onGestureEnd?: () => void,
): CrosshairState {
  const scrubX = useSharedValue(-1);
  const scrubActive = useSharedValue(false);
  // Tracks whether the active scrub phase actually began, so a tap that never
  // activates doesn't emit a spurious onGestureEnd.
  const gestureStarted = useSharedValue(false);
  // Mirrors LiveChart's guard against RNGH's delayed-pan timer activating after
  // the final pointer has already lifted on iOS.
  const fingerDown = useSharedValue(false);
  const panActivated = useSharedValue(false);

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

  const scrubValue = useDerivedValue(() =>
    deriveScrubValueSeries(
      scrubActive.get(),
      scrubTime.get(),
      engine.series.get(),
    ),
  );

  const crosshairOpacity = useDerivedValue(() =>
    computeCrosshairOpacity(
      scrubActive.get(),
      scrubX.get(),
      engine.canvasWidth.get(),
      padding.right,
    ),
  );

  // Y pixel of the scrub intersection (leading-series value) — used by the
  // selection dot. -1 when there's no value to mark.
  const scrubDotY = useDerivedValue(() =>
    computeScrubDotY(
      scrubValue.get(),
      engine.displayMin.get(),
      engine.displayMax.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    ),
  );

  const tooltipLayout = useSharedValue(HIDDEN_TOOLTIP);

  /* istanbul ignore next */
  function handleGestureStart() {
    onGestureStart?.();
  }

  /* istanbul ignore next */
  function handleGestureEnd() {
    onGestureEnd?.();
  }

  const hasOnScrub = onScrub != null;
  const hasOnGestureStart = onGestureStart != null;
  const hasOnGestureEnd = onGestureEnd != null;

  useAnimatedReaction(
    () => {
      "worklet";
      if (!hasOnScrub) return "__idle__";
      if (!scrubActive.get()) return "__inactive__";
      const time = scrubTime.get();
      const x = scrubX.get();
      const chartW = engine.canvasWidth.get() - padding.left - padding.right;
      if (chartW <= 0) return "__pending__";
      const r = interpolateSeriesAtTime(engine.series.get(), time);
      if (r.primary === null) return "__pending__";
      const dotY = computeScrubDotY(
        r.primary,
        engine.displayMin.get(),
        engine.displayMax.get(),
        engine.canvasHeight.get(),
        padding.top,
        padding.bottom,
      );
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
    .activateAfterLongPress(panGestureDelay)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onTouchesDown(
      /* istanbul ignore next */ () => {
        "worklet";
        delayedPanTouchDown(panGestureDelay, fingerDown);
      },
    )
    .onTouchesUp(
      /* istanbul ignore next */ (e, manager) => {
        "worklet";
        delayedPanTouchUp(
          panGestureDelay,
          e,
          manager,
          fingerDown,
          panActivated,
        );
      },
    )
    .onTouchesCancelled(
      /* istanbul ignore next */ () => {
        "worklet";
        delayedPanTouchCancelled(panGestureDelay, fingerDown);
      },
    )
    // Start scrubbing on ACTIVE (onStart), not on touch-down (onBegin):
    // `activateAfterLongPress` only delays activation, so onBegin still fires
    // immediately — using it would scrub instantly and ignore panGestureDelay,
    // and leave scrubActive stuck for taps that never reach the long-press.
    .onStart(
      /* istanbul ignore next */ (e) => {
        "worklet";
        if (!shouldStartDelayedPan(panGestureDelay, fingerDown, panActivated))
          return;
        if (!enabled) return;
        scrubX.set(e.x);
        scrubActive.set(true);
        gestureStarted.set(true);
        if (hasOnGestureStart) scheduleOnRN(handleGestureStart);
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
        resetDelayedPanGuard(fingerDown, panActivated);
        scrubActive.set(false);
        if (gestureStarted.get()) {
          gestureStarted.set(false);
          if (hasOnGestureEnd) scheduleOnRN(handleGestureEnd);
        }
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
    scrubDotY,
    gesture,
  };
}
