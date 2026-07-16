import type { SharedValue } from "react-native-reanimated";

type BooleanSharedValue = Pick<SharedValue<boolean>, "get" | "set">;

type TouchCountEvent = {
  numberOfTouches: number;
};

type GestureStateManager = {
  fail: () => void;
};

/** Mark the first pointer of a delayed pan as down. Zero-delay pans are inert. */
export function delayedPanTouchDown(
  delayMs: number,
  fingerDown: BooleanSharedValue,
): void {
  "worklet";
  if (delayMs > 0) fingerDown.set(true);
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
 * Record a real delayed-pan activation, or reject an activation whose timer
 * raced the final pointer-up. The rejected path deliberately keeps
 * `panActivated` false so a missing native FINALIZE cannot poison the next
 * interaction.
 */
export function shouldStartDelayedPan(
  delayMs: number,
  fingerDown: BooleanSharedValue,
  panActivated: BooleanSharedValue,
): boolean {
  "worklet";
  if (delayMs <= 0) return true;
  if (!fingerDown.get()) {
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
): void {
  "worklet";
  fingerDown.set(false);
  panActivated.set(false);
}
