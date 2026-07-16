import type { SharedValue } from "react-native-reanimated";
import {
  delayedPanTouchCancelled,
  delayedPanTouchDown,
  delayedPanTouchUp,
  resetDelayedPanGuard,
  shouldStartDelayedPan,
} from "../../src/hooks/delayedPanGuard";
import { withSharedValueAccessors } from "../support/sharedValueMock";

function booleanSharedValue(initial: boolean): SharedValue<boolean> {
  const result = withSharedValueAccessors({
    shared: { value: initial },
  });
  return result.shared as unknown as SharedValue<boolean>;
}

describe("delayed pan guard", () => {
  it("fails a pending delayed pan when its final pointer lifts", () => {
    const fingerDown = booleanSharedValue(false);
    const panActivated = booleanSharedValue(false);
    const manager = { fail: jest.fn() };

    delayedPanTouchDown(400, fingerDown);
    expect(fingerDown.get()).toBe(true);

    delayedPanTouchUp(
      400,
      { numberOfTouches: 0 },
      manager,
      fingerDown,
      panActivated,
    );

    expect(fingerDown.get()).toBe(false);
    expect(manager.fail).toHaveBeenCalledTimes(1);
  });

  it("waits for the final pointer before failing a pending pan", () => {
    const fingerDown = booleanSharedValue(true);
    const panActivated = booleanSharedValue(false);
    const manager = { fail: jest.fn() };

    delayedPanTouchUp(
      400,
      { numberOfTouches: 1 },
      manager,
      fingerDown,
      panActivated,
    );

    expect(fingerDown.get()).toBe(true);
    expect(manager.fail).not.toHaveBeenCalled();
  });

  it("allows a real hold activation and lets the active pan finish normally", () => {
    const fingerDown = booleanSharedValue(false);
    const panActivated = booleanSharedValue(false);
    const manager = { fail: jest.fn() };

    delayedPanTouchDown(400, fingerDown);
    expect(shouldStartDelayedPan(400, fingerDown, panActivated)).toBe(true);
    expect(panActivated.get()).toBe(true);

    delayedPanTouchUp(
      400,
      { numberOfTouches: 0 },
      manager,
      fingerDown,
      panActivated,
    );
    expect(manager.fail).not.toHaveBeenCalled();

    resetDelayedPanGuard(fingerDown, panActivated);
    expect(fingerDown.get()).toBe(false);
    expect(panActivated.get()).toBe(false);
  });

  it("rejects a post-lift activation without leaving stale activated state", () => {
    const fingerDown = booleanSharedValue(false);
    const panActivated = booleanSharedValue(false);
    const manager = { fail: jest.fn() };

    delayedPanTouchDown(400, fingerDown);
    delayedPanTouchUp(
      400,
      { numberOfTouches: 0 },
      manager,
      fingerDown,
      panActivated,
    );

    expect(shouldStartDelayedPan(400, fingerDown, panActivated)).toBe(false);
    expect(panActivated.get()).toBe(false);

    delayedPanTouchDown(400, fingerDown);
    expect(shouldStartDelayedPan(400, fingerDown, panActivated)).toBe(true);
  });

  it("leaves zero-delay pan behavior untouched", () => {
    const fingerDown = booleanSharedValue(false);
    const panActivated = booleanSharedValue(false);
    const manager = { fail: jest.fn() };

    delayedPanTouchDown(0, fingerDown);
    delayedPanTouchUp(
      0,
      { numberOfTouches: 0 },
      manager,
      fingerDown,
      panActivated,
    );

    expect(shouldStartDelayedPan(0, fingerDown, panActivated)).toBe(true);
    expect(fingerDown.get()).toBe(false);
    expect(panActivated.get()).toBe(false);
    expect(manager.fail).not.toHaveBeenCalled();
  });

  it("clears delayed pointer state on cancellation", () => {
    const fingerDown = booleanSharedValue(true);

    delayedPanTouchCancelled(400, fingerDown);

    expect(fingerDown.get()).toBe(false);
  });
});
