import { useEffect } from "react";
import {
  makeMutable,
  startMapper,
  stopMapper,
  useAnimatedReaction,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import type { VisibleRange } from "../types";
import { useLatestCallback } from "./useLatestCallback";

export type { VisibleRange };

/** Engine SharedValues the visible-range reaction reads. */
export interface VisibleRangeEngineRefs {
  timestamp: SharedValue<number>;
  displayWindow: SharedValue<number>;
  viewEnd: SharedValue<number | null>;
}

export interface UseVisibleRangeOptions {
  engine: VisibleRangeEngineRefs;
  /** Earliest retained time (unix seconds) — used for the `onReachStart` trigger. */
  minTime: SharedValue<number>;
  /** Fires (throttled to ~1 Hz) when the visible window's edges change. */
  onVisibleRangeChange?: (range: VisibleRange) => void;
  /**
   * Fires once when the window's left edge comes within one window-width of the
   * earliest retained data — the cue to lazily page in older history. Re-arms
   * after the edge moves back out.
   */
  onReachStart?: () => void;
}

/** Whether the window's left edge is within `threshold` seconds of the oldest data. */
export function isNearStart(
  winStart: number,
  minTime: number,
  threshold: number,
): boolean {
  "worklet";
  return winStart <= minTime + threshold;
}

const RANGE_INTERVAL_MS = 1000;

/** Report the drawn viewport to JS paging callbacks on either chart. */
export function useVisibleRange({
  engine: { timestamp, displayWindow, viewEnd },
  minTime,
  onVisibleRangeChange,
  onReachStart,
}: UseVisibleRangeOptions): void {
  const emitRange = useLatestCallback((range: VisibleRange) => onVisibleRangeChange?.(range));
  const emitReachStart = useLatestCallback(() => onReachStart?.());
  const watchRange = onVisibleRangeChange != null;
  const watchStart = onReachStart != null;

  useEffect(() => {
    if (!watchRange) return;
    const pending = makeMutable(false);
    let active = true;
    let lastReport = -Infinity;
    let timeout: ReturnType<typeof setTimeout>;

    function deliver(range: VisibleRange) {
      if (!active) return;
      lastReport = performance.now();
      emitRange(range);
    }

    function flush() {
      // Sample all three fields on the same UI frame, including the final range
      // when the chart has stopped producing frames during the throttle interval.
      scheduleOnUI(() => {
        "worklet";
        pending.set(false);
        const endSec = timestamp.get();
        scheduleOnRN(deliver, {
          startSec: endSec - displayWindow.get(),
          endSec,
          following: viewEnd.get() == null,
        });
      });
    }

    function requestReport() {
      if (!active) return;
      const remaining = RANGE_INTERVAL_MS - (performance.now() - lastReport);
      if (remaining > 0) timeout = setTimeout(flush, remaining);
      else flush();
    }

    // Subscribe only to the viewport. Keep one JS request in flight while any
    // number of pan, zoom, or horizon frames update the range underneath it.
    const mapper = startMapper(() => {
      "worklet";
      if (!pending.get()) {
        pending.set(true);
        scheduleOnRN(requestReport);
      }
    }, [timestamp, displayWindow, viewEnd]);

    return () => {
      active = false;
      stopMapper(mapper);
      clearTimeout(timeout);
    };
  }, [watchRange, timestamp, displayWindow, viewEnd, emitRange]);

  useAnimatedReaction(
    () => {
      if (!watchStart) return false;
      const width = displayWindow.get();
      return isNearStart(timestamp.get() - width, minTime.get(), width);
    },
    (near, wasNear) => {
      if (near && !wasNear) scheduleOnRN(emitReachStart);
    },
    [watchStart, timestamp, displayWindow, minTime, emitReachStart],
  );
}
