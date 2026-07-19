import { type SkFont } from "@shopify/react-native-skia";
import { renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import type { MultiEngineState } from "../../src/core/useLiveChartEngine";
import {
  computeSeriesScrubTooltipLayout,
  deriveScrubValueSeries,
  interpolateSeriesAtTime,
} from "../../src/hooks/crosshairSeries";
import { useCrosshairSeries } from "../../src/hooks/useCrosshairSeries";
import { withSharedValueAccessors } from "../support/sharedValueMock";

jest.mock("react-native-gesture-handler", () => {
  const makeGesture = () => {
    const g: Record<string, unknown> = { config: {} };
    const proxy: typeof g = new Proxy(g, {
      get: (target, key) => {
        if (key in target) return target[key as string];
        return (...args: unknown[]) => {
          (target.config as Record<string, unknown[]>)[String(key)] = args;
          return proxy;
        };
      },
    });
    return proxy;
  };
  return { Gesture: { Pan: makeGesture } };
});

type GestureConfig = Record<string, unknown[]>;

function getGestureConfig(gesture: unknown): GestureConfig {
  return (gesture as { config: GestureConfig }).config;
}

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
  overrides: Partial<Record<keyof MultiEngineState, { value: unknown }>> = {},
): MultiEngineState {
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
    series: { value: [] },
    displaySeriesValues: { value: [] },
    seriesOpacities: { value: [] },
    ...overrides,
  }) as unknown as MultiEngineState;
}

describe("deriveScrubValueSeries", () => {
  it("returns null when inactive or time invalid", () => {
    expect(deriveScrubValueSeries(false, 100, [])).toBeNull();
    expect(deriveScrubValueSeries(true, -1, [])).toBeNull();
  });

  it("interpolates primary from visible series", () => {
    const series = [
      {
        id: "a",
        data: [
          { time: 900, value: 1 },
          { time: 1000, value: 3 },
        ],
        value: 3,
        color: "#00f",
      },
    ];
    expect(deriveScrubValueSeries(true, 950, series)).toBeCloseTo(2);
  });
});

describe("computeSeriesScrubTooltipLayout", () => {
  it("returns hidden when scrub is inactive", () => {
    const layout = computeSeriesScrubTooltipLayout(
      false,
      50,
      985,
      [
        {
          id: "a",
          data: [{ time: 970, value: 1 }],
          value: 1,
          color: "#00f",
        },
      ],
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.x).toBeLessThan(0);
  });

  it("returns hidden when no primary value", () => {
    const layout = computeSeriesScrubTooltipLayout(
      true,
      50,
      1000,
      [
        {
          id: "a",
          visible: false,
          data: [{ time: 1000, value: 1 }],
          value: 1,
          color: "#00f",
        },
      ],
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.x).toBeLessThan(0);
  });

  it("builds stacked tooltip rows for visible series", () => {
    const layout = computeSeriesScrubTooltipLayout(
      true,
      50,
      985,
      [
        {
          id: "a",
          label: "A",
          data: [
            { time: 970, value: 10 },
            { time: 1000, value: 30 },
          ],
          value: 30,
          color: "#00f",
        },
      ],
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.stackedLines?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("series scrub tooltip layout vs single path", () => {
  it("produces stacked lines for series scrub tooltip", () => {
    const layout = computeSeriesScrubTooltipLayout(
      true,
      50,
      985,
      [
        {
          id: "a",
          data: [
            { time: 970, value: 10 },
            { time: 1000, value: 30 },
          ],
          value: 30,
          color: "#00f",
        },
      ],
      padding,
      400,
      formatValue,
      formatTime,
      font,
    );
    expect(layout.stackedLines?.length).toBeGreaterThan(0);
  });
});

describe("interpolateSeriesAtTime", () => {
  it("skips visible series with empty data (null interpolate)", () => {
    const r = interpolateSeriesAtTime(
      [
        {
          id: "empty",
          data: [],
          value: 5,
          color: "#00f",
        },
        {
          id: "b",
          data: [
            { time: 900, value: 10 },
            { time: 1000, value: 20 },
          ],
          value: 20,
          color: "#f00",
        },
      ],
      950,
    );
    expect(r.seriesValues).toHaveLength(1);
    expect(r.primary).toBeCloseTo(15);
  });

  it("sets primary from first visible series and keeps it when more series match", () => {
    const r = interpolateSeriesAtTime(
      [
        {
          id: "first",
          data: [
            { time: 900, value: 1 },
            { time: 1000, value: 3 },
          ],
          value: 3,
          color: "#00f",
        },
        {
          id: "second",
          data: [
            { time: 900, value: 10 },
            { time: 1000, value: 30 },
          ],
          value: 30,
          color: "#f00",
        },
      ],
      950,
    );
    expect(r.primary).toBeCloseTo(2);
    expect(r.seriesValues).toHaveLength(2);
  });

  it("skips hidden series and interpolates visible data", () => {
    const r = interpolateSeriesAtTime(
      [
        {
          id: "a",
          data: [
            { time: 900, value: 1 },
            { time: 1000, value: 2 },
          ],
          value: 2,
          visible: false,
          color: "#00f",
        },
        {
          id: "b",
          data: [
            { time: 900, value: 10 },
            { time: 1000, value: 20 },
          ],
          value: 20,
          color: "#f00",
        },
      ],
      950,
    );
    expect(r.seriesValues).toHaveLength(1);
    expect(r.seriesValues[0].id).toBe("b");
    expect(r.primary).toBeCloseTo(15);
  });
});

describe("useCrosshairSeries (hook)", () => {
  it("initialises with inactive state", () => {
    const engine = makeEngine({
      series: {
        value: [
          {
            id: "a",
            data: [{ time: 1_700_000_000, value: 5 }],
            value: 5,
            color: "#00f",
          },
        ],
      },
    });
    const { result } = renderHook(() =>
      useCrosshairSeries(engine, padding, false),
    );
    expect(result.current.scrubActive.value).toBe(false);
    expect(result.current.scrubX.value).toBe(-1);
    expect(result.current.scrubTime.value).toBe(-1);
    expect(result.current.crosshairOpacity.value).toBe(0);
    expect(result.current.scrubValue.value).toBeNull();
    expect(result.current.tooltipLayout.value.x).toBeLessThan(0);
  });

  it("exposes a gesture object", () => {
    const engine = makeEngine({
      series: {
        value: [
          {
            id: "a",
            data: [{ time: 1_700_000_000, value: 5 }],
            value: 5,
            color: "#00f",
          },
        ],
      },
    });
    const { result } = renderHook(() =>
      useCrosshairSeries(engine, padding, true),
    );
    expect(result.current.gesture).toBeDefined();
  });

  it("accepts onScrub and still initialises", () => {
    const onScrub = jest.fn();
    const engine = makeEngine({
      series: {
        value: [
          {
            id: "a",
            data: [{ time: 1_700_000_000, value: 5 }],
            value: 5,
            color: "#00f",
          },
        ],
      },
    });
    const { result } = renderHook(() =>
      useCrosshairSeries(engine, padding, true, onScrub),
    );
    expect(result.current.gesture).toBeDefined();
    expect(result.current.scrubActive.value).toBe(false);
  });

  it("accepts onGestureStart/onGestureEnd and still returns a gesture", () => {
    const onGestureStart = jest.fn();
    const onGestureEnd = jest.fn();
    const engine = makeEngine({
      series: {
        value: [
          {
            id: "a",
            data: [{ time: 1_700_000_000, value: 5 }],
            value: 5,
            color: "#00f",
          },
        ],
      },
    });
    const { result } = renderHook(() =>
      useCrosshairSeries(
        engine,
        padding,
        true,
        undefined, // onScrub
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

  it.each(["ios", "android"] as const)(
    "waits for horizontal intent and yields vertical drags on %s",
    (platform) => {
      const prev = Platform.OS;
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: platform,
      });
      const engine = makeEngine({
        series: {
          value: [
            {
              id: "a",
              data: [{ time: 1_700_000_000, value: 5 }],
              value: 5,
              color: "#00f",
            },
          ],
        },
      });
      const { result } = renderHook(() =>
        useCrosshairSeries(engine, padding, true),
      );
      const config = getGestureConfig(result.current.gesture);
      expect(config.minDistance).toBeUndefined();
      expect(config.activateAfterLongPress).toBeUndefined();
      expect(config.activeOffsetX).toEqual([[-20, 20]]);
      expect(config.failOffsetY).toEqual([[-10, 10]]);
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: prev,
      });
    },
  );

  it("only configures a long-press modifier for a positive delay", () => {
    const engine = makeEngine({
      series: {
        value: [
          {
            id: "a",
            data: [{ time: 1_700_000_000, value: 5 }],
            value: 5,
            color: "#00f",
          },
        ],
      },
    });
    const { result } = renderHook(() =>
      useCrosshairSeries(engine, padding, true, undefined, 250),
    );
    const config = getGestureConfig(result.current.gesture);
    expect(config.activateAfterLongPress).toEqual([250]);
    expect(config.minDistance).toBeUndefined();
    expect(config.activeOffsetX).toEqual([[-20, 20]]);
    expect(config.failOffsetY).toEqual([[-10, 10]]);
  });
});
