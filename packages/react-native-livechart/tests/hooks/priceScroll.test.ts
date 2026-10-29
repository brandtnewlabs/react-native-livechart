import { renderHook } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";

import { resolvePriceScroll } from "../../src/core/resolveConfig";
import {
  isPriceScrollArmed,
  nextPriceRange,
  usePanScroll,
  type PanScrollEngineRefs,
  type PanScrollGestureMode,
} from "../../src/hooks/usePanScroll";
import type { ChartScale } from "../../src/types";

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const shared = <T>(initial: T) => ({
    value: initial,
    get() {
      return this.value;
    },
    set(next: T) {
      this.value = next;
    },
  });
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T>(initial: T) => React.useRef(shared(initial)).current,
    useDerivedValue: <T>(compute: () => T) =>
      React.useRef({ get: compute, value: undefined }).current,
    // The overscroll and arming reactions need the UI scheduler; the arming
    // predicate is covered directly below.
    useAnimatedReaction: jest.fn(),
    cancelAnimation: jest.fn(),
    withDecay: jest.fn(() => 0),
  };
});

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

type Range = Pick<ChartScale, "min" | "max">;

const padding = { left: 12, right: 68, top: 10, bottom: 60 };
// Plot height = 300 - 10 - 60 = 230 px; plot width = 400 - 12 - 68 = 320 px.

describe("isPriceScrollArmed", () => {
  it("always arms in the always mode", () => {
    expect(isPriceScrollArmed("always", 1, null, false)).toBe(true);
  });

  it("arms after a manual scale, a pinch, or an earlier price pan", () => {
    expect(isPriceScrollArmed("afterScale", 1, null, false)).toBe(false);
    expect(isPriceScrollArmed("afterScale", 1.5, null, false)).toBe(true);
    expect(isPriceScrollArmed("afterScale", 1, 45, false)).toBe(true);
    expect(isPriceScrollArmed("afterScale", 1, null, true)).toBe(true);
  });
});

describe("nextPriceRange", () => {
  const fit = { min: 0, max: 100 };

  it("shifts both bounds by the dragged fraction of the span (down ⇒ higher prices)", () => {
    expect(nextPriceRange(fit, 23, 230, 0, 100, 1)).toEqual({ min: 10, max: 110 });
    expect(nextPriceRange(fit, -23, 230, 0, 100, 1)).toEqual({ min: -10, max: 90 });
  });

  it("stops maxOvershoot spans past the fitted range", () => {
    expect(nextPriceRange({ min: 110, max: 210 }, 230, 230, 0, 100, 1)).toEqual({
      min: 100,
      max: 200,
    });
    expect(nextPriceRange({ min: -90, max: 10 }, -230, 230, 0, 100, 1)).toEqual({
      min: -100,
      max: 0,
    });
    expect(nextPriceRange(fit, 230, 230, 0, 100, 0)).toEqual(fit);
  });

  it("ignores the fit bounds while they are unknown", () => {
    expect(nextPriceRange(fit, 460, 230, NaN, NaN, 1)).toEqual({ min: 200, max: 300 });
  });

  it("returns the input unchanged for a degenerate span, plot height, or delta", () => {
    const flat = { min: 5, max: 5 };
    expect(nextPriceRange(flat, 10, 230, 0, 100, 1)).toBe(flat);
    expect(nextPriceRange(fit, 10, 0, 0, 100, 1)).toBe(fit);
    expect(nextPriceRange(fit, NaN, 230, 0, 100, 1)).toBe(fit);
  });
});

type PanConfig = {
  manualActivation?: boolean;
  activeOffsetXStart?: number;
  activeOffsetXEnd?: number;
  activeOffsetYStart?: number;
  activeOffsetYEnd?: number;
  failOffsetYStart?: number;
  failOffsetYEnd?: number;
};

type PanHandlers = {
  onStart: () => void;
  onChange: (e: { changeX: number; changeY: number; translationY: number }) => void;
  onFinalize: () => void;
};

function makeEngine() {
  return {
    wake: jest.fn(),
    viewEnd: shared<number | null>(null),
    liveEdge: shared(1000),
    displayWindow: shared(60),
    canvasWidth: shared(400),
    canvasHeight: shared(300),
    viewRange: shared<Range | null>(null),
    viewRangeGestureOwned: shared(false),
    displayMin: shared(0),
    displayMax: shared(100),
    fitMin: shared(0),
    fitMax: shared(100),
    viewWindow: shared<number | null>(null),
  } satisfies PanScrollEngineRefs;
}

async function setup({
  priceScroll = resolvePriceScroll({ activation: "always" }),
  mode = "holdToScrub" as PanScrollGestureMode,
  yRangeScale = shared(1),
} = {}) {
  const engine = makeEngine();
  const scrollActive = shared(false);
  const scrubActive = shared(false);
  const hook = await renderHook(() =>
    usePanScroll({
      engine,
      padding,
      minTime: shared(900),
      enabled: true,
      mode,
      priceScroll,
      yRangeScale,
      scrollActive,
      scrubActive,
    }),
  );
  const pan = hook.result.current;
  return {
    engine,
    scrollActive,
    scrubActive,
    config: pan.config as PanConfig,
    handlers: pan.handlers as unknown as PanHandlers,
  };
}

describe("usePanScroll with priceScroll", () => {
  it("activates natively on vertical travel while armed, instead of failing it", async () => {
    const { config } = await setup();
    expect(config.manualActivation).toBeFalsy();
    expect([config.activeOffsetXStart, config.activeOffsetXEnd]).toEqual([-6, 6]);
    expect([config.activeOffsetYStart, config.activeOffsetYEnd]).toEqual([-6, 6]);
    expect(config.failOffsetYStart).toBeUndefined();
  });

  it("keeps the classic pan that fails on vertical travel while unarmed or disabled", async () => {
    for (const priceScroll of [resolvePriceScroll(true), null]) {
      const { config } = await setup({ priceScroll });
      expect([config.activeOffsetXStart, config.activeOffsetXEnd]).toEqual([-6, 6]);
      expect([config.failOffsetYStart, config.failOffsetYEnd]).toEqual([-12, 12]);
      expect(config.activeOffsetYStart).toBeUndefined();
    }
    const { config } = await setup({ mode: "axisDrag" });
    expect(config.manualActivation).toBe(true);
  });

  it("freezes the auto-fit into a range once the drag turns vertical, then shifts it", async () => {
    const { engine, handlers, scrollActive } = await setup();
    handlers.onStart();
    expect(engine.wake).toHaveBeenCalledTimes(1);
    expect(scrollActive.get()).toBe(true);

    // A horizontal-only move scrolls time and leaves the Y auto-fit alone.
    handlers.onChange({ changeX: 32, changeY: 0, translationY: 2 });
    expect(engine.viewEnd.get()).toBe(994);
    expect(engine.viewRange.get()).toBeNull();
    expect(engine.viewRangeGestureOwned.get()).toBe(false);

    // Vertical intent: snapshot the display range and move it with the finger.
    handlers.onChange({ changeX: 0, changeY: 23, translationY: 23 });
    expect(engine.viewRange.get()).toEqual({ min: 10, max: 110 });
    expect(engine.viewRangeGestureOwned.get()).toBe(true);

    // Further travel continues from the owned range and stops one span past the fit.
    handlers.onChange({ changeX: 0, changeY: 230, translationY: 253 });
    expect(engine.viewRange.get()).toEqual({ min: 100, max: 200 });

    handlers.onFinalize();
    expect(scrollActive.get()).toBe(false);
  });

  it("carries an earlier pan's range on instead of re-snapshotting the display", async () => {
    const { engine, handlers } = await setup();
    engine.viewRange.set({ min: 40, max: 60 });
    engine.viewRangeGestureOwned.set(true);
    handlers.onStart();
    handlers.onChange({ changeX: 0, changeY: 23, translationY: 23 });
    expect(engine.viewRange.get()).toEqual({ min: 42, max: 62 });
  });

  it("re-arms engagement per drag and never pans while unarmed", async () => {
    const { engine, handlers } = await setup();
    handlers.onStart();
    handlers.onChange({ changeX: 0, changeY: 23, translationY: 23 });
    handlers.onFinalize();
    // The next drag starts horizontal: no vertical intent yet, so no price pan.
    handlers.onStart();
    handlers.onChange({ changeX: 0, changeY: 5, translationY: 5 });
    expect(engine.viewRange.get()).toEqual({ min: 10, max: 110 });

    const unarmed = await setup({ priceScroll: resolvePriceScroll(true) });
    unarmed.handlers.onStart();
    unarmed.handlers.onChange({ changeX: 0, changeY: 23, translationY: 23 });
    expect(unarmed.engine.viewRange.get()).toBeNull();
  });

  it("goes inert while a scrub owns the touch", async () => {
    const { engine, handlers, scrubActive, scrollActive } = await setup();
    scrubActive.set(true);
    handlers.onStart();
    expect(scrollActive.get()).toBe(false);
    handlers.onChange({ changeX: 32, changeY: 23, translationY: 23 });
    expect(engine.viewEnd.get()).toBeNull();
    expect(engine.viewRange.get()).toBeNull();
  });
});
