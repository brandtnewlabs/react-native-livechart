import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { useThreshold, useThresholdSeries } from "../../src/hooks/useThreshold";
import { THRESHOLD_SAMPLE_COUNT } from "../../src/math/threshold";
import type { LiveChartPoint } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

function engine(): ChartEngineLayout {
  return withSharedValueAccessors({
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 100 },
    timeWindow: { value: 100 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 1000 },
  }) as unknown as ChartEngineLayout;
}

// Window [900, 1000]; a rising-then-easing threshold within it.
const series: LiveChartPoint[] = [
  { time: 900, value: 40 },
  { time: 950, value: 60 },
  { time: 1000, value: 55 },
];

describe("useThreshold (constant benchmark)", () => {
  it("computes a finite split Y for a constant value", () => {
    const { result } = renderHook(() =>
      useThreshold(engine(), DEFAULT_PADDING, useSharedValue(50)),
    );
    expect(Number.isFinite(result.current.lineY.value)).toBe(true);
  });

  it("bails to a NaN split Y when handed a series array", () => {
    const { result } = renderHook(() =>
      useThreshold(engine(), DEFAULT_PADDING, series),
    );
    expect(result.current.lineY.value).toBeNaN();
    expect(result.current.visible.value).toBe(false);
  });
});

describe("useThresholdSeries (time-varying)", () => {
  it("builds the polyline, shader samples and current value for a series", () => {
    const { result } = renderHook(() =>
      useThresholdSeries(engine(), DEFAULT_PADDING, series),
    );
    expect(result.current.screenPts.value.length).toBeGreaterThanOrEqual(4);
    expect(result.current.samples.value).toHaveLength(THRESHOLD_SAMPLE_COUNT);
    // value-at-now clamps to the last point (55).
    expect(result.current.currentValue.value).toBeCloseTo(55);
    expect(result.current.currentVisible.value).toBe(true);
    // Polyline is pinned to the exact plot edges (stable dash anchor).
    const pts = result.current.screenPts.value;
    expect(pts[0]).toBe(DEFAULT_PADDING.left);
    expect(pts[pts.length - 2]).toBe(400 - DEFAULT_PADDING.right);
  });

  it("gates the badge anchor off when the value-at-now is off-plot while older segments are visible", () => {
    // Latest step jumps far above the display range: the polyline is still
    // visible (its earlier flat run is on-plot) but the badge, pinned at the
    // value-at-now Y, must be hidden instead of drawing outside the plot.
    const stepped: LiveChartPoint[] = [
      { time: 900, value: 50 },
      { time: 980, value: 50 },
      { time: 980, value: 500 },
      { time: 1000, value: 500 },
    ];
    const { result } = renderHook(() =>
      useThresholdSeries(engine(), DEFAULT_PADDING, stepped),
    );
    expect(result.current.visible.value).toBe(true);
    expect(result.current.currentValue.value).toBeCloseTo(500);
    expect(result.current.currentVisible.value).toBe(false);
  });

  it("short-circuits to empty geometry for a constant value", () => {
    const { result } = renderHook(() =>
      useThresholdSeries(engine(), DEFAULT_PADDING, useSharedValue(50)),
    );
    expect(result.current.screenPts.value).toEqual([]);
    expect(result.current.visible.value).toBe(false);
    expect(result.current.currentValue.value).toBeNaN();
  });

  it("yields a NaN current value for an empty series", () => {
    const { result } = renderHook(() =>
      useThresholdSeries(engine(), DEFAULT_PADDING, []),
    );
    expect(result.current.screenPts.value).toEqual([]);
    expect(result.current.currentValue.value).toBeNaN();
  });

  it("reads a live SharedValue series (threshold.series form)", () => {
    const seriesSV = {
      value: series,
      get: () => series,
    } as unknown as import("react-native-reanimated").SharedValue<
      LiveChartPoint[]
    >;
    const { result } = renderHook(() =>
      // Constant `value` placeholder — `series` wins.
      useThresholdSeries(engine(), DEFAULT_PADDING, useSharedValue(0), seriesSV),
    );
    expect(result.current.samples.value).toHaveLength(THRESHOLD_SAMPLE_COUNT);
    expect(result.current.currentValue.value).toBeCloseTo(55);
    expect(result.current.visible.value).toBe(true);
  });

  it("extendToNow=false: clips at the last point and hides the badge past it", () => {
    // Last point at t=950, now=1000 → the threshold ends mid-plot.
    const ended: LiveChartPoint[] = [
      { time: 900, value: 50 },
      { time: 950, value: 50 },
    ];
    const { result } = renderHook(() =>
      useThresholdSeries(engine(), DEFAULT_PADDING, ended, null, false),
    );
    // clipRightX = x of t=950: plotLeft + (950-900)/100 * plotWidth = 12 + 188.
    expect(result.current.clipRightX.value).toBeCloseTo(200);
    // Marker polyline stops at the clip X, not the plot right edge.
    const pts = result.current.screenPts.value;
    expect(pts[pts.length - 2]).toBeCloseTo(200);
    // Badge hidden: "now" is past the series end.
    expect(result.current.currentVisible.value).toBe(false);
  });

  it("extendToNow=true (default): no clip, badge shows", () => {
    const ended: LiveChartPoint[] = [
      { time: 900, value: 50 },
      { time: 950, value: 50 },
    ];
    const { result } = renderHook(() =>
      useThresholdSeries(engine(), DEFAULT_PADDING, ended),
    );
    expect(result.current.clipRightX.value).toBe(1e9);
    const pts = result.current.screenPts.value;
    expect(pts[pts.length - 2]).toBe(400 - DEFAULT_PADDING.right);
    expect(result.current.currentVisible.value).toBe(true);
  });
});
