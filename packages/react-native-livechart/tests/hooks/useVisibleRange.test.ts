import { renderHook } from "@testing-library/react-native";
import { startMapper, stopMapper, makeMutable } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { isNearStart, useVisibleRange, type VisibleRange } from "../../src/hooks/useVisibleRange";

let mockFrame: () => void;
let mockReachReaction: () => void;
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated"),
  makeMutable: <T>(value: T) => ({ get: () => value, set: (next: T) => { value = next; } }),
  startMapper: jest.fn((worklet: () => void) => { mockFrame = worklet; return 1; }),
  stopMapper: jest.fn(),
  useAnimatedReaction: (prepare: () => boolean, react: (near: boolean, prev: boolean | null) => void) => {
    let previous: boolean | null = null;
    mockReachReaction = () => {
      const near = prepare();
      react(near, previous);
      previous = near;
    };
  },
}));
jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets"),
  scheduleOnUI: (fn: () => void) => fn(),
  scheduleOnRN: jest.fn((fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args)),
}));

describe("isNearStart", () => {
  it("is true when the left edge is within the threshold of the oldest data", () => {
    // winStart 1010 ≤ minTime 1000 + threshold 30.
    expect(isNearStart(1010, 1000, 30)).toBe(true);
  });

  it("is true exactly at the threshold boundary", () => {
    expect(isNearStart(1030, 1000, 30)).toBe(true);
  });

  it("is false when the left edge is still far from the oldest data", () => {
    expect(isNearStart(1031, 1000, 30)).toBe(false);
  });
});

describe("visible range notifications", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  async function setup(oldest = 900) {
    const engine = {
      timestamp: makeMutable(1000), displayWindow: makeMutable(30), viewEnd: makeMutable<number | null>(null),
    };
    const minTime = makeMutable(oldest);
    const onReachStart = jest.fn();
    const onVisibleRangeChange = jest.fn();
    const hook = await renderHook(({ enabled }: { enabled: boolean }) => useVisibleRange({
      engine, minTime, onReachStart, onVisibleRangeChange: enabled ? onVisibleRangeChange : undefined,
    }), { initialProps: { enabled: true } });
    mockFrame();
    mockReachReaction();
    return { ...hook, engine, onReachStart, onVisibleRangeChange };
  }

  it("coalesces a rapid reveal and release by elapsed time and delivers each settled edge", async () => {
    const { engine, onReachStart, onVisibleRangeChange } = await setup(800);
    expect(onVisibleRangeChange).toHaveBeenLastCalledWith({ startSec: 970, endSec: 1000, following: true });
    for (const direction of [1, -1]) {
      const callsBefore = onVisibleRangeChange.mock.calls.length;
      const bridgeCallsBefore = jest.mocked(scheduleOnRN).mock.calls.length;
      for (let i = 1; i <= 20; i++) {
        jest.advanceTimersByTime(17);
        const extension = direction === 1 ? i * 5.01 : (20 - i) * 5.01;
        engine.timestamp.set(1000 + extension);
        engine.displayWindow.set(30 + extension);
        mockFrame();
        mockReachReaction();
      }
      // One timer request per burst while the oldest point stays outside the paging threshold.
      expect(jest.mocked(scheduleOnRN).mock.calls.length - bridgeCallsBefore).toBe(1);
      expect(onVisibleRangeChange).toHaveBeenCalledTimes(callsBefore);
      expect(onReachStart).not.toHaveBeenCalled();
      jest.advanceTimersByTime(659);
      expect(onVisibleRangeChange).toHaveBeenCalledTimes(callsBefore);
      jest.advanceTimersByTime(1);
      expect(onVisibleRangeChange).toHaveBeenCalledTimes(callsBefore + 1);
      expect(onVisibleRangeChange).toHaveBeenLastCalledWith({
        startSec: 970, endSec: direction === 1 ? 1100.2 : 1000, following: true,
      });
    }
    jest.advanceTimersByTime(5000);
    expect(onVisibleRangeChange).toHaveBeenCalledTimes(3);
  });

  it("publishes the crossing frame before the loader reads the cached range during a fast pan", async () => {
    const { engine, onReachStart, onVisibleRangeChange } = await setup();
    const atPageRequest: VisibleRange[] = [];
    onReachStart.mockImplementation(() => {
      atPageRequest.push(onVisibleRangeChange.mock.lastCall?.[0]);
    });

    engine.timestamp.set(965);
    engine.viewEnd.set(965);
    mockFrame();
    mockReachReaction();
    jest.advanceTimersByTime(20);
    engine.timestamp.set(930);
    engine.viewEnd.set(930);
    mockFrame();
    mockReachReaction();
    mockReachReaction();

    const crossing = { startSec: 900, endSec: 930, following: false };
    expect(atPageRequest).toEqual([crossing]);
    jest.advanceTimersByTime(2000);
    expect(onVisibleRangeChange.mock.calls).toEqual([
      [{ startSec: 970, endSec: 1000, following: true }],
      [crossing],
    ]);

    engine.timestamp.set(1000);
    engine.viewEnd.set(null);
    mockFrame();
    mockReachReaction();
    jest.advanceTimersByTime(300);
    engine.timestamp.set(955);
    engine.viewEnd.set(955);
    mockFrame();
    mockReachReaction();
    expect(atPageRequest).toEqual([crossing, { startSec: 925, endSec: 955, following: false }]);

    engine.timestamp.set(950);
    engine.viewEnd.set(950);
    mockFrame();
    mockReachReaction();
    jest.advanceTimersByTime(999);
    expect(onVisibleRangeChange).toHaveBeenLastCalledWith(atPageRequest[1]);
    jest.advanceTimersByTime(1);
    expect(onVisibleRangeChange).toHaveBeenLastCalledWith({ startSec: 920, endSec: 950, following: false });
    expect(onReachStart).toHaveBeenCalledTimes(2);
  });

  it("delivers a sub-second change and cancels trailing work on disable or unmount", async () => {
    const { engine, onVisibleRangeChange, rerender, unmount } = await setup();
    engine.timestamp.set(1000.125);
    engine.viewEnd.set(1000.125);
    mockFrame();
    jest.advanceTimersByTime(1000);
    expect(onVisibleRangeChange).toHaveBeenLastCalledWith({
      startSec: 970.125, endSec: 1000.125, following: false,
    });
    engine.timestamp.set(1000.25);
    mockFrame();
    await rerender({ enabled: false });
    expect(stopMapper).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    expect(onVisibleRangeChange).toHaveBeenCalledTimes(2);
    await rerender({ enabled: true });
    expect(startMapper).toHaveBeenCalledTimes(2);
    mockFrame();
    expect(onVisibleRangeChange).toHaveBeenCalledTimes(3);
    engine.timestamp.set(1000.5);
    mockFrame();
    await unmount();
    jest.advanceTimersByTime(1000);
    expect(onVisibleRangeChange).toHaveBeenCalledTimes(3);
  });
});
