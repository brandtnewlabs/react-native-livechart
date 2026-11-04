import { cancelAnimation, withTiming, type SharedValue } from "react-native-reanimated";

import {
  resetChartView,
  resetSeriesView,
  Y_RANGE_SCALE_RESET_MS,
  type ResetViewRefs,
} from "../../src/hooks/resetView";

jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated"),
  // Animations resolve to their target so the written values can be asserted.
  withTiming: jest.fn((value: number) => value),
  cancelAnimation: jest.fn(),
}));

const timing = withTiming as unknown as jest.Mock;
const cancel = cancelAnimation as unknown as jest.Mock;

function shared<T>(value: T) {
  return {
    value,
    get() {
      return this.value;
    },
    set(next: T) {
      this.value = next;
    },
  } as SharedValue<T>;
}

function refs(overrides: Partial<ResetViewRefs> = {}): ResetViewRefs {
  return {
    viewEnd: shared<number | null>(900),
    viewWindow: shared<number | null>(45),
    viewRange: shared<{ min: number; max: number } | null>({ min: 10, max: 20 }),
    viewRangeGestureOwned: shared(true),
    yRangeScale: shared(2),
    returnT: shared(1),
    returnFrom: shared(0),
    returnToLiveMs: 450,
    ...overrides,
  };
}

beforeEach(() => {
  timing.mockClear();
  cancel.mockClear();
});

describe("resetChartView", () => {
  it("clears the pinch window, glides the edge back, drops a panned range and lands the scale", () => {
    const r = refs();
    resetChartView(r);
    expect(r.viewWindow.get()).toBeNull();
    expect(r.viewEnd.get()).toBeNull();
    expect(r.returnFrom.get()).toBe(900);
    expect(r.returnT.get()).toBe(1);
    expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 450 }));
    expect(r.viewRange.get()).toBeNull();
    expect(r.viewRangeGestureOwned.get()).toBe(false);
    // With a panned range the scale lands in one step, not via withTiming.
    expect(r.yRangeScale.get()).toBe(1);
    expect(timing).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(r.yRangeScale);
  });

  it("eases the scale back when no gesture-owned range is active", () => {
    const r = refs({
      viewEnd: shared<number | null>(null),
      viewRangeGestureOwned: shared(false),
      viewRange: shared<{ min: number; max: number } | null>({ min: 10, max: 20 }),
    });
    resetChartView(r);
    // An app-written range is left alone; only the scale eases.
    expect(r.viewRange.get()).toEqual({ min: 10, max: 20 });
    expect(r.yRangeScale.get()).toBe(1);
    expect(timing).toHaveBeenCalledWith(1, { duration: Y_RANGE_SCALE_RESET_MS });
    // Nothing was frozen, so no return glide is started.
    expect(r.returnFrom.get()).toBe(0);
    expect(timing).toHaveBeenCalledTimes(1);
  });

  it("snaps instead of gliding when returnToLive is off", () => {
    const r = refs({ returnToLiveMs: 0 });
    resetChartView(r);
    expect(r.viewEnd.get()).toBeNull();
    expect(r.returnFrom.get()).toBe(0);
    expect(timing).not.toHaveBeenCalledWith(1, expect.objectContaining({ duration: 0 }));
  });

  it("is a safe no-op on an already fitted view", () => {
    const r = refs({
      viewEnd: shared<number | null>(null),
      viewWindow: shared<number | null>(null),
      viewRange: shared<{ min: number; max: number } | null>(null),
      viewRangeGestureOwned: shared(false),
      yRangeScale: shared(1),
    });
    resetChartView(r);
    expect(r.viewEnd.get()).toBeNull();
    expect(r.viewWindow.get()).toBeNull();
    expect(r.viewRange.get()).toBeNull();
    expect(r.yRangeScale.get()).toBe(1);
  });
});

describe("resetSeriesView", () => {
  it("clears the pinch state and eases the scale back to 1", () => {
    const viewEnd = shared<number | null>(900);
    const viewWindow = shared<number | null>(45);
    const yRangeScale = shared(3);
    resetSeriesView({ viewEnd, viewWindow, yRangeScale });
    expect(viewEnd.get()).toBeNull();
    expect(viewWindow.get()).toBeNull();
    expect(yRangeScale.get()).toBe(1);
    expect(timing).toHaveBeenCalledWith(1, { duration: Y_RANGE_SCALE_RESET_MS });
    expect(cancel).toHaveBeenCalledTimes(3);
  });
});
