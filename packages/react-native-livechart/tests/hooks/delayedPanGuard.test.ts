import type { SharedValue } from "react-native-reanimated";
import {
  HOLD_MAX_DRIFT_PX,
  HOLD_TIMER_SLACK_MS,
  delayedPanTouchCancelled,
  delayedPanTouchDown,
  delayedPanTouchMove,
  delayedPanTouchUp,
  resetDelayedPanGuard,
  shouldStartDelayedPan,
} from "../../src/hooks/delayedPanGuard";
import { withSharedValueAccessors } from "../support/sharedValueMock";

function sharedValue<T>(initial: T): SharedValue<T> {
  const result = withSharedValueAccessors({
    shared: { value: initial },
  });
  return result.shared as unknown as SharedValue<T>;
}

function makeGuard() {
  return {
    fingerDown: sharedValue(false),
    panActivated: sharedValue(false),
    downX: sharedValue(0),
    downY: sharedValue(0),
    downAtMs: sharedValue(0),
    holdBroken: sharedValue(false),
    scrollActive: sharedValue(false),
  };
}

function touchEvent(x: number, y: number, numberOfTouches = 1) {
  return {
    numberOfTouches,
    changedTouches: [{ x, y }],
    allTouches: [{ x, y }],
  };
}

/** Rewind `downAtMs` so the guard sees a fully elapsed hold. */
function elapseHold(g: ReturnType<typeof makeGuard>, delayMs: number) {
  g.downAtMs.set(Date.now() - delayMs);
}

describe("delayed pan guard", () => {
  it("fails a pending delayed pan when its final pointer lifts", () => {
    const g = makeGuard();
    const manager = { fail: jest.fn() };

    delayedPanTouchDown(
      400,
      touchEvent(50, 60),
      g.fingerDown,
      g.downX,
      g.downY,
      g.downAtMs,
      g.holdBroken,
    );
    expect(g.fingerDown.get()).toBe(true);
    expect(g.downX.get()).toBe(50);
    expect(g.downY.get()).toBe(60);

    delayedPanTouchUp(
      400,
      { numberOfTouches: 0 },
      manager,
      g.fingerDown,
      g.panActivated,
    );

    expect(g.fingerDown.get()).toBe(false);
    expect(manager.fail).toHaveBeenCalledTimes(1);
  });

  it("waits for the final pointer before failing a pending pan", () => {
    const g = makeGuard();
    g.fingerDown.set(true);
    const manager = { fail: jest.fn() };

    delayedPanTouchUp(
      400,
      { numberOfTouches: 1 },
      manager,
      g.fingerDown,
      g.panActivated,
    );

    expect(g.fingerDown.get()).toBe(true);
    expect(manager.fail).not.toHaveBeenCalled();
  });

  it("allows a real hold activation and lets the active pan finish normally", () => {
    const g = makeGuard();
    const manager = { fail: jest.fn() };

    delayedPanTouchDown(
      400,
      touchEvent(50, 60),
      g.fingerDown,
      g.downX,
      g.downY,
      g.downAtMs,
      g.holdBroken,
    );
    elapseHold(g, 400);
    expect(
      shouldStartDelayedPan(
        400,
        g.fingerDown,
        g.panActivated,
        g.downAtMs,
        g.holdBroken,
        g.scrollActive,
      ),
    ).toBe(true);
    expect(g.panActivated.get()).toBe(true);

    delayedPanTouchUp(
      400,
      { numberOfTouches: 0 },
      manager,
      g.fingerDown,
      g.panActivated,
    );
    expect(manager.fail).not.toHaveBeenCalled();

    resetDelayedPanGuard(g.fingerDown, g.panActivated, g.holdBroken);
    expect(g.fingerDown.get()).toBe(false);
    expect(g.panActivated.get()).toBe(false);
    expect(g.holdBroken.get()).toBe(false);
  });

  it("rejects a post-lift activation without leaving stale activated state", () => {
    const g = makeGuard();
    const manager = { fail: jest.fn() };

    delayedPanTouchDown(
      400,
      touchEvent(50, 60),
      g.fingerDown,
      g.downX,
      g.downY,
      g.downAtMs,
      g.holdBroken,
    );
    delayedPanTouchUp(
      400,
      { numberOfTouches: 0 },
      manager,
      g.fingerDown,
      g.panActivated,
    );

    elapseHold(g, 400);
    expect(
      shouldStartDelayedPan(
        400,
        g.fingerDown,
        g.panActivated,
        g.downAtMs,
        g.holdBroken,
        g.scrollActive,
      ),
    ).toBe(false);
    expect(g.panActivated.get()).toBe(false);

    delayedPanTouchDown(
      400,
      touchEvent(50, 60),
      g.fingerDown,
      g.downX,
      g.downY,
      g.downAtMs,
      g.holdBroken,
    );
    elapseHold(g, 400);
    expect(
      shouldStartDelayedPan(
        400,
        g.fingerDown,
        g.panActivated,
        g.downAtMs,
        g.holdBroken,
        g.scrollActive,
      ),
    ).toBe(true);
  });

  it("leaves zero-delay pan behavior untouched", () => {
    const g = makeGuard();
    const manager = { fail: jest.fn() };

    delayedPanTouchDown(
      0,
      touchEvent(50, 60),
      g.fingerDown,
      g.downX,
      g.downY,
      g.downAtMs,
      g.holdBroken,
    );
    delayedPanTouchMove(
      0,
      touchEvent(500, 600),
      manager,
      g.panActivated,
      g.downX,
      g.downY,
      g.holdBroken,
    );
    delayedPanTouchUp(
      0,
      { numberOfTouches: 0 },
      manager,
      g.fingerDown,
      g.panActivated,
    );

    expect(
      shouldStartDelayedPan(
        0,
        g.fingerDown,
        g.panActivated,
        g.downAtMs,
        g.holdBroken,
        g.scrollActive,
      ),
    ).toBe(true);
    expect(g.fingerDown.get()).toBe(false);
    expect(g.panActivated.get()).toBe(false);
    expect(manager.fail).not.toHaveBeenCalled();
  });

  it("clears delayed pointer state on cancellation", () => {
    const g = makeGuard();
    g.fingerDown.set(true);

    delayedPanTouchCancelled(400, g.fingerDown);

    expect(g.fingerDown.get()).toBe(false);
  });

  it("fails the pending pan once the finger drifts beyond the hold slop", () => {
    const g = makeGuard();
    const manager = { fail: jest.fn() };

    delayedPanTouchDown(
      400,
      touchEvent(50, 60),
      g.fingerDown,
      g.downX,
      g.downY,
      g.downAtMs,
      g.holdBroken,
    );
    delayedPanTouchMove(
      400,
      touchEvent(50 + HOLD_MAX_DRIFT_PX + 1, 60),
      manager,
      g.panActivated,
      g.downX,
      g.downY,
      g.holdBroken,
    );

    expect(g.holdBroken.get()).toBe(true);
    expect(manager.fail).toHaveBeenCalledTimes(1);
  });

  it("tolerates drift within the hold slop", () => {
    const g = makeGuard();
    const manager = { fail: jest.fn() };

    delayedPanTouchDown(
      400,
      touchEvent(50, 60),
      g.fingerDown,
      g.downX,
      g.downY,
      g.downAtMs,
      g.holdBroken,
    );
    delayedPanTouchMove(
      400,
      touchEvent(50 + HOLD_MAX_DRIFT_PX - 1, 60),
      manager,
      g.panActivated,
      g.downX,
      g.downY,
      g.holdBroken,
    );

    expect(g.holdBroken.get()).toBe(false);
    expect(manager.fail).not.toHaveBeenCalled();
  });

  it("ignores movement once the pan is already activated", () => {
    const g = makeGuard();
    const manager = { fail: jest.fn() };
    g.panActivated.set(true);

    delayedPanTouchMove(
      400,
      touchEvent(500, 600),
      manager,
      g.panActivated,
      g.downX,
      g.downY,
      g.holdBroken,
    );

    expect(g.holdBroken.get()).toBe(false);
    expect(manager.fail).not.toHaveBeenCalled();
  });

  it("rejects an activation whose hold was broken, even after native fail was lost", () => {
    const g = makeGuard();
    const manager = { fail: jest.fn() };

    delayedPanTouchDown(
      400,
      touchEvent(50, 60),
      g.fingerDown,
      g.downX,
      g.downY,
      g.downAtMs,
      g.holdBroken,
    );
    delayedPanTouchMove(
      400,
      touchEvent(200, 60),
      manager,
      g.panActivated,
      g.downX,
      g.downY,
      g.holdBroken,
    );

    // iOS `activateAfterLongPress` fires ACTIVE unconditionally — the latch is
    // what rejects it.
    elapseHold(g, 400);
    expect(
      shouldStartDelayedPan(
        400,
        g.fingerDown,
        g.panActivated,
        g.downAtMs,
        g.holdBroken,
        g.scrollActive,
      ),
    ).toBe(false);
    expect(g.panActivated.get()).toBe(false);
  });

  it("rejects a stale timer firing early into a new touch", () => {
    const g = makeGuard();

    delayedPanTouchDown(
      400,
      touchEvent(50, 60),
      g.fingerDown,
      g.downX,
      g.downY,
      g.downAtMs,
      g.holdBroken,
    );
    // Fast successive taps: the previous touch's timer fires only ~100ms into
    // this touch — far less than delayMs - HOLD_TIMER_SLACK_MS.
    g.downAtMs.set(Date.now() - 100);
    expect(
      shouldStartDelayedPan(
        400,
        g.fingerDown,
        g.panActivated,
        g.downAtMs,
        g.holdBroken,
        g.scrollActive,
      ),
    ).toBe(false);
    expect(g.panActivated.get()).toBe(false);
  });

  it("accepts a timer within the slack window of the full delay", () => {
    const g = makeGuard();

    delayedPanTouchDown(
      400,
      touchEvent(50, 60),
      g.fingerDown,
      g.downX,
      g.downY,
      g.downAtMs,
      g.holdBroken,
    );
    g.downAtMs.set(Date.now() - (400 - HOLD_TIMER_SLACK_MS));
    expect(
      shouldStartDelayedPan(
        400,
        g.fingerDown,
        g.panActivated,
        g.downAtMs,
        g.holdBroken,
        g.scrollActive,
      ),
    ).toBe(true);
  });

  it("rejects an activation while the time-scroll pan owns the touch", () => {
    const g = makeGuard();

    delayedPanTouchDown(
      400,
      touchEvent(50, 60),
      g.fingerDown,
      g.downX,
      g.downY,
      g.downAtMs,
      g.holdBroken,
    );
    g.scrollActive.set(true);
    elapseHold(g, 400);
    expect(
      shouldStartDelayedPan(
        400,
        g.fingerDown,
        g.panActivated,
        g.downAtMs,
        g.holdBroken,
        g.scrollActive,
      ),
    ).toBe(false);
    expect(g.panActivated.get()).toBe(false);
  });
});
