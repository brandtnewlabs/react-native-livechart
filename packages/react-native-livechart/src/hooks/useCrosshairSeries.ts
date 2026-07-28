import type { SkFont } from "@shopify/react-native-skia";
import { Gesture } from "react-native-gesture-handler";
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type DerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { ResolvedPerSeriesTooltipConfig } from "../core/resolveConfig";
import type { MultiEngineState } from "../core/useLiveChartEngine";
import { type ChartPadding } from "../draw/line";
import type { ScrubPointMulti } from "../types";
import {
  computePerSeriesTooltipLayout,
  deriveScrubValueSeries,
  interpolateSeriesAtTime,
} from "./crosshairSeries";
import {
  computeCrosshairOpacity,
  computeScrubDotY,
  computeScrubTime,
  HIDDEN_TOOLTIP,
  SCRUB_ACTIVATE_X_PX,
  SCRUB_FAIL_Y_PX,
  type CrosshairState,
} from "./crosshairShared";
import {
  delayedPanTouchCancelled,
  delayedPanTouchDown,
  delayedPanTouchMove,
  delayedPanTouchUp,
  resetDelayedPanGuard,
  shouldStartDelayedPan,
} from "./delayedPanGuard";

/**
 * LiveChartSeries crosshair + scrub. The optional per-series tooltip is
 * calculated on the UI thread alongside the callback payload.
 */
interface CrosshairSeriesTooltipOptions {
  config: ResolvedPerSeriesTooltipConfig;
  formatValue: (value: number) => string;
  formatTime: (time: number) => string;
  font: SkFont;
  colors: string[];
  /** Current-time anchor used to clamp the live bucket's range end. */
  maxTime: SharedValue<number> | DerivedValue<number>;
}

export function useCrosshairSeries(
  engine: MultiEngineState,
  padding: ChartPadding,
  enabled: boolean,
  onScrub?: (point: ScrubPointMulti | null) => void,
  /** Press-and-hold delay (ms) before scrubbing activates. 0 = immediate. */
  panGestureDelay = 0,
  onGestureStart?: () => void,
  onGestureEnd?: () => void,
  /**
   * True while the time-scroll pan owns the touch. The hold-to-scrub pan refuses
   * to activate while set, so a drag that already started scrolling can never
   * mature into a scrub (see `delayedPanGuard.shouldStartDelayedPan`).
   */
  scrollActive?: SharedValue<boolean>,
  tooltip?: CrosshairSeriesTooltipOptions,
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
  // Where and when the current touch went down, for the stationary-hold and
  // stale-timer guards (see delayedPanGuard).
  const downX = useSharedValue(0);
  const downY = useSharedValue(0);
  const downAtMs = useSharedValue(0);
  // Latched once the finger leaves the hold slop: this touch is a drag, so its
  // long-press timer must not be honored even if it still fires.
  const holdBroken = useSharedValue(false);
  // Inert stand-in so the guard always has a latch to read when the controller
  // wires no time-scroll (hooks must be created unconditionally).
  const noScrollActive = useSharedValue(false);
  const scrollActiveSV = scrollActive ?? noScrollActive;

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

  const tooltipLayout = useDerivedValue(() => {
    if (!tooltip) return HIDDEN_TOOLTIP;
    return computePerSeriesTooltipLayout(
      scrubActive.get(),
      scrubX.get(),
      scrubTime.get(),
      engine.series.get(),
      engine.displaySeriesValues.get(),
      tooltip.colors,
      engine.displayMin.get(),
      engine.displayMax.get(),
      padding,
      engine.canvasWidth.get(),
      engine.canvasHeight.get(),
      tooltip.maxTime.get(),
      tooltip.formatValue,
      tooltip.formatTime,
      tooltip.font,
      tooltip.config,
    );
  });

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
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onTouchesDown(
      /* istanbul ignore next */ (e) => {
        "worklet";
        delayedPanTouchDown(
          panGestureDelay,
          e,
          fingerDown,
          downX,
          downY,
          downAtMs,
          holdBroken,
        );
      },
    )
    // Stationary hold: drift beyond the slop while the long-press is still
    // pending fails the pan, so a drag can never mature into a scrub.
    .onTouchesMove(
      /* istanbul ignore next */ (e, manager) => {
        "worklet";
        delayedPanTouchMove(
          panGestureDelay,
          e,
          manager,
          panActivated,
          downX,
          downY,
          holdBroken,
        );
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
        if (
          !shouldStartDelayedPan(
            panGestureDelay,
            fingerDown,
            panActivated,
            downAtMs,
            holdBroken,
            scrollActiveSV,
          )
        )
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
        resetDelayedPanGuard(fingerDown, panActivated, holdBroken);
        scrubActive.set(false);
        if (gestureStarted.get()) {
          gestureStarted.set(false);
          if (hasOnGestureEnd) scheduleOnRN(handleGestureEnd);
        }
      },
    );

  // Omit zero-valued activation modifiers so RNGH can classify direction before
  // the pan activates on iOS. A vertical drag then remains available to a parent
  // ScrollView/list, while a clear horizontal drag starts scrubbing.
  if (panGestureDelay > 0) {
    gesture = gesture.activateAfterLongPress(panGestureDelay);
  }

  gesture = gesture
    .activeOffsetX([-SCRUB_ACTIVATE_X_PX, SCRUB_ACTIVATE_X_PX])
    .failOffsetY([-SCRUB_FAIL_Y_PX, SCRUB_FAIL_Y_PX]);

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
