import { type SkFont } from "@shopify/react-native-skia";
import { renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { interpolateAtTime } from "../../src/math/interpolate";
import { resolveTheme } from "../../src/theme";
import type { SingleEngineState } from "../../src/core/useLiveChartEngine";
import { withSharedValueAccessors } from "../support/sharedValueMock";
import { resolveScrubAction } from "../../src/core/resolveConfig";
import { computeScrubDotY } from "../../src/hooks/crosshairShared";
import {
  computeCandleTooltipLayout,
  computeCrosshairOpacity,
  computeScrubTime,
  computeTooltipLayout,
  computeTooltipLayoutMulti,
  deriveCrosshairTooltipSingle,
  deriveScrubValueSingle,
  useCrosshair,
} from "../../src/hooks/useCrosshair";

jest.mock("react-native-gesture-handler", () => {
  const makeGesture = () => {
    const g: Record<string, unknown> = {};
    const proxy: typeof g = new Proxy(g, {
      get: (_t, _k) => () => proxy,
    });
    return proxy;
  };
  return { Gesture: { Pan: makeGesture, Tap: makeGesture } };
});

const palette = resolveTheme("#3b82f6", "dark");

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as unknown as SkFont;

const padding = { top: 12, right: 80, bottom: 28, left: 12 };

const formatValue = (v: number) => v.toFixed(2);
const formatTime = (t: number) =>
  new Date(t * 1000).toISOString().slice(11, 19);

function makeEngine(
  overrides: Partial<Record<keyof SingleEngineState, { value: unknown }>> = {},
): SingleEngineState {
  return withSharedValueAccessors({
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 50 },
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 1_700_000_030 },
    ...overrides,
  }) as unknown as SingleEngineState;
}

// ─── computeScrubTime ────────────────────────────────────────────────────────

describe("computeScrubTime", () => {
  it("returns -1 when scrub is inactive", () => {
    expect(computeScrubTime(false, 50, padding, 400, 1000, 30)).toBe(-1);
  });

  it("maps scrubX at left chart edge to window start", () => {
    expect(
      computeScrubTime(true, padding.left, padding, 400, 1000, 30),
    ).toBeCloseTo(970);
  });

  it("maps scrubX at right chart edge to now", () => {
    expect(
      computeScrubTime(true, 400 - padding.right, padding, 400, 1000, 30),
    ).toBeCloseTo(1000);
  });

  it("maps scrubX at midpoint to half-window time", () => {
    const midX = padding.left + (400 - padding.left - padding.right) / 2;
    expect(computeScrubTime(true, midX, padding, 400, 1000, 30)).toBeCloseTo(
      985,
    );
  });

  it("returns -1 when chartW is zero (canvas not yet laid out)", () => {
    expect(computeScrubTime(true, 50, padding, 0, 1000, 30)).toBe(-1);
  });

  it("handles scrubX before the left edge (extrapolates)", () => {
    const result = computeScrubTime(true, 0, padding, 400, 1000, 30);
    expect(result).toBeLessThan(970);
  });
});

// ─── computeCrosshairOpacity ─────────────────────────────────────────────────

describe("computeCrosshairOpacity", () => {
  const canvasWidth = 400;
  const paddingRight = 80;
  const dotX = canvasWidth - paddingRight;

  it("returns 0 when scrub is inactive", () => {
    expect(computeCrosshairOpacity(false, 200, canvasWidth, paddingRight)).toBe(
      0,
    );
  });

  it("returns 1 when scrubX is well left of the live dot", () => {
    expect(computeCrosshairOpacity(true, 200, canvasWidth, paddingRight)).toBe(
      1,
    );
  });

  it("returns 0 when scrubX is exactly at the live dot", () => {
    expect(computeCrosshairOpacity(true, dotX, canvasWidth, paddingRight)).toBe(
      0,
    );
  });

  it("returns 0 when scrubX is past the live dot", () => {
    expect(
      computeCrosshairOpacity(true, dotX + 10, canvasWidth, paddingRight),
    ).toBe(0);
  });

  it("fades linearly at the midpoint of the fade zone", () => {
    expect(
      computeCrosshairOpacity(true, dotX - 2, canvasWidth, paddingRight),
    ).toBeCloseTo(0.5);
  });

  it("returns 1 at exactly one fade-zone width from the dot", () => {
    expect(
      computeCrosshairOpacity(true, dotX - 4, canvasWidth, paddingRight),
    ).toBeCloseTo(1);
  });
});

// ─── computeScrubDotY ────────────────────────────────────────────────────────

describe("computeScrubDotY", () => {
  // canvasHeight 300, padTop 12, padBottom 28 → chartH 260.
  const canvasHeight = 300;
  const padTop = 12;
  const padBottom = 28;

  it("returns -1 (sentinel) when value is null", () => {
    expect(
      computeScrubDotY(null, 0, 100, canvasHeight, padTop, padBottom),
    ).toBe(-1);
  });

  it("returns -1 when the canvas is not yet laid out (chartH <= 0)", () => {
    expect(computeScrubDotY(50, 0, 100, 0, padTop, padBottom)).toBe(-1);
  });

  it("pins the dot to the vertical center for a degenerate (zero) range", () => {
    // chartH 260 → center at padTop + 130 = 142.
    expect(computeScrubDotY(50, 50, 50, canvasHeight, padTop, padBottom)).toBe(
      142,
    );
  });

  it("maps the top of the range to padTop", () => {
    expect(
      computeScrubDotY(100, 0, 100, canvasHeight, padTop, padBottom),
    ).toBeCloseTo(padTop);
  });

  it("maps the bottom of the range to the plot's bottom edge", () => {
    // padTop + chartH = 12 + 260 = 272 = canvasHeight - padBottom.
    expect(
      computeScrubDotY(0, 0, 100, canvasHeight, padTop, padBottom),
    ).toBeCloseTo(272);
  });

  it("maps a mid value to the mid pixel", () => {
    expect(
      computeScrubDotY(50, 0, 100, canvasHeight, padTop, padBottom),
    ).toBeCloseTo(142);
  });
});

// ─── computeTooltipLayout ────────────────────────────────────────────────────

describe("computeTooltipLayout", () => {
  it("returns HIDDEN_TOOLTIP when inactive", () => {
    const layout = computeTooltipLayout(
      false,
      50,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.x).toBeLessThan(0);
    expect(layout.valueStr).toBe("");
  });

  it("returns HIDDEN_TOOLTIP when scrubValue is null", () => {
    const layout = computeTooltipLayout(
      true,
      50,
      null,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.x).toBeLessThan(0);
  });

  it("includes formatted value and time strings", () => {
    const layout = computeTooltipLayout(
      true,
      50,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.valueStr).toBe("42.00");
    expect(layout.timeStr.length).toBeGreaterThan(0);
  });

  it("sizes text by character count when monoCharWidth is set (skips measureText)", () => {
    const layout = computeTooltipLayout(
      true,
      50,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
      8, // monospace advance
    );
    // timeStr "HH:MM:SS" (8 chars) is the widest line; pill = 8*8 + 2*PAD_X(8)
    expect(layout.timeStr.length).toBe(8);
    expect(layout.w).toBe(8 * 8 + 16);
  });

  it("places tooltip to the right of crosshair when space is available", () => {
    const layout = computeTooltipLayout(
      true,
      50,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.x).toBeGreaterThan(50);
  });

  it("flips tooltip left when crosshair is near the right edge", () => {
    const layout = computeTooltipLayout(
      true,
      340,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.x).toBeLessThan(340);
  });

  it("pill height spans two text lines with padding", () => {
    const layout = computeTooltipLayout(
      true,
      50,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.h).toBeGreaterThan(0);
    expect(layout.line2Y).toBeGreaterThan(layout.line1Y);
  });

  it("centers value text horizontally within the pill", () => {
    const layout = computeTooltipLayout(
      true,
      50,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.valueTextX).toBeGreaterThanOrEqual(layout.x);
    expect(layout.valueTextX).toBeLessThan(layout.x + layout.w);
  });

  it("placement 'top' centers the pill over the scrub line and pins it to the top", () => {
    const layout = computeTooltipLayout(
      true,
      200,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
      8, // mono advance → deterministic width
      "top",
    );
    // Centered horizontally over scrubX (200), pinned to padding.top + 8 = 20.
    expect(layout.x + layout.w / 2).toBeCloseTo(200);
    expect(layout.y).toBe(padding.top + 8);
  });

  it("placement 'bottom' pins the pill to the plot's bottom", () => {
    const canvasHeight = 300;
    const layout = computeTooltipLayout(
      true,
      200,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
      8,
      "bottom",
      true,
      true,
      canvasHeight,
    );
    // Bottom edge sits canvasHeight - padding.bottom - 8 from the top.
    expect(layout.y + layout.h).toBe(canvasHeight - padding.bottom - 8);
  });

  it("honors a custom margin for the pinned edge gap", () => {
    const top = computeTooltipLayout(
      true,
      200,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
      8,
      "top",
      true,
      true,
      300,
      24, // margin
    );
    expect(top.y).toBe(padding.top + 24);

    const bottom = computeTooltipLayout(
      true,
      200,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
      8,
      "bottom",
      true,
      true,
      300,
      24,
    );
    expect(bottom.y + bottom.h).toBe(300 - padding.bottom - 24);
  });

  it("placement 'top'/'bottom' clamps the centered pill into the plot at the edges", () => {
    const left = computeTooltipLayout(
      true,
      0,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
      8,
      "top",
    );
    expect(left.x).toBeGreaterThanOrEqual(padding.left + 4);

    const right = computeTooltipLayout(
      true,
      400,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
      8,
      "bottom",
      true,
      true,
      300,
    );
    expect(right.x + right.w).toBeLessThanOrEqual(400 - padding.right - 4);
  });

  it("drops the value row when showValue is false (date-only, single-row height)", () => {
    const layout = computeTooltipLayout(
      true,
      50,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
      8,
      "side",
      false, // showValue
      true, // showTime
    );
    // Single row: height = PAD_Y*2 + lineH = 12 + 12 = 24; sized by the time row.
    expect(layout.h).toBe(24);
    expect(layout.w).toBe(layout.timeStr.length * 8 + 16);
  });

  it("drops the time row when showTime is false (single row sized by value)", () => {
    const layout = computeTooltipLayout(
      true,
      50,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
      8,
      "side",
      true,
      false, // showTime
    );
    expect(layout.h).toBe(24);
    expect(layout.w).toBe(layout.valueStr.length * 8 + 16);
  });

  it("falls back to the time row when both content rows are off", () => {
    const layout = computeTooltipLayout(
      true,
      50,
      42,
      985,
      padding,
      400,
      formatValue,
      formatTime,
      font,
      8,
      "side",
      false,
      false,
    );
    expect(layout.h).toBe(24);
    expect(layout.w).toBe(layout.timeStr.length * 8 + 16);
  });
});

describe("computeTooltipLayoutMulti", () => {
  it("returns hidden when inactive", () => {
    const layout = computeTooltipLayoutMulti(
      false,
      50,
      [{ text: "a", dim: true }],
      padding,
      400,
      font,
    );
    expect(layout.x).toBeLessThan(0);
  });

  it("sizes rows by character count when monoCharWidth is set (skips measureText)", () => {
    const layout = computeTooltipLayoutMulti(
      true,
      50,
      [
        { text: "abc", dim: false },
        { text: "abcde", dim: true }, // widest, 5 chars
      ],
      padding,
      400,
      font,
      8, // monospace advance
    );
    // widest row is 5 chars; pill = 5*8 + 2*PAD_X(8)
    expect(layout.w).toBe(5 * 8 + 16);
  });

  it("builds stackedLines for each row", () => {
    const layout = computeTooltipLayoutMulti(
      true,
      50,
      [
        { text: "time", dim: true },
        { text: "A: 1", dim: false },
      ],
      padding,
      400,
      font,
    );
    expect(layout.stackedLines?.length).toBe(2);
    expect(layout.stackedLines?.[0].dim).toBe(true);
  });

  it("returns hidden when active but no lines", () => {
    const layout = computeTooltipLayoutMulti(true, 50, [], padding, 400, font);
    expect(layout.x).toBeLessThan(0);
  });

  it("flips pill left when scrubX is near the right chart edge", () => {
    const layout = computeTooltipLayoutMulti(
      true,
      340,
      [{ text: "wide label text", dim: false }],
      padding,
      400,
      font,
    );
    expect(layout.x).toBeLessThan(340);
  });
});

describe("deriveScrubValueSingle", () => {
  it("returns null when inactive or time invalid", () => {
    expect(deriveScrubValueSingle(false, 100, [])).toBeNull();
    expect(deriveScrubValueSingle(true, -1, [])).toBeNull();
  });

  it("interpolates from single-series data", () => {
    const data = [
      { time: 970, value: 10 },
      { time: 1000, value: 30 },
    ];
    expect(deriveScrubValueSingle(true, 985, data)).toBeCloseTo(20);
  });
});

describe("deriveCrosshairTooltipSingle", () => {
  it("uses computeTooltipLayout for value + time rows", () => {
    const layout = deriveCrosshairTooltipSingle(
      true,
      50,
      985,
      42,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.valueStr).toBe("42.00");
  });
});

// ─── scrubValue integration via interpolateAtTime ────────────────────────────

describe("scrubValue interpolation", () => {
  it("interpolates value at scrub time from data", () => {
    const data = [
      { time: 970, value: 10 },
      { time: 985, value: 20 },
      { time: 1000, value: 30 },
    ];
    const time = computeScrubTime(
      true,
      padding.left + (400 - padding.left - padding.right) / 2,
      padding,
      400,
      1000,
      30,
    );
    expect(time).toBeCloseTo(985);
    expect(interpolateAtTime(data, time)).toBeCloseTo(20);
  });

  it("clamps to first value when time is before data range", () => {
    const data = [
      { time: 990, value: 5 },
      { time: 1000, value: 10 },
    ];
    expect(interpolateAtTime(data, 970)).toBe(5);
  });

  it("clamps to last value when time is after data range", () => {
    const data = [
      { time: 970, value: 5 },
      { time: 990, value: 10 },
    ];
    expect(interpolateAtTime(data, 1000)).toBe(10);
  });
});

// ─── useCrosshair smoke test ─────────────────────────────────────────────────

describe("useCrosshair (hook)", () => {
  it("initialises with inactive state", () => {
    const engine = makeEngine();
    const { result } = renderHook(() =>
      useCrosshair(
        engine,
        padding,
        palette,
        formatValue,
        formatTime,
        font,
        false,
      ),
    );
    expect(result.current.scrubActive.value).toBe(false);
    expect(result.current.scrubX.value).toBe(-1);
    expect(result.current.scrubTime.value).toBe(-1);
    expect(result.current.crosshairOpacity.value).toBe(0);
    expect(result.current.scrubValue.value).toBeNull();
    expect(result.current.tooltipLayout.value.x).toBeLessThan(0);
  });

  it("exposes a gesture object", () => {
    const engine = makeEngine();
    const { result } = renderHook(() =>
      useCrosshair(
        engine,
        padding,
        palette,
        formatValue,
        formatTime,
        font,
        true,
      ),
    );
    expect(result.current.gesture).toBeDefined();
  });

  it("accepts onScrub and still initialises (sync reaction path)", () => {
    const onScrub = jest.fn();
    const engine = makeEngine();
    const { result } = renderHook(() =>
      useCrosshair(
        engine,
        padding,
        palette,
        formatValue,
        formatTime,
        font,
        true,
        onScrub,
      ),
    );
    expect(result.current.gesture).toBeDefined();
    expect(result.current.scrubActive.value).toBe(false);
  });

  it("accepts onGestureStart/onGestureEnd and still returns a gesture", () => {
    const onGestureStart = jest.fn();
    const onGestureEnd = jest.fn();
    const engine = makeEngine();
    const { result } = renderHook(() =>
      useCrosshair(
        engine,
        padding,
        palette,
        formatValue,
        formatTime,
        font,
        true,
        undefined, // onScrub
        undefined, // candleOpts
        0, // panGestureDelay
        onGestureStart,
        onGestureEnd,
      ),
    );
    expect(result.current.gesture).toBeDefined();
    expect(result.current.scrubActive.value).toBe(false);
    // Callbacks fire only from the UI-thread gesture worklets (istanbul-ignored),
    // so nothing is invoked at render time.
    expect(onGestureStart).not.toHaveBeenCalled();
    expect(onGestureEnd).not.toHaveBeenCalled();
  });

  it("uses Android pan minDistance when Platform.OS is android", () => {
    const prev = Platform.OS;
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    const engine = makeEngine();
    const { result } = renderHook(() =>
      useCrosshair(
        engine,
        padding,
        palette,
        formatValue,
        formatTime,
        font,
        true,
      ),
    );
    expect(result.current.gesture).toBeDefined();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: prev,
    });
  });

  it("does not build a tap gesture or lock state without scrubAction", () => {
    const engine = makeEngine();
    const { result } = renderHook(() =>
      useCrosshair(engine, padding, palette, formatValue, formatTime, font, true),
    );
    // Lock SharedValues are still created (hooks are unconditional)...
    expect(result.current.lockActive?.value).toBe(false);
    expect(result.current.lockX?.value).toBe(-1);
    expect(result.current.lockY?.value).toBe(-1);
    // ...but no tap gesture is constructed in the plain-scrub path.
    expect(result.current.tapGesture).toBeUndefined();
  });

  it("initialises lock state + a tap gesture in scrub-action mode", () => {
    const onScrubAction = jest.fn();
    const engine = makeEngine();
    const { result } = renderHook(() =>
      useCrosshair(
        engine,
        padding,
        palette,
        formatValue,
        formatTime,
        font,
        true,
        undefined, // onScrub
        undefined, // candleOpts
        0, // panGestureDelay
        undefined, // onGestureStart
        undefined, // onGestureEnd
        resolveScrubAction(true),
        onScrubAction,
      ),
    );
    expect(result.current.lockActive?.value).toBe(false);
    expect(result.current.lockX?.value).toBe(-1);
    expect(result.current.lockY?.value).toBe(-1);
    expect(result.current.lockPrice?.value).toBeNull();
    expect(result.current.actionBadge?.value.visible).toBe(false);
    expect(result.current.tapGesture).toBeDefined();
    // The callback fires only from the UI-thread tap worklet (istanbul-ignored).
    expect(onScrubAction).not.toHaveBeenCalled();
  });
});

// ─── computeCandleTooltipLayout ──────────────────────────────────────────────

describe("computeCandleTooltipLayout", () => {
  const candle = { open: 100, high: 120, low: 90, close: 110 };

  it("returns hidden when inactive", () => {
    const layout = computeCandleTooltipLayout(
      false,
      100,
      candle,
      1000,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.x).toBe(-400);
  });

  it("returns hidden when candle is null", () => {
    const layout = computeCandleTooltipLayout(
      true,
      100,
      null,
      1000,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.x).toBe(-400);
  });

  it("builds 5 stacked lines: O, H, L, C + time", () => {
    const layout = computeCandleTooltipLayout(
      true,
      100,
      candle,
      1000,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.stackedLines).toBeDefined();
    expect(layout.stackedLines).toHaveLength(5);
  });

  it("shows OHLC values in order", () => {
    const layout = computeCandleTooltipLayout(
      true,
      100,
      candle,
      1000,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    const texts = layout.stackedLines!.map((l) => l.text);
    expect(texts[0]).toContain("O");
    expect(texts[0]).toContain("100.00");
    expect(texts[1]).toContain("H");
    expect(texts[1]).toContain("120.00");
    expect(texts[2]).toContain("L");
    expect(texts[2]).toContain("90.00");
    expect(texts[3]).toContain("C");
    expect(texts[3]).toContain("110.00");
  });

  it("dims only the time row", () => {
    const layout = computeCandleTooltipLayout(
      true,
      100,
      candle,
      1000,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    const dims = layout.stackedLines!.map((l) => l.dim);
    expect(dims).toEqual([false, false, false, false, true]);
  });

  it("uses formatTime for the last row", () => {
    const layout = computeCandleTooltipLayout(
      true,
      100,
      candle,
      1000,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.stackedLines![4].text).toBe(formatTime(1000));
  });

  it("pill dimensions are positive", () => {
    const layout = computeCandleTooltipLayout(
      true,
      100,
      candle,
      1000,
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.w).toBeGreaterThan(0);
    expect(layout.h).toBeGreaterThan(0);
  });
});
