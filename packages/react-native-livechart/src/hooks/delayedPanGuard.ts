import type { SharedValue } from "react-native-reanimated";

type BooleanSharedValue = Pick<SharedValue<boolean>, "get" | "set">;
type NumberSharedValue = Pick<SharedValue<number>, "get" | "set">;

type TouchPoint = { x: number; y: number };

type TouchCountEvent = {
  numberOfTouches: number;
};

type TouchesEvent = TouchCountEvent & {
  changedTouches: TouchPoint[];
  allTouches: TouchPoint[];
};

type GestureStateManager = {
  fail: () => void;
};

/**
 * A pending hold-to-scrub pan must stay within this radius of its touch-down
 * point to activate. Matches the platform long-press convention (RNGH
 * LongPress `maxDist` / UIKit `allowableMovement` default 10) with a little
 * slack for thumbs.
 */
export const HOLD_MAX_DRIFT_PX = 12;

/**
 * An activation earlier than `delayMs - slack` after the current touch went
 * down cannot be a real hold — it is a stale `activateAfterLongPress` timer
 * carried over from a previous touch (see `shouldStartDelayedPan`).
 */
export const HOLD_TIMER_SLACK_MS = 50;

/** Record the first pointer of a delayed pan going down. Zero-delay pans are inert. */
export function delayedPanTouchDown(
  delayMs: number,
  event: TouchesEvent,
  fingerDown: BooleanSharedValue,
  downX: NumberSharedValue,
  downY: NumberSharedValue,
  downAtMs: NumberSharedValue,
  holdBroken: BooleanSharedValue,
): void {
  "worklet";
  if (delayMs <= 0) return;
  fingerDown.set(true);
  const t = event.changedTouches[0];
  if (t) {
    downX.set(t.x);
    downY.set(t.y);
  }
  downAtMs.set(performance.now());
  holdBroken.set(false);
}

/**
 * Enforce the stationary hold: while the delayed pan is still pending, any
 * drift beyond HOLD_MAX_DRIFT_PX fails it outright AND latches `holdBroken`.
 *
 * `manager.fail()` alone is not enough. It only lands if the recognizer is
 * still in a state that can fail, and — on iOS — the native
 * `activateAfterLongPress` timer fires `handleGesture:inState:Active`
 * unconditionally (RNPanHandler.m), so a timer that survived the fail still
 * emits ACTIVE. The latch makes "the finger moved before the hold elapsed" a
 * decision `shouldStartDelayedPan` can re-check at activation time, instead of
 * trusting the native recognizer to have stayed failed.
 *
 * The latch also covers movement that returns to its origin: a finger that
 * wanders 40px away and comes back is within the slop when the timer fires, but
 * it was never a stationary hold.
 */
export function delayedPanTouchMove(
  delayMs: number,
  event: TouchesEvent,
  manager: GestureStateManager,
  panActivated: BooleanSharedValue,
  downX: NumberSharedValue,
  downY: NumberSharedValue,
  holdBroken: BooleanSharedValue,
): void {
  "worklet";
  if (delayMs <= 0 || panActivated.get()) return;
  const t = event.allTouches[0];
  if (!t) return;
  const dx = t.x - downX.get();
  const dy = t.y - downY.get();
  if (dx * dx + dy * dy > HOLD_MAX_DRIFT_PX * HOLD_MAX_DRIFT_PX) {
    holdBroken.set(true);
    manager.fail();
  }
}

/**
 * Fail a delayed pan that is still pending when its final pointer lifts.
 *
 * RNGH 2.x on iOS can leave `activateAfterLongPress`'s timer armed after a
 * stationary touch ends. Failing the pending recognizer forces the reset that
 * cancels that timer. An already-active pan is left to finish normally.
 */
export function delayedPanTouchUp(
  delayMs: number,
  event: TouchCountEvent,
  manager: GestureStateManager,
  fingerDown: BooleanSharedValue,
  panActivated: BooleanSharedValue,
): void {
  "worklet";
  if (delayMs <= 0 || event.numberOfTouches > 0) return;
  fingerDown.set(false);
  if (!panActivated.get()) manager.fail();
}

/** Clear pointer state when the native touch stream is cancelled. */
export function delayedPanTouchCancelled(
  delayMs: number,
  fingerDown: BooleanSharedValue,
): void {
  "worklet";
  if (delayMs > 0) fingerDown.set(false);
}

/**
 * Record a real delayed-pan activation, or reject a spurious one. Two spurious
 * shapes exist, both from RNGH's long-press timer surviving where it shouldn't:
 *
 * 1. The timer fires after the final pointer already lifted (`fingerDown`
 *    false) — the original touch-up race.
 * 2. The timer fires DURING a later touch: fast successive taps can land a new
 *    pointer before the failed recognizer's native reset completes, so the
 *    previous tap's timer fires only `now - downAtMs < delayMs` into the new
 *    touch. A real hold can never activate early, so reject anything faster
 *    than `delayMs - HOLD_TIMER_SLACK_MS`.
 *
 * 3. The timer fires after the finger already moved off the touch-down point
 *    (`holdBroken`) — it was a drag, not a hold. See `delayedPanTouchMove`.
 *
 * 4. The timer fires after the time-scroll pan already took the touch
 *    (`scrollActive`) — the chart is mid-drag, so the hold lost the race. The
 *    two pans are composed with `Gesture.Race`, which in RNGH declares NO
 *    relation between them (`RaceGestureType = ComposedGestureType`), so
 *    nothing native stops a losing recognizer from activating later. This latch
 *    is the arbitration.
 *
 * All rejected paths deliberately keep `panActivated` false so a missing
 * native FINALIZE cannot poison the next interaction.
 */
export function shouldStartDelayedPan(
  delayMs: number,
  fingerDown: BooleanSharedValue,
  panActivated: BooleanSharedValue,
  downAtMs: NumberSharedValue,
  holdBroken: BooleanSharedValue,
  scrollActive: BooleanSharedValue,
): boolean {
  "worklet";
  if (delayMs <= 0) return true;
  if (!fingerDown.get()) {
    panActivated.set(false);
    return false;
  }
  if (performance.now() - downAtMs.get() < delayMs - HOLD_TIMER_SLACK_MS) {
    panActivated.set(false);
    return false;
  }
  if (holdBroken.get() || scrollActive.get()) {
    panActivated.set(false);
    return false;
  }
  panActivated.set(true);
  return true;
}

/** Reset the delayed-pan lifecycle after native finalization. */
export function resetDelayedPanGuard(
  fingerDown: BooleanSharedValue,
  panActivated: BooleanSharedValue,
  holdBroken: BooleanSharedValue,
): void {
  "worklet";
  fingerDown.set(false);
  panActivated.set(false);
  holdBroken.set(false);
}
