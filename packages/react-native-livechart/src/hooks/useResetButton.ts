import { useCallback, useMemo } from "react";
import { Gesture, type GestureType } from "react-native-gesture-handler";
import {
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import type { ResolvedResetButtonConfig } from "../core/resolveConfig";
import type {
  ChartEngineLayout,
  ChartEngineRange,
  ChartEngineReturnToLive,
  ChartEngineScroll,
} from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import {
  isResetButtonHit,
  isViewOffFitted,
  resetButtonRect,
  type ResetButtonRect,
} from "./resetButtonLayout";
import { resetChartView, type ResetViewRefs } from "./resetView";

/** Travel (px) and hold (ms) that still count as a tap on the button. */
const TAP_MAX_DISTANCE_PX = 12;
const TAP_MAX_DURATION_MS = 400;

interface Options {
  /** `null` hides the button; `resetView()` on the handle still works. */
  config: ResolvedResetButtonConfig | null;
  engine: Pick<ChartEngineLayout, "canvasWidth" | "canvasHeight"> &
    ChartEngineScroll &
    ChartEngineRange &
    ChartEngineReturnToLive & { wake?: () => void };
  padding: ChartPadding;
  yRangeScale: SharedValue<number>;
  /** The button hides while the crosshair owns the touch. */
  scrubActive: SharedValue<boolean>;
  /** Resolved `timeScroll.returnToLive` duration (ms). */
  returnToLiveMs: number;
  onResetView?: () => void;
}

export interface ResetButtonState {
  /** True while the view differs from the fitted live view (and no scrub). */
  visible: SharedValue<boolean>;
  /** Canvas-px rect the overlay positions itself at and the tap hit-tests. */
  rect: SharedValue<ResetButtonRect>;
  /** Written by the overlay's `onLayout`, so a custom visual of any size works. */
  measuredWidth: SharedValue<number>;
  measuredHeight: SharedValue<number>;
  /** Tap on the button, or `null` when the button is off. Compose ahead of the plot graph. */
  tapGesture: GestureType | null;
  /** JS-thread reset (the handle's `resetView()` and accessibility activation). */
  reset: () => void;
}

/**
 * Visibility, placement and the tap of the floating reset-view button. The
 * tap claims only touches that land on the visible button and fails everywhere
 * else, so composed `Exclusive` ahead of the plot gestures it never delays them.
 */
export function useResetButton({
  config,
  engine,
  padding,
  yRangeScale,
  scrubActive,
  returnToLiveMs,
  onResetView,
}: Options): ResetButtonState {
  const {
    viewEnd,
    viewWindow,
    viewRange,
    viewRangeGestureOwned,
    canvasWidth,
    canvasHeight,
    returnT,
    returnFrom,
    wake,
  } = engine;
  const { left, right, top, bottom } = padding;
  const enabled = config !== null;
  const placement = config?.placement ?? "bottom-center";
  const margin = config?.margin ?? 0;
  const showYScale = config?.showFor.yScale ?? true;
  const showPriceScroll = config?.showFor.priceScroll ?? true;
  const showTimeScroll = config?.showFor.timeScroll ?? true;
  const showZoom = config?.showFor.zoom ?? true;

  const measuredWidth = useSharedValue(0);
  const measuredHeight = useSharedValue(0);

  const visible = useDerivedValue(() => {
    if (!enabled || scrubActive.get()) return false;
    return isViewOffFitted(
      viewEnd.get(),
      viewWindow.get(),
      yRangeScale.get(),
      viewRangeGestureOwned.get() && viewRange.get() !== null,
      showTimeScroll,
      showZoom,
      showYScale,
      showPriceScroll,
    );
  });

  const rect = useDerivedValue(() =>
    resetButtonRect(
      canvasWidth.get(),
      canvasHeight.get(),
      { left, right, top, bottom },
      placement,
      margin,
      measuredWidth.get(),
      measuredHeight.get(),
    ),
  );

  const refs = useMemo<ResetViewRefs>(
    () => ({
      viewEnd,
      viewWindow,
      viewRange,
      viewRangeGestureOwned,
      yRangeScale,
      returnT,
      returnFrom,
      returnToLiveMs,
    }),
    [
      returnFrom,
      returnT,
      returnToLiveMs,
      viewEnd,
      viewRange,
      viewRangeGestureOwned,
      viewWindow,
      yRangeScale,
    ],
  );

  const resetOnUI = useCallback(() => {
    "worklet";
    wake?.();
    resetChartView(refs);
    if (onResetView) scheduleOnRN(onResetView);
  }, [onResetView, refs, wake]);
  const reset = useCallback(() => {
    scheduleOnUI(resetOnUI);
  }, [resetOnUI]);

  const tapGesture = useMemo(() => {
    if (!enabled) return null;
    return Gesture.Tap()
      .maxDistance(TAP_MAX_DISTANCE_PX)
      .maxDuration(TAP_MAX_DURATION_MS)
      .onTouchesDown((event, manager) => {
        "worklet";
        const touch = event.allTouches[0];
        if (
          event.numberOfTouches !== 1 ||
          !touch ||
          !visible.get() ||
          !isResetButtonHit(touch.x, touch.y, rect.get())
        ) {
          manager.fail();
        }
      })
      .onEnd((_event, success) => {
        "worklet";
        if (!success) return;
        resetOnUI();
      });
  }, [enabled, rect, resetOnUI, visible]);

  return { visible, rect, measuredWidth, measuredHeight, tapGesture, reset };
}
