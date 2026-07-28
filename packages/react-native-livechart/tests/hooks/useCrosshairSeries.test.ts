import { type SkFont } from "@shopify/react-native-skia";
import { renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import type { MultiEngineState } from "../../src/core/useLiveChartEngine";
import { resolveScrub } from "../../src/core/resolveConfig";
import type {
  PerSeriesTooltipConfig,
  SeriesConfig,
} from "../../src/types";
import {
  computePerSeriesTooltipLayout,
  deriveScrubValueSeries,
  estimateSeriesBucketSeconds,
  interpolateSeriesAtTime,
  truncateSeriesTooltipLabel,
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

function tooltipConfig(
  overrides: true | PerSeriesTooltipConfig = true,
) {
  return resolveScrub({ seriesTooltip: overrides })!.seriesTooltip!;
}

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

describe("computePerSeriesTooltipLayout", () => {
  const visibleSeries = [
    {
      id: "alpha",
      label: "Alpha outcome with a long label",
      data: [
        { time: 900, value: 10 },
        { time: 960, value: 30 },
      ],
      value: 30,
      color: "#2563eb",
    },
    {
      id: "beta",
      label: "Beta",
      data: [
        { time: 900, value: 11 },
        { time: 960, value: 31 },
      ],
      value: 31,
      color: "#dc2626",
    },
    {
      id: "hidden",
      label: "Hidden",
      visible: false,
      data: [
        { time: 900, value: 80 },
        { time: 960, value: 90 },
      ],
      value: 90,
      color: "#16a34a",
    },
  ] satisfies SeriesConfig[];

  it("stays hidden until scrub or alwaysShow is active", () => {
    const layout = computePerSeriesTooltipLayout(
      false,
      -1,
      -1,
      visibleSeries,
      [30, 31, 90],
      ["#2563eb", "#dc2626", "#16a34a"],
      0,
      100,
      padding,
      400,
      300,
      1000,
      formatValue,
      formatTime,
      font,
      tooltipConfig(),
    );
    expect(layout.x).toBeLessThan(0);
    expect(layout.perSeries).toBeUndefined();
  });

  it("formats and clamps the time range, truncates labels, filters hidden series, and flips left", () => {
    const formatSeriesValue = jest.fn((value: number, id: string) =>
      `${id}=${value.toFixed(1)}`,
    );
    const formatTimeRange = jest.fn(
      (from: number, to: number) => `${from}-${to}`,
    );
    const layout = computePerSeriesTooltipLayout(
      true,
      315,
      990,
      visibleSeries,
      [30, 31, 90],
      ["#2563eb", "#dc2626", "#16a34a"],
      0,
      100,
      padding,
      400,
      300,
      1000,
      formatValue,
      formatTime,
      font,
      tooltipConfig({
        bucketSeconds: 60,
        maxLabelChars: 5,
        formatSeriesValue,
        formatTimeRange,
      }),
    );

    expect(layout.perSeries?.pills.map((pill) => pill.id)).toEqual([
      "alpha",
      "beta",
    ]);
    expect(layout.perSeries?.pills[0].label).toBe("Alph…");
    expect(layout.perSeries?.pills[0].value).toBe("alpha=30.0");
    expect(layout.perSeries?.pills.every((pill) => pill.x < 315)).toBe(true);
    expect(layout.perSeries?.timePill?.text).toBe("990-1000");
    expect(formatTimeRange).toHaveBeenCalledWith(990, 1000);
    expect(formatSeriesValue).toHaveBeenCalledTimes(2);
  });

  it("stacks near-identical values without overlap and keeps pills inside a short plot", () => {
    const clustered = visibleSeries.slice(0, 2).map((item, index) => ({
      ...item,
      data: [
        { time: 900, value: 50 + index * 0.01 },
        { time: 960, value: 50 + index * 0.01 },
      ],
    }));
    const layout = computePerSeriesTooltipLayout(
      true,
      160,
      930,
      clustered,
      [50, 50.01],
      ["#2563eb", "#dc2626"],
      0,
      100,
      padding,
      240,
      110,
      1000,
      formatValue,
      formatTime,
      font,
      tooltipConfig({ bucketSeconds: 60 }),
    );
    const pills = [...(layout.perSeries?.pills ?? [])].sort(
      (a, b) => a.y - b.y,
    );
    expect(pills).toHaveLength(2);
    expect(pills[1].y).toBeGreaterThanOrEqual(pills[0].y + pills[0].h);
    expect(pills.every((pill) => pill.y >= padding.top)).toBe(true);
    expect(
      pills.every((pill) => pill.y + pill.h <= 110 - padding.bottom),
    ).toBe(true);
  });

  it("pins only value pills to live endpoints while idle", () => {
    const layout = computePerSeriesTooltipLayout(
      false,
      -1,
      -1,
      visibleSeries,
      [42, 43, 90],
      ["#2563eb", "#dc2626", "#16a34a"],
      0,
      100,
      padding,
      400,
      300,
      1000,
      formatValue,
      formatTime,
      font,
      tooltipConfig({ alwaysShow: true }),
    );

    expect(layout.perSeries?.pinned).toBe(true);
    expect(layout.perSeries?.timePill).toBeUndefined();
    expect(layout.perSeries?.pills.map((pill) => pill.value)).toEqual([
      "42.00",
      "43.00",
    ]);
    expect(
      layout.perSeries?.pills.every(
        (pill) => pill.anchorX === 400 - padding.right,
      ),
    ).toBe(true);
  });

  it("clips oversized pill geometry into both horizontal plot edges", () => {
    const layout = computePerSeriesTooltipLayout(
      true,
      padding.left,
      930,
      [visibleSeries[0]],
      [30],
      ["#2563eb"],
      0,
      100,
      padding,
      125,
      100,
      1000,
      () => "a very long formatted value",
      formatTime,
      font,
      tooltipConfig({ maxLabelChars: 40 }),
    );
    const pill = layout.perSeries!.pills[0];
    expect(pill.x).toBeGreaterThanOrEqual(padding.left + 4);
    expect(pill.x + pill.w).toBeLessThanOrEqual(125 - padding.right - 4);
  });
});

describe("per-series tooltip helpers", () => {
  it("infers the latest positive bucket interval from visible series", () => {
    expect(
      estimateSeriesBucketSeconds([
        {
          id: "hidden",
          visible: false,
          data: [
            { time: 0, value: 0 },
            { time: 100, value: 1 },
          ],
          value: 1,
        },
        {
          id: "shown",
          data: [
            { time: 0, value: 0 },
            { time: 30, value: 1 },
            { time: 90, value: 2 },
          ],
          value: 2,
        },
      ]),
    ).toBe(60);
    expect(estimateSeriesBucketSeconds([])).toBe(0);
  });

  it("truncates only labels over the configured limit", () => {
    expect(truncateSeriesTooltipLabel("Beta", 5)).toBe("Beta");
    expect(truncateSeriesTooltipLabel("Outcome", 5)).toBe("Outc…");
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
