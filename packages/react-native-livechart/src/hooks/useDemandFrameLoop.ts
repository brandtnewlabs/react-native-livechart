import { useCallback, useEffect } from "react";
import { startMapper, stopMapper, useSharedValue } from "react-native-reanimated";
import { scheduleOnUI, type WorkletFunction } from "react-native-worklets";

import { MAX_FRAME_DELTA_MS } from "../constants";

/** Wait through several unchanged frames, rather than mistaking one quiet frame for rest. */
export const IDLE_SETTLE_MS = 160;

export function nextQuietTime(previous: number, changed: boolean, dt: number): number {
  "worklet";
  return changed ? 0 : previous + Math.min(Math.max(dt, 0), MAX_FRAME_DELTA_MS);
}

/**
 * Opt-in UI-runtime RAF loop. Inputs wake it without a JS-thread round trip.
 * `tick` returns true while work changed or a continuous effect needs frames.
 * `prepare` must read INPUTS only: subscribing to tick outputs causes feedback.
 * A generation token makes queued frames harmless after replacement/unmount.
 */
export function useDemandFrameLoop(
  enabled: boolean,
  prepare: () => unknown,
  tick: (dt: number) => boolean,
): () => void {
  const mounted = useSharedValue(false);
  const running = useSharedValue(false);
  const generation = useSharedValue(0);
  const quietTime = useSharedValue(0);

  const wake = useCallback(() => {
    "worklet";
    if (!enabled || !mounted.get()) return;
    quietTime.set(0);
    if (running.get()) return;
    running.set(true);
    const token = generation.get();
    let previous: number | null = null;
    function step(timestamp: number) {
      "worklet";
      if (!mounted.get() || generation.get() !== token) return;
      // Resuming never integrates the entire sleeping interval as a single frame.
      const dt =
        previous === null
          ? 1000 / 60
          : Math.min(timestamp - previous, MAX_FRAME_DELTA_MS);
      previous = timestamp;
      const quiet = nextQuietTime(quietTime.get(), tick(dt), dt);
      quietTime.set(quiet);
      if (quiet < IDLE_SETTLE_MS) requestAnimationFrame(step);
      else running.set(false);
    }
    requestAnimationFrame(step);
  }, [enabled, mounted, running, generation, quietTime, tick]);

  useEffect(() => {
    if (!enabled) return;
    scheduleOnUI(() => {
      "worklet";
      generation.set(generation.get() + 1);
      running.set(false);
      mounted.set(true);
      wake();
    });
    // Native Reanimated 4.7 derives reaction-effect dependencies from worklet
    // closures, ignoring explicit dependencies. Swapping in an empty worklet
    // when disabled changes that dependency count. Own the mapper lifetime with
    // a fixed React dependency list instead, and unsubscribe entirely when off.
    // Object.values supports both legacy object and newer array closure formats.
    const inputs = Object.values((prepare as WorkletFunction).__closure ?? {});
    const mapper = startMapper(() => {
      "worklet";
      prepare();
      wake();
    }, inputs);
    return () => {
      stopMapper(mapper);
      scheduleOnUI(() => {
        "worklet";
        mounted.set(false);
        generation.set(generation.get() + 1);
        running.set(false);
      });
    };
  }, [enabled, generation, mounted, running, wake, prepare]);

  return wake;
}
