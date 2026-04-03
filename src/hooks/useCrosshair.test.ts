import { type SkFont } from "@shopify/react-native-skia";
import { renderHook } from "@testing-library/react-native";
import { interpolateAtTime } from "../math/interpolate";
import { resolveTheme } from "../theme";
import type { EngineState } from "../useLivelineEngine";
import {
  computeCrosshairOpacity,
  computeScrubTime,
  computeTooltipLayout,
  useCrosshair,
} from "./useCrosshair";

jest.mock("react-native-gesture-handler", () => {
  // Returns a proxy where every method call returns the same proxy,
  // enabling arbitrary gesture builder chains in tests.
  const makeGesture = () => {
    const g: Record<string, unknown> = {};
    const proxy: typeof g = new Proxy(g, {
      get: (_t, _k) => () => proxy,
    });
    return proxy;
  };
  return { Gesture: { Pan: makeGesture } };
});

const palette = resolveTheme("#3b82f6", "dark");

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as unknown as SkFont;

const padding = { top: 12, right: 80, bottom: 28, left: 12 };
// chartW = 400 - 80 - 12 = 308

const formatValue = (v: number) => v.toFixed(2);
const formatTime = (t: number) =>
  new Date(t * 1000).toISOString().slice(11, 19);

function makeEngine(
  overrides: Partial<Record<keyof EngineState, { value: unknown }>> = {},
): EngineState {
  return {
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
  } as unknown as EngineState;
}

// ─── computeScrubTime ────────────────────────────────────────────────────────

describe("computeScrubTime", () => {
  it("returns -1 when scrub is inactive", () => {
    expect(computeScrubTime(false, 50, padding, 400, 1000, 30)).toBe(-1);
  });

  it("maps scrubX at left chart edge to window start", () => {
    // left edge = padding.left = 12; fraction = 0 → time = 1000 - 30 = 970
    expect(
      computeScrubTime(true, padding.left, padding, 400, 1000, 30),
    ).toBeCloseTo(970);
  });

  it("maps scrubX at right chart edge to now", () => {
    // right edge = 400 - 80 = 320; fraction = (320-12)/308 = 1 → time = 1000
    expect(
      computeScrubTime(true, 400 - padding.right, padding, 400, 1000, 30),
    ).toBeCloseTo(1000);
  });

  it("maps scrubX at midpoint to half-window time", () => {
    // midX = 12 + 308/2 = 166; fraction = 0.5 → time = 985
    const midX = padding.left + (400 - padding.left - padding.right) / 2;
    expect(computeScrubTime(true, midX, padding, 400, 1000, 30)).toBeCloseTo(
      985,
    );
  });

  it("returns -1 when chartW is zero (canvas not yet laid out)", () => {
    expect(computeScrubTime(true, 50, padding, 0, 1000, 30)).toBe(-1);
  });

  it("handles scrubX before the left edge (extrapolates)", () => {
    // x < padding.left → fraction < 0 → time < winStart
    const result = computeScrubTime(true, 0, padding, 400, 1000, 30);
    expect(result).toBeLessThan(970);
  });
});

// ─── computeCrosshairOpacity ─────────────────────────────────────────────────

describe("computeCrosshairOpacity", () => {
  // dotX = 400 - 80 = 320; FADE_ZONE = 40
  const canvasWidth = 400;
  const paddingRight = 80;
  const dotX = canvasWidth - paddingRight; // 320

  it("returns 0 when scrub is inactive", () => {
    expect(computeCrosshairOpacity(false, 200, canvasWidth, paddingRight)).toBe(
      0,
    );
  });

  it("returns 1 when scrubX is well left of the live dot", () => {
    // dist = 320 - 200 = 120 > 40 → opacity = 1
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
    // FADE_ZONE = 4; midpoint = dotX - 2; dist = 2; opacity = 2/4 = 0.5
    expect(
      computeCrosshairOpacity(true, dotX - 2, canvasWidth, paddingRight),
    ).toBeCloseTo(0.5);
  });

  it("returns 1 at exactly one fade-zone width from the dot", () => {
    // dist = 4 exactly → opacity = 4/4 = 1
    expect(
      computeCrosshairOpacity(true, dotX - 4, canvasWidth, paddingRight),
    ).toBeCloseTo(1);
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

  it("places tooltip to the right of crosshair when space is available", () => {
    // scrubX = 50; pillX should be 50 + 12 = 62 > scrubX
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
    // scrubX = 340; pill would overflow rightEdge (320), so flip left
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
    // Should have positive height with room for both lines
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
});

// ─── scrubValue integration via interpolateAtTime ────────────────────────────

describe("scrubValue interpolation", () => {
  it("interpolates value at scrub time from data", () => {
    const data = [
      { time: 970, value: 10 },
      { time: 985, value: 20 },
      { time: 1000, value: 30 },
    ];
    // scrubTime at midpoint = 985 → value = 20
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
    // scrubActive defaults to false → derived values return inactive defaults
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
});
