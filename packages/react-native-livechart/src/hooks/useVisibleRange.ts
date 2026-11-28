import { useCallback, useEffect, useRef } from "react";
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

// React Native supplies this monotonic clock. The library builds without DOM types.
declare const performance: { now(): number };

const RANGE_INTERVAL_MS = 1000;

/** Report the drawn viewport to JS paging callbacks on either chart. */
export function useVisibleRange({
  engine: { timestamp, displayWindow, viewEnd },
  minTime,
  onVisibleRangeChange,
  onReachStart,
}: UseVisibleRangeOptions): void {
  const readRange = useCallback((): VisibleRange => {
    "worklet";
    const endSec = timestamp.get();
    return { startSec: endSec - displayWindow.get(), endSec, following: viewEnd.get() == null };
  }, [timestamp, displayWindow, viewEnd]);
  const lastReport = useRef<{ range: VisibleRange; time: number } | null>(null);
  const emitRange = useLatestCallback((range: VisibleRange) => {
    const previous = lastReport.current?.range;
    if (!onVisibleRangeChange) return;
    if (
      previous?.startSec === range.startSec &&
      previous.endSec === range.endSec &&
      previous.following === range.following
    ) return;
    lastReport.current = { range, time: performance.now() };
    onVisibleRangeChange(range);
  });
  const emitReachStart = useLatestCallback((range: VisibleRange) => {
    if (!onReachStart) return;
    // Paging loaders read the last reported range synchronously in onReachStart.
    emitRange(range);
    onReachStart();
  });
  const watchRange = onVisibleRangeChange != null;
  const watchStart = onReachStart != null;

  useEffect(() => {
    if (!watchRange) return;
    const pending = makeMutable(false);
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;

    function deliver(range: VisibleRange) {
      if (!active) return;
      emitRange(range);
    }

    function flush() {
      // Sample all three fields on the same UI frame, including the final range
      // when the chart has stopped producing frames during the throttle interval.
      scheduleOnUI(() => {
        "worklet";
        pending.set(false);
        scheduleOnRN(deliver, readRange());
      });
    }

    function requestReport() {
      if (!active) return;
      const lastTime = lastReport.current?.time ?? -Infinity;
      const remaining = RANGE_INTERVAL_MS - (performance.now() - lastTime);
      // A paging callback can report a newer viewport while the timer is waiting.
      if (remaining > 0) timeout = setTimeout(requestReport, Math.ceil(remaining));
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
      lastReport.current = null;
      stopMapper(mapper);
      clearTimeout(timeout);
    };
  }, [watchRange, timestamp, displayWindow, viewEnd, readRange, emitRange]);

  useAnimatedReaction(
    () => {
      if (!watchStart) return false;
      const width = displayWindow.get();
      return isNearStart(timestamp.get() - width, minTime.get(), width);
    },
    (near, wasNear) => {
      if (near && !wasNear) scheduleOnRN(emitReachStart, readRange());
    },
    [watchStart, timestamp, displayWindow, minTime, readRange, emitReachStart],
  );
}
